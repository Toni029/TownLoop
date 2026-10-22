import { FieldPath, collection, doc, getDoc, getDocs, limit, query, runTransaction, where } from 'firebase/firestore';
import { auth, db } from '../firebase';
import type { UserProfile } from '../types';
import { getUserRole } from '../utils/permissions';

/** Exact canonical UID only. Email/name aliases require a reviewed migration. */
export function inboxUid(value: any): string {
  return typeof value === 'object' && value ? String(value.id || '') : typeof value === 'string' ? value : '';
}
export async function inboxActor(expectedId?: string): Promise<UserProfile> {
  const uid = auth?.currentUser?.uid;
  if (!db || !uid || (expectedId && expectedId !== uid)) throw Error('Sign in again.');
  const snapshot = await getDoc(doc(db, 'users', uid));
  const profile = { ...snapshot.data(), id: uid } as UserProfile;
  if (!snapshot.exists() || profile.approved !== true || profile.deletionPending === true || !['resident', 'admin', 'vip', 'crew'].includes(getUserRole(profile)))
    throw Error('An approved account is required.');
  if (auth?.currentUser?.uid !== uid) throw Error('Your session changed.');
  return profile;
}
export async function residentThreadRef(collectionName: string, uid: string) {
  if (!db || !uid) throw Error('Select an approved resident.');
  // Keep authoritative UID-owned legacy document IDs; never resolve email aliases.
  const matches = await getDocs(query(collection(db, collectionName), where('residentId', '==', uid), limit(2)));
  return matches.docs.find(item => item.id === uid)?.ref || matches.docs[0]?.ref || doc(db, collectionName, uid);
}
export function projectInbox<T extends Record<string, any>>(data: T, uid: string, teamField?: string): T | null {
  const messages = Array.isArray(data.messages) ? data.messages : [];
  if (Number.isInteger(data.hiddenBy?.[uid]) && data.hiddenBy[uid] >= messages.length) return null;
  if (!Number.isInteger(data.readBy?.[uid])) return data;
  const unread = messages.slice(data.readBy[uid]).some((m: any) => m.senderId !== uid &&
    (!teamField || (teamField === 'unreadByResident'
      ? ['admin', 'vip', 'crew'].includes(m.senderRole)
      : teamField === 'unreadByVip' ? !['admin', 'vip'].includes(m.senderRole) : m.senderRole !== 'crew')));
  return { ...data, ...(teamField ? { [teamField]: unread } : { unreadBy: unread ? [uid] : [] }) };
}
export async function ownInboxCursor(collectionName: string, chatId: string, field: 'readBy' | 'hiddenBy', expectedId?: string) {
  const actor = await inboxActor(expectedId);
  if (!db) return;
  await runTransaction(db, async tx => {
    const reference = doc(db!, collectionName, chatId);
    const snapshot = await tx.get(reference);
    if (snapshot.exists()) tx.update(reference, new FieldPath(field, String(actor.id)), (snapshot.data().messages || []).length);
  });
}
