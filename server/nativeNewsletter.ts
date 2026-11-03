import { createHash } from 'node:crypto';
import { decodePdf, MAX_NEWSLETTER_PDF_BYTES, NewsletterInputError } from './newsletterPdfSecurity.ts';
const PROJECT = 'cc-livingcommunity-app';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
// Gemini's PDF ceiling is independent of TownLoop's 64 MiB publishing limit.
export const NATIVE_ANALYSIS_MAX_BYTES = Math.min(MAX_NEWSLETTER_PDF_BYTES, 50000000);
export const NATIVE_PDF_LOADER_VERSION = 2;
export const nativeNewsletterCapabilities = () => ({ pdfLoaderVersion: NATIVE_PDF_LOADER_VERSION, service: 'townloop-newsletter', projectId: PROJECT, database: '(default)', version: 1, configured: !!process.env.GEMINI_API_KEY?.trim(), maxPdfBytes: NATIVE_ANALYSIS_MAX_BYTES, maxPdfPages: 1000, maxTextFallbackPages: 100, maxTextFallbackCharacters: 500000 });
/** User ID token is forwarded to Firestore: no Admin SDK, public download token or role bypass. */
export async function retainedNativePdf(id: unknown, authorization: string, newUpload: boolean, fetcher: typeof fetch = fetch) {
    if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(id) || (id === 'current' && newUpload))
        throw new NewsletterInputError('Invalid newsletter reference.');
    async function get(path: string, allowMissing = false) {
        const response = await fetcher(BASE + path, { headers: { Authorization: authorization }, redirect: 'error', signal: AbortSignal.timeout(30000) });
        if (allowMissing && response.status === 404) return null;
        if (!response.ok) {
            if (response.status === 401) throw new NewsletterInputError('Your session expired. Sign in again and retry analysis; the PDF is retained.', 401);
            if (response.status === 403) throw new NewsletterInputError('Newsletter access is not authorized.', 403);
            if (response.status === 429 || response.status >= 500) throw new NewsletterInputError('Firebase is temporarily unavailable. Retry analysis without uploading the PDF again.', 503);
            throw new NewsletterInputError('The retained PDF could not be found or read. Return to News and select the retained upload.', 409);
        }
        return response.json();
    }
    async function active() { const current = await get('/newsletters/current?mask.fieldPaths=id&mask.fieldPaths=isRemoved'); if (current.fields?.id?.stringValue !== id || current.fields?.isRemoved?.booleanValue)
        throw new NewsletterInputError('The published newsletter changed. Return to News.', 409); }
    if (!newUpload)
        await active();
    // Legacy uploads can have no parent document. Their chunk metadata must be complete independently.
    const head = await get(`/newsletters/${id}/chunks/0?mask.fieldPaths=totalChunks&mask.fieldPaths=totalSize`);
    const count = Number(head.fields?.totalChunks?.integerValue), size = Number(head.fields?.totalSize?.integerValue);
    if (!Number.isInteger(count) || count < 1 || count > 200 || !Number.isInteger(size) || size < 34)
        throw new NewsletterInputError('The retained upload has invalid metadata.', 409);
    if (size > 'data:application/pdf;base64,'.length + Math.ceil(NATIVE_ANALYSIS_MAX_BYTES / 3) * 4)
        throw new NewsletterInputError('This PDF exceeds the Gemini analysis limit of 50 MB. It can be published unchanged with AI turned off.', 413);
    const manifest = (await get(`/newsletters/${id}?mask.fieldPaths=id&mask.fieldPaths=isRemoved&mask.fieldPaths=totalChunks&mask.fieldPaths=totalSize&mask.fieldPaths=sourceBytes`, true))?.fields;
    if (manifest?.isRemoved?.booleanValue || (manifest?.id?.stringValue && manifest.id.stringValue !== id))
        throw new NewsletterInputError('This retained edition is no longer available.', 409);
    if ((manifest?.totalChunks && Number(manifest.totalChunks.integerValue) !== count) || (manifest?.totalSize && Number(manifest.totalSize.integerValue) !== size))
        throw new NewsletterInputError('The upload manifest does not match its chunks. Nothing was published.', 409);
    const sourceBytes = manifest?.sourceBytes ? Number(manifest.sourceBytes.integerValue) : undefined;
    if (sourceBytes !== undefined && (!Number.isSafeInteger(sourceBytes) || sourceBytes <= 0 || sourceBytes > NATIVE_ANALYSIS_MAX_BYTES))
        throw new NewsletterInputError('The upload manifest has an unsupported PDF size.', 409);
    const rows: Array<{
        index: number;
        data: string;
    }> = [];
    let pageToken: string | undefined, total = 0, hashed = 0;
    const seenTokens = new Set<string>();
    // pageSize is an upper bound, not a guarantee. Large Firestore documents
    // can yield three (or even one) chunks per page instead of eight. Follow
    // every continuation token, with independent bounds on rows and pages.
    for (let page = 0; page < count * 2 + 1; page++) {
        const query = new URLSearchParams({ pageSize: '8' });
        for (const key of ['index', 'data', 'totalChunks', 'totalSize', 'sha256'])
            query.append('mask.fieldPaths', key);
        if (pageToken)
            query.set('pageToken', pageToken);
        const result = await get(`/newsletters/${id}/chunks?${query}`);
        for (const row of result.documents || []) {
            const f = row.fields || {}, data = f.data?.stringValue, index = Number(f.index?.integerValue);
            if (typeof data !== 'string' || data.length > 700000 || Number(f.totalChunks?.integerValue) !== count || Number(f.totalSize?.integerValue) !== size || !Number.isInteger(index) || index < 0 || index >= count)
                throw new NewsletterInputError('The retained upload is inconsistent. Nothing was published.', 409);
            const hash = f.sha256?.stringValue;
            if (f.sha256) {
                if (typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash) || createHash('sha256').update(data).digest('hex') !== hash)
                    throw new NewsletterInputError('The retained PDF failed chunk integrity verification. Nothing was published.', 409);
                hashed++;
            }
            total += data.length;
            if (total > size || rows.length >= count)
                throw new NewsletterInputError('The retained upload is incomplete or inconsistent.', 409);
            rows.push({ index, data });
        }
        pageToken = result.nextPageToken;
        if (!pageToken) break;
        if (seenTokens.has(pageToken)) throw new NewsletterInputError('Firebase repeated an upload-verification page. Retry analysis; do not upload the PDF again.', 503);
        seenTokens.add(pageToken);
    }
    rows.sort((a, b) => a.index - b.index);
    if (pageToken) throw new NewsletterInputError('Upload verification could not finish paging through Firebase. Retry analysis without uploading again.', 503);
    if (rows.length !== count || total !== size || rows.some((r, i) => r.index !== i) || (hashed > 0 && hashed !== count))
        throw new NewsletterInputError('The retained upload is incomplete. Select another complete upload or retry the file transfer.', 409);
    const pdf = decodePdf(rows.map(r => r.data).join(''));
    if (sourceBytes !== undefined && pdf.length !== sourceBytes) throw new NewsletterInputError('The PDF byte length does not match its completed upload manifest. Nothing was published.', 409);
    if (pdf.length > NATIVE_ANALYSIS_MAX_BYTES)
        throw new NewsletterInputError('This PDF exceeds the Gemini analysis limit of 50 MB.', 413);
    if (!newUpload)
        await active();
    return pdf.toString('base64');
}
