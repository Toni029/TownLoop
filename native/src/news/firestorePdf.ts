import {appCheckHeaders} from '../lib/appCheck';
import * as Crypto from 'expo-crypto';
import { auth } from '../lib/firebase';
import config from '../../firebase-config.json';
import type { PdfChunk } from './pdfTransfer';
const database = `projects/${config.projectId}/databases/${config.firestoreDatabaseId || '(default)'}`;
export const documentBase = `https://firestore.googleapis.com/v1/${database}/documents`;
export function pdfId(id: string) { if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id) || id === 'current')
    throw Error('Invalid newsletter draft.'); return id; }
type RetryOptions = { ownerUid?: string; timeoutMs?: number; attempts?: number; wait?: (ms: number, signal?: AbortSignal | null) => Promise<void>; reconcile?: () => Promise<any> };
function paused() { return Error('Upload paused. Confirmed PDF data is retained; retry to resume.'); }
function wait(ms: number, signal?: AbortSignal | null) {
    return new Promise<void>((resolve, reject) => {
        const stop = () => { clearTimeout(timer); signal?.removeEventListener('abort', stop); reject(paused()); };
        const timer = setTimeout(() => { signal?.removeEventListener('abort', stop); resolve(); }, ms);
        signal?.addEventListener('abort', stop, { once: true });
        if (signal?.aborted) stop();
    });
}
/** Bounded retries apply only to reads and deterministic document writes; never to publishing or AI. */
export async function pdfRequest(path: string, init: RequestInit = {}, options: RetryOptions = {}) {
    const user = auth.currentUser;
    if (!user) throw Error('Please sign in again.');
    const check = () => { if (auth.currentUser?.uid !== user.uid || (options.ownerUid && options.ownerUid !== user.uid)) throw Error('Your account changed. Reopen News.'); if (init.signal?.aborted) throw paused(); };
    const attempts = options.attempts || 5;
    let refreshed = false;
    for (let attempt = 0; attempt < attempts; attempt++) {
        check();
        const token = await user.getIdToken(refreshed);
        check();
        const controller = new AbortController(), stop = () => controller.abort();
        const timer = setTimeout(stop, options.timeoutMs || 45000);
        init.signal?.addEventListener('abort', stop, { once: true });
        let retry = false;
        try {
            const response = await fetch(documentBase + path, { ...init, signal: controller.signal, redirect: 'error', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...await appCheckHeaders() } });
            check();
            if (response.status === 404) return null;
            if (response.ok) return await response.json();
            if (response.status === 401 && !refreshed) { refreshed = true; retry = true; }
            else if ([408, 429, 500, 502, 503, 504].includes(response.status)) retry = true;
            else {
                // showMissing is a server/IAM metadata operation, even when the
                // signed-in resident has TownLoop's Admin role. Distinguish it
                // from a real rules denial without exposing server error text.
                const body = response.status === 403 ? await response.json().catch(() => null) : null;
                const metadataOnly = response.status === 403 &&
                    body?.error?.message === 'Metadata operations require admin authentication.';
                throw Object.assign(Error(metadataOnly ? 'Legacy upload discovery requires the secure newsletter service.' : response.status === 403 ? 'Your account is not authorized to manage newsletters. Reopen News and sign in again.' : `Firebase PDF transfer failed (${response.status}). Confirmed data is retained.`), {
                    permanent: true,
                    ...(metadataOnly ? {code: 'firestore-metadata-auth-required'} : {}),
                });
            }
        } catch (error) {
            check();
            if ((error as {permanent?: boolean})?.permanent) throw error;
            retry = true; // Includes Android UnknownHostException, temporary DNS failures and aborted deadlines.
        } finally {
            clearTimeout(timer); init.signal?.removeEventListener('abort', stop);
        }
        if (retry && attempt + 1 < attempts) {
            await (options.wait || wait)(Math.min(15000, 1000 * 2 ** attempt) + Math.random() * 400, init.signal);
            check();
            if (options.reconcile) { const confirmed = await options.reconcile(); if (confirmed) return confirmed; }
        }
    }
    throw Error('The connection to Firebase is unavailable or too slow. Check your Wi-Fi/mobile connection and retry. Confirmed PDF data is retained; a completed upload does not need uploading again.');
}
export async function chunkDigest(data: string) { return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, data); }
export type PdfReceipt = { index: number; sha256: string; totalChunks: number; totalSize: number };
/** Read only bounded metadata. Never download the PDF to determine which chunks are confirmed. */
export async function pdfReceipts(id: string, signal?: AbortSignal): Promise<PdfReceipt[]> {
    pdfId(id);
    const q = new URLSearchParams({pageSize: '200'});
    for (const key of ['index', 'sha256', 'totalChunks', 'totalSize']) q.append('mask.fieldPaths', key);
    const result = await pdfRequest(`/newsletters/${id}/chunks?${q}`, {signal});
    if (result?.nextPageToken) throw Error('Invalid PDF upload metadata. Select a new draft.');
    return (result?.documents || []).map((row: any) => ({index: Number(row.fields?.index?.integerValue), sha256: row.fields?.sha256?.stringValue || '', totalChunks: Number(row.fields?.totalChunks?.integerValue), totalSize: Number(row.fields?.totalSize?.integerValue)}));
}
/** Same authorized paths and byte format; hashes let retries prove an ambiguous write already succeeded. */
export async function commitPdfChunks(id: string, chunks: PdfChunk[], totalChunks: number, totalSize: number, signal?: AbortSignal, options: RetryOptions = {}) {
    pdfId(id);
    if (!chunks.length || chunks.length > 4) throw Error('Invalid PDF transfer batch.');
    const hashes = await Promise.all(chunks.map(c => chunkDigest(c.data)));
    const reconcile = async () => {
        const rows = await pdfReceipts(id, signal);
        return chunks.every((c, i) => rows.some(r => r.index === c.index && r.sha256 === hashes[i] && r.totalChunks === totalChunks && r.totalSize === totalSize)) ? {writeResults: chunks.map(() => ({}))} : null;
    };
    const result = await pdfRequest(':commit', { method: 'POST', signal, body: JSON.stringify({ writes: chunks.map((c, i) => ({ update: {
                    name: `${database}/documents/newsletters/${id}/chunks/${c.index}`,
                    fields: { index: { integerValue: String(c.index) }, data: { stringValue: c.data }, sha256: {stringValue: hashes[i]}, totalChunks: { integerValue: String(totalChunks) }, totalSize: { integerValue: String(totalSize) } },
                }, updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }] })) }) }, {...options, reconcile});
    if (!result || result.writeResults?.length !== chunks.length) throw Error('Firebase did not confirm the complete PDF batch. Retry safely.');
}
export async function savePdfDraft(id: string, metadata: Record<string, unknown>, signal?: AbortSignal) {
    pdfId(id);
    const fields: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(metadata)) {
        if (typeof value === 'string') fields[key] = {stringValue: value};
        else if (typeof value === 'boolean') fields[key] = {booleanValue: value};
        else if (typeof value === 'number' && Number.isFinite(value)) fields[key] = {integerValue: String(Math.trunc(value))};
        else if (Array.isArray(value) && value.length === 0) fields[key] = {arrayValue: {values: []}};
    }
    const result = await pdfRequest(':commit', {method: 'POST', signal, body: JSON.stringify({writes: [{update: {name: `${database}/documents/newsletters/${id}`, fields}, updateTransforms: [{fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME'}]}]})});
    if (result?.writeResults?.length !== 1) throw Error('Firebase did not confirm the PDF draft. Retry the retained upload.');
}
