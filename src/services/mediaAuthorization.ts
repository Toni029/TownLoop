import { doc, runTransaction, serverTimestamp, Timestamp, type Firestore } from 'firebase/firestore';

export type MediaCollection = 'work_orders' | 'discussion_feed' | 'posts' | 'marketplace_posts' | 'marketItems';
export interface MediaRecordLink { recordId: string; collection: MediaCollection }
/** Drafts carry no public content and expire for new uploads after one hour. Rules enforce ownership. */
export async function ensureMediaDraft(db: Firestore, link: MediaRecordLink, uid: string): Promise<void> {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(link.recordId)) throw new Error('Invalid attachment record.');
  await runTransaction(db, async tx => {
    const reference = doc(db, link.collection, link.recordId);
    const snapshot = await tx.get(reference);
    if (snapshot.exists()) {
      if (snapshot.data().storageDraft === true) {
        if (snapshot.data().userId !== uid) throw new Error('This upload draft belongs to another account.');
        const expiresAt = snapshot.data().storageDraftExpiresAt;
        if (!(expiresAt instanceof Timestamp) || expiresAt.toMillis() <= Date.now())
          throw new Error('This upload draft expired. Close this form and start again.');
      }
      return;
    }
    tx.set(reference, { userId: uid, storageDraft: true,
      storageDraftExpiresAt: Timestamp.fromMillis(Date.now() + 60 * 60 * 1000), createdAt: serverTimestamp() });
  });
}
/** Strip bearer tokens from legacy WorkOrder URLs and read using Storage Rules instead. */
export function privateWorkOrderPath(value: string, bucket: string): string | null {
  if (value.startsWith(`gs://${bucket}/work_orders/`)) {
    const path = value.slice(`gs://${bucket}/`.length);
    return path.split('/').length === 2 && path.length > 'work_orders/'.length ? path : null;
  }
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'firebasestorage.googleapis.com') return null;
    const prefix = `/v0/b/${bucket}/o/`;
    if (!url.pathname.startsWith(prefix)) return null;
    const path = decodeURIComponent(url.pathname.slice(prefix.length));
    return path.startsWith('work_orders/') && path.split('/').length === 2 ? path : null;
  } catch { return null; }
}
