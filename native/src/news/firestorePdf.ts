import { auth } from '../lib/firebase';
import config from '../../firebase-config.json';
import type { PdfChunk } from './pdfTransfer';
const database = `projects/${config.projectId}/databases/${config.firestoreDatabaseId || '(default)'}`;
export const documentBase = `https://firestore.googleapis.com/v1/${database}/documents`;
export function pdfId(id: string) { if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id) || id === 'current')
    throw Error('Invalid newsletter draft.'); return id; }
export async function pdfRequest(path: string, init: RequestInit = {}) {
    const user = auth.currentUser, token = await user?.getIdToken();
    if (!user || !token)
        throw Error('Please sign in again.');
    const response = await fetch(documentBase + path, { ...init, redirect: 'error', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } });
    if (auth.currentUser?.uid !== user.uid)
        throw Error('Your account changed. Reopen News.');
    if (response.status === 404)
        return null;
    if (!response.ok)
        throw Error(response.status === 403 ? 'Your account is not authorized to manage newsletters. Reopen News and sign in again.' : `Firebase PDF transfer failed (${response.status}). Retry the retained draft.`);
    return response.json();
}
/** Direct authenticated HTTPS avoids Firestore SDK WebChannel's serialized write stream. Rules still authorize each write. */
export async function commitPdfChunks(id: string, chunks: PdfChunk[], totalChunks: number, totalSize: number, signal?: AbortSignal) {
    pdfId(id);
    if (!chunks.length || chunks.length > 4)
        throw Error('Invalid PDF transfer batch.');
    const result = await pdfRequest(':commit', { method: 'POST', signal, body: JSON.stringify({ writes: chunks.map(c => ({ update: {
                    name: `${database}/documents/newsletters/${id}/chunks/${c.index}`,
                    fields: { index: { integerValue: String(c.index) }, data: { stringValue: c.data }, totalChunks: { integerValue: String(totalChunks) }, totalSize: { integerValue: String(totalSize) } },
                }, updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }] })) }) });
    if (!result || result.writeResults?.length !== chunks.length)
        throw Error('Firebase did not confirm the complete PDF batch. Retry safely.');
}
