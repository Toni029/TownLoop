import { decodePdf, MAX_NEWSLETTER_PDF_BYTES, NewsletterInputError } from './newsletterPdfSecurity.ts';
const PROJECT = 'cc-livingcommunity-app';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
// Gemini's PDF ceiling is independent of TownLoop's 64 MiB publishing limit.
export const NATIVE_ANALYSIS_MAX_BYTES = Math.min(MAX_NEWSLETTER_PDF_BYTES, 50000000);
export const nativeNewsletterCapabilities = () => ({ service: 'townloop-newsletter', projectId: PROJECT, database: '(default)', version: 1, configured: !!process.env.GEMINI_API_KEY?.trim(), maxPdfBytes: NATIVE_ANALYSIS_MAX_BYTES, maxPdfPages: 1000, maxTextFallbackPages: 100, maxTextFallbackCharacters: 500000 });
/** User ID token is forwarded to Firestore: no Admin SDK, public download token or role bypass. */
export async function retainedNativePdf(id: unknown, authorization: string, newUpload: boolean, fetcher: typeof fetch = fetch) {
    if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(id) || (id === 'current' && newUpload))
        throw new NewsletterInputError('Invalid newsletter reference.');
    async function get(path: string) {
        const response = await fetcher(BASE + path, { headers: { Authorization: authorization }, redirect: 'error', signal: AbortSignal.timeout(30000) });
        if (!response.ok)
            throw new NewsletterInputError(response.status === 403 ? 'Newsletter access is not authorized.' : 'The retained PDF is unavailable. Return to News and select a complete upload.', response.status === 403 ? 403 : 409);
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
    const rows: Array<{
        index: number;
        data: string;
    }> = [];
    let pageToken: string | undefined, total = 0;
    for (let page = 0; page < 26; page++) {
        const query = new URLSearchParams({ pageSize: '8' });
        for (const key of ['index', 'data', 'totalChunks', 'totalSize'])
            query.append('mask.fieldPaths', key);
        if (pageToken)
            query.set('pageToken', pageToken);
        const result = await get(`/newsletters/${id}/chunks?${query}`);
        for (const row of result.documents || []) {
            const f = row.fields || {}, data = f.data?.stringValue, index = Number(f.index?.integerValue);
            if (typeof data !== 'string' || data.length > 700000 || Number(f.totalChunks?.integerValue) !== count || Number(f.totalSize?.integerValue) !== size || !Number.isInteger(index) || index < 0 || index >= count)
                throw new NewsletterInputError('The retained upload is inconsistent. Nothing was published.', 409);
            total += data.length;
            if (total > size || rows.length >= count)
                throw new NewsletterInputError('The retained upload is incomplete or inconsistent.', 409);
            rows.push({ index, data });
        }
        pageToken = result.nextPageToken;
        if (!pageToken)
            break;
    }
    rows.sort((a, b) => a.index - b.index);
    if (pageToken || rows.length !== count || total !== size || rows.some((r, i) => r.index !== i))
        throw new NewsletterInputError('The retained upload is incomplete. Select another complete upload or retry the file transfer.', 409);
    const pdf = decodePdf(rows.map(r => r.data).join(''));
    if (pdf.length > NATIVE_ANALYSIS_MAX_BYTES)
        throw new NewsletterInputError('This PDF exceeds the Gemini analysis limit of 50 MB.', 413);
    if (!newUpload)
        await active();
    return pdf.toString('base64');
}
