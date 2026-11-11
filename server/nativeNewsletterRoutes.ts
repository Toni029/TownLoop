import { Router } from 'express';
import { requireNativeNewsletterManager } from './newsletterAuth.ts';
import { retainedNativePdf, nativeNewsletterCapabilities, NATIVE_PDF_LOADER_VERSION } from './nativeNewsletter.ts';
import { NewsletterPdfError } from './newsletterPdfText.ts';
import { NewsletterInputError } from './newsletterPdfSecurity.ts';
import { extractNewsletterContent } from './newsletterExtractor.ts';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { newsletterAnalysisFailure } from './newsletterAnalysisErrors.ts';
import {newsletterJobsEnabled, startNewsletterJob, getNewsletterJob, chargeNewsletterAnalysis} from './newsletterJobs.ts';
const asText = (value: unknown, limit: number) => typeof value === 'string' ? value.slice(0, limit) : '';
// Monitoring verifies app identity only; canonical account/role authorization still runs for every request.
const monitorAppCheck: express.RequestHandler = async (req,res,next) => {
    const token = req.headers['x-firebase-appcheck'];
    let status = 'missing';
    if (typeof token === 'string' && token.length <= 16384) {
        try {
            const appModule = 'firebase-admin/app', checkModule = 'firebase-admin/app-check';
            const {getApps, initializeApp} = await import(appModule);
            if (!getApps().length) initializeApp();
            await (await import(checkModule)).getAppCheck().verifyToken(token);
            res.locals.verifiedAppCheckToken = token;
            status = 'verified';
        } catch { status = 'unverified'; }
    } else if (token !== undefined) status = 'unverified';
    // No token, user ID, request headers or raw verification errors in logs.
    console.info('[Newsletter App Check]', {status});
    next();
};
function quotaResponse(error:unknown,res:express.Response): boolean {
    const limit = error as {code?:string;retryAfterMs?:number};
    if (limit?.code !== 'resource-exhausted') return false;
    res.setHeader('Retry-After', String(Math.max(1,Math.ceil((limit.retryAfterMs||1000)/1000))));
    res.status(429).json({error:'Please wait before starting another analysis. Your retained PDF and saved progress are unchanged.'});
    return true;
}
export const nativeNewsletterRouter = Router();
// Functions Framework may preparse JSON before Express. Enforce the reference-only size limit there too.
nativeNewsletterRouter.use((req,res,next) => {
    const bytes = (req as express.Request & {rawBody?:Uint8Array}).rawBody?.byteLength || Number(req.headers['content-length'] || 0);
    if (bytes > 64 * 1024) { res.status(413).json({error:'Send only the retained newsletter reference. Do not upload the PDF again for analysis.'}); return; }
    next();
});
nativeNewsletterRouter.use((_req,res,next) => { res.setHeader('Cache-Control','no-store'); next(); });
nativeNewsletterRouter.get('/health', (_req,res) => res.json({status:'ok',service:'townloop-native-api',projectId:'cc-livingcommunity-app',pdfLoaderVersion:NATIVE_PDF_LOADER_VERSION}));
// Native API: small reference-only requests reuse the already confirmed Firestore PDF.
nativeNewsletterRouter.get('/capabilities', monitorAppCheck, requireNativeNewsletterManager, (_req, res) => { res.setHeader('Cache-Control', 'no-store'); res.json({...nativeNewsletterCapabilities(),analysisJobsVersion:newsletterJobsEnabled()?1:0}); });
nativeNewsletterRouter.post('/analysis-jobs',monitorAppCheck,requireNativeNewsletterManager,express.json({limit:'64kb'}),async(req,res)=>{
    if(!newsletterJobsEnabled()){res.status(503).json({error:'Background analysis service update is pending. The PDF is retained.'});return;}
    try{res.status(202).json(await startNewsletterJob(res.locals.newsletterManagerUid,req.body));}
    catch(error){if(quotaResponse(error,res))return;res.status(error instanceof NewsletterInputError?error.status:503).json({error:error instanceof NewsletterInputError?error.message:'Analysis could not be queued. Retry using the retained PDF.'});}
});
nativeNewsletterRouter.get('/analysis-jobs/:jobId',monitorAppCheck,requireNativeNewsletterManager,async(req,res)=>{
    if(!newsletterJobsEnabled()){res.status(503).json({error:'Background analysis service update is pending. The PDF is retained.'});return;}
    try{res.json(await getNewsletterJob(res.locals.newsletterManagerUid,String(req.params.jobId)));}
    catch(error){res.status(error instanceof NewsletterInputError?error.status:503).json({error:error instanceof NewsletterInputError?error.message:'Analysis progress could not be checked. Retry to reconnect to saved progress.'});}
});
nativeNewsletterRouter.post('/extract-content', monitorAppCheck, requireNativeNewsletterManager, express.json({ limit: '64kb' }), async (req, res) => {
    const requestId = randomUUID();
    res.setHeader('X-TownLoop-Analysis-Request', requestId);
    let stage: 'verification' | 'analysis' = 'verification';
    try {
        if (req.body?.base64Data || req.body?.fileDataUrl) throw new NewsletterInputError('Use the retained newsletter reference; PDF retransmission is not supported.');
        if (!nativeNewsletterCapabilities().configured) {
            res.status(503).json({ error: 'Gemini is not configured on the secure server. Your uploaded PDF is retained for retry.' });
            return;
        }
        if (typeof req.body?.isNewUpload !== 'boolean')
            throw new NewsletterInputError('An explicit newsletter analysis mode is required.');
        if (typeof req.body.newsletterId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(req.body.newsletterId) || (req.body.newsletterId === 'current' && req.body.isNewUpload))
            throw new NewsletterInputError('Invalid newsletter analysis reference.');
        // Bound retained-PDF reconstruction as well as provider calls for synchronous requests.
        await chargeNewsletterAnalysis(res.locals.newsletterManagerUid,req.body.newsletterId);
        const forwardedFetch:typeof fetch = (url,init) => {
            const headers = new Headers(init?.headers);
            if (res.locals.verifiedAppCheckToken) headers.set('X-Firebase-AppCheck',res.locals.verifiedAppCheckToken);
            return fetch(url,{...init,headers});
        };
        const base64Data = await retainedNativePdf(req.body.newsletterId, req.headers.authorization!, req.body.isNewUpload, forwardedFetch);
        stage = 'analysis';
        const result = await extractNewsletterContent({ newsletterId: req.body.newsletterId, base64Data, mimeType: 'application/pdf', fileName: asText(req.body.fileName, 255), editionTitle: asText(req.body.editionTitle, 200), monthEdition: asText(req.body.monthEdition, 100), isNewUpload: req.body.isNewUpload, isReanalysis: !req.body.isNewUpload });
        res.json(result);
    }
    catch (error) {
        if (quotaResponse(error,res)) return;
        if (error instanceof NewsletterInputError) {
            res.status(error.status).json({ error: error.message, stage });
            return;
        }
        if (error instanceof NewsletterPdfError) {
            res.status(422).json({ error: error.message, stage });
            return;
        }
        // Never return upstream credentials, document text or private logs.
        if (stage === 'verification') { res.status(503).json({ error: 'Firebase could not verify the retained PDF right now. Retry analysis without uploading again. The published newsletter is unchanged.', stage }); return; }
        const failure = newsletterAnalysisFailure(error);
        // No upstream error text, prompts, keys, profile data or document contents.
        console.warn('[Newsletter Pipeline] Analysis request failed.', {requestId, stage: failure.failureStage, code: failure.code, upstreamStatus: failure.upstreamStatus});
        res.status(failure.httpStatus).json({stage, requestId, code: failure.code, failureStage: failure.failureStage, retryable: failure.retryable, error: failure.error});
    }
});
