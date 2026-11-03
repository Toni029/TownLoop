import { Router } from 'express';
import { requireNativeNewsletterManager } from './newsletterAuth.ts';
import { retainedNativePdf, nativeNewsletterCapabilities, NATIVE_PDF_LOADER_VERSION } from './nativeNewsletter.ts';
import { NewsletterPdfError } from './newsletterPdfText.ts';
import { NewsletterInputError } from './newsletterPdfSecurity.ts';
import { extractNewsletterContent } from './newsletterExtractor.ts';
import express from 'express';
const asText = (value: unknown, limit: number) => typeof value === 'string' ? value.slice(0, limit) : '';
const windows = new Map<string, {
    count: number;
    until: number;
}>();
const limitAiRequests: express.RequestHandler = (req, res, next) => {
    const key = req.ip || 'unknown', now = Date.now();
    for (const [key, value] of windows)
        if (value.until <= now)
            windows.delete(key);
    const entry = windows.get(key) || { count: 0, until: now + 600000 };
    entry.count++;
    windows.set(key, entry);
    if (entry.count > 20) {
        res.status(429).json({ error: 'Too many analysis requests. Please retry later.' });
        return;
    }
    next();
};
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
nativeNewsletterRouter.get('/capabilities', requireNativeNewsletterManager, (_req, res) => { res.setHeader('Cache-Control', 'no-store'); res.json(nativeNewsletterCapabilities()); });
nativeNewsletterRouter.post('/extract-content', requireNativeNewsletterManager, limitAiRequests, express.json({ limit: '64kb' }), async (req, res) => {
    let stage: 'verification' | 'analysis' = 'verification';
    try {
        if (req.body?.base64Data || req.body?.fileDataUrl) throw new NewsletterInputError('Use the retained newsletter reference; PDF retransmission is not supported.');
        if (!nativeNewsletterCapabilities().configured) {
            res.status(503).json({ error: 'Gemini is not configured on the secure server. Your uploaded PDF is retained for retry.' });
            return;
        }
        if (typeof req.body?.isNewUpload !== 'boolean')
            throw new NewsletterInputError('An explicit newsletter analysis mode is required.');
        const base64Data = await retainedNativePdf(req.body.newsletterId, req.headers.authorization!, req.body.isNewUpload);
        stage = 'analysis';
        const result = await extractNewsletterContent({ newsletterId: req.body.newsletterId, base64Data, mimeType: 'application/pdf', fileName: asText(req.body.fileName, 255), editionTitle: asText(req.body.editionTitle, 200), monthEdition: asText(req.body.monthEdition, 100), isNewUpload: req.body.isNewUpload, isReanalysis: !req.body.isNewUpload });
        res.json(result);
    }
    catch (error) {
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
        res.status(502).json({ stage, error: 'Newsletter analysis failed. The uploaded PDF is retained; retry analysis without uploading again. The published newsletter is unchanged. Gemini supports PDFs up to 50 MB and 1,000 pages.' });
    }
});
