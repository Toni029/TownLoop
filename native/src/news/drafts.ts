import { approvedUser } from './actions';
import { pdfRequest, pdfId } from './firestorePdf';
import { PDF_PREFIX, PDF_CHUNK_BYTES } from './pdfTransfer';
import type { NewsletterConfig } from '../models';
export type RetainedEdition = NewsletterConfig & {
    totalChunks: number;
    totalSize: number;
    sourceBytes: number;
    retainedAt: string;
    partial?: boolean;
    confirmedChunks?: number;
};
/** Metadata only, including legacy orphan parent IDs; no PDF contents are downloaded to list drafts. */
export async function retainedEditions(): Promise<RetainedEdition[]> {
    const user = await approvedUser(true);
    const fields = ['id', 'isRemoved', 'uploadState', 'editionTitle', 'monthEdition', 'fileName', 'fileSize', 'sourceBytes', 'uploadedAt', 'uploadedBy', 'totalChunks', 'totalSize'];
    const rows: any[] = [];
    let token: string | undefined;
    for (let page = 0; page < 3; page++) {
        const q = new URLSearchParams({ pageSize: '100', showMissing: 'true' });
        for (const key of fields)
            q.append('mask.fieldPaths', key);
        if (token)
            q.set('pageToken', token);
        const r = await pdfRequest('/newsletters?' + q);
        rows.push(...r?.documents || []);
        token = r?.nextPageToken;
        if (!token)
            break;
    }
    if (token)
        throw Error('There are too many retained editions to list safely. Ask the community office for the exact draft.');
    const active = rows.find(r => r.name.endsWith('/current'))?.fields?.id?.stringValue;
    const candidates = rows.filter(r => !r.name.endsWith('/current') && !r.name.endsWith('/' + active) && !r.fields?.isRemoved?.booleanValue && (!r.fields?.id || ['uploaded', 'uploading'].includes(r.fields?.uploadState?.stringValue)));
    if (candidates.length > 50)
        throw Error('Too many retained drafts. Ask the community office to review newsletter staging.');
    const found: RetainedEdition[] = [];
    let next = 0;
    async function worker() {
        while (next < candidates.length) {
            const row = candidates[next++], id = pdfId(row.name.split('/').at(-1)), f = row.fields || {};
            const q = new URLSearchParams({ pageSize: '200' });
            for (const key of ['index', 'sha256', 'totalChunks', 'totalSize', 'updatedAt'])
                q.append('mask.fieldPaths', key);
            const r = await pdfRequest(`/newsletters/${id}/chunks?${q}`), chunks = r?.documents || [], head = chunks[0]?.fields;
            const count = Number(head?.totalChunks?.integerValue || f.totalChunks?.integerValue), size = Number(head?.totalSize?.integerValue || f.totalSize?.integerValue);
            if (r?.nextPageToken || !Number.isInteger(count) || count < 1 || count > 200 || chunks.length > count || !Number.isInteger(size) || size < 34 || size > PDF_PREFIX.length + Math.ceil(64 * 1048576 / 3) * 4)
                continue;
            const indices = new Set<number>();
            let valid = true, latest = '';
            for (const c of chunks) {
                const d = c.fields || {}, index = Number(d.index?.integerValue);
                if (!Number.isInteger(index) || index < 0 || index >= count || Number(d.totalChunks?.integerValue) !== count || Number(d.totalSize?.integerValue) !== size)
                    valid = false;
                indices.add(index);
                if (d.updatedAt?.timestampValue > latest)
                    latest = d.updatedAt.timestampValue;
            }
            const partial = chunks.length !== count;
            if (!valid || indices.size !== chunks.length) continue;
            if (!latest) latest = new Date(Number(f.uploadedAt?.integerValue) || 0).toISOString();
            if (!Number.isFinite(Date.parse(latest))) continue;
            // Only a newly journaled upload belonging to this account may resume
            // partially. Legacy chunks without byte hashes remain untouched.
            if (partial && (f.uploadState?.stringValue !== 'uploading' || f.uploadedBy?.stringValue !== String(user.id) || chunks.some((c: any) => !/^[a-f0-9]{64}$/.test(c.fields?.sha256?.stringValue || '')))) continue;
            const sourceBytes = Number(f.sourceBytes?.integerValue) || Math.floor((size - PDF_PREFIX.length) * 3 / 4);
            if (!Number.isSafeInteger(sourceBytes) || sourceBytes <= 0 || sourceBytes > 64 * 1048576)
                continue;
            if (partial && (Math.ceil(sourceBytes / PDF_CHUNK_BYTES) !== count || size !== PDF_PREFIX.length + Math.ceil(sourceBytes / 3) * 4)) continue;
            found.push({ partial, confirmedChunks: chunks.length, id, description: '', editionTitle: f.editionTitle?.stringValue || '', monthEdition: f.monthEdition?.stringValue || '', fileName: f.fileName?.stringValue || 'Retained newsletter PDF', fileSize: f.fileSize?.stringValue || `${(sourceBytes / 1048576).toFixed(1)} MB`, pdfUrl: `firestore:${id}`, fileUrl: `firestore:${id}`, isCustomUpload: true, isRemoved: false, hasFirestoreBlob: true, totalChunks: count, totalSize: size, sourceBytes, uploadedAt: Number(f.uploadedAt?.integerValue) || Date.parse(latest), ...(f.uploadedBy?.stringValue ? { uploadedBy: f.uploadedBy.stringValue } : {}), retainedAt: latest } as RetainedEdition);
        }
    }
    await Promise.all([worker(), worker(), worker()]);
    return found.sort((a, b) => b.retainedAt.localeCompare(a.retainedAt));
}
