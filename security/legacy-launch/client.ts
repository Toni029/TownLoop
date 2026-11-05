/** Local backport adapter, NOT imported by either shipped application.
 * New private-record provisioning/attestation is intentionally server-only.
 */
import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import {
  collection, doc, documentId, getDocFromServer, getDocs, getFirestore,
  limit, orderBy, query, runTransaction, startAfter, FieldPath,
  type Firestore,
} from 'firebase/firestore';
export const NAMED_DATABASE = 'ai-studio-cclivingv27-5fc1a0f6-cd75-4964-8c9e-e219a265f7bb';
const sources = ['resident_chats', 'office_chats', 'maintenance_chats', 'marketplace_chats', 'work_orders'] as const;
export type PrivateSource = typeof sources[number];
export type ChatSource = Exclude<PrivateSource, 'work_orders'>;
const roles = ['resident', 'crew', 'vip', 'admin'];
const safeId = (id: string) => typeof id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(id);
export function namedDatabase(app: FirebaseApp) { return getFirestore(app, NAMED_DATABASE); }
function uid(auth: Auth) {
  const value = auth.currentUser?.uid;
  if (!value) throw Error('Sign in again.');
  return value;
}
async function actor(db: Firestore, auth: Auth) {
  const id = uid(auth), snapshot = await getDocFromServer(doc(db, 'users', id)), data = snapshot.data();
  if (!snapshot.exists() || data?.approved !== true || data.deletionPending === true || !roles.includes(data.role))
    throw Error('An approved account is required.');
  if (uid(auth) !== id) throw Error('Your account changed. Sign in again.');
  return { ...data, id } as { id: string; name?: string; role: string; avatar_url?: string; avatarUrl?: string };
}
/** Pending registrations may retrieve their own profile, never a directory. */
export async function ownProfile(db: Firestore, auth: Auth) {
  const id = uid(auth), snapshot = await getDocFromServer(doc(db, 'users', id));
  if (uid(auth) !== id) throw Error('Your account changed. Sign in again.');
  return snapshot;
}
/** Server projection contains only source and exact recordId, no previews/contacts.
 * Pagination is explicit; the caller must fetch later pages before claiming a full list.
 */
export async function mailboxPage(db: Firestore, auth: Auth, after?: string) {
  const person = await actor(db, auth);
  if (after !== undefined && !safeId(after)) throw Error('Invalid mailbox page.');
  const base = collection(db, 'legacy_private_mailboxes', person.id, 'records');
  const snapshot = await getDocs(query(base, orderBy(documentId()), ...(after ? [startAfter(after)] : []), limit(50)));
  if (uid(auth) !== person.id) throw Error('Your account changed. Sign in again.');
  const records = snapshot.docs.map(item => {
    const value = item.data();
    if (!sources.includes(value.source) || !safeId(value.recordId)) throw Error('This record needs community office review.');
    return { source: value.source as PrivateSource, recordId: value.recordId as string };
  });
  return { records, nextCursor: snapshot.size === 50 ? snapshot.docs.at(-1)!.id : null };
}
export async function privateRecord(db: Firestore, auth: Auth, source: PrivateSource, recordId: string) {
  const person = await actor(db, auth);
  if (!sources.includes(source) || !safeId(recordId)) throw Error('Invalid private record.');
  // The rules validate a hidden server-owned grant. Mailbox presence is not authority.
  const snapshot = await getDocFromServer(doc(db, source, recordId));
  if (uid(auth) !== person.id) throw Error('Your account changed. Sign in again.');
  return snapshot;
}
export async function sendExistingMessage(db: Firestore, auth: Auth, source: ChatSource, recordId: string, body: string, operationId: string) {
  const person = await actor(db, auth), text = body.trim();
  if (!sources.includes(source) || (source as string) === 'work_orders' || !safeId(recordId) || !safeId(operationId) || !text || text.length > 10000)
    throw Error('Choose an available conversation and enter a message of up to 10,000 characters.');
  return runTransaction(db, async transaction => {
    const reference = doc(db, source, recordId), snapshot = await transaction.get(reference), before = snapshot.data();
    if (!snapshot.exists() || !Array.isArray(before?.messages) || !safeId(before.authorizationEpoch) || before.authorizationEpoch.length > 32) throw Error('This conversation needs community office review.');
    if (uid(auth) !== person.id) throw Error('Your account changed. Sign in again.');
    const duplicate = before.messages.find((message: any) => message.operationId === operationId && message.senderId === person.id);
    if (duplicate) {
      if (duplicate.senderId !== person.id || (duplicate.body ?? duplicate.text) !== text) throw Error('This message changed. Retry with a new message.');
      return { acknowledged: true, duplicate: true };
    }
    const now = Date.now(), message = {
      id: `legacy_${before.authorizationEpoch}_${person.id}_${before.messages.length}`, operationId, senderId: person.id, senderName: person.name || 'Resident', senderRole: person.role,
      senderAvatar: person.avatar_url ?? person.avatarUrl ?? '', createdAt: now,
      ...(source === 'marketplace_chats' ? { text, timestamp: new Date(now).toISOString() } : { body: text, time: new Date(now).toLocaleTimeString() }),
    };
    transaction.update(reference, { messages: [...before.messages, message], lastMessage: text, updatedAt: now });
    return { acknowledged: true, duplicate: false };
  });
}
export async function markExistingRead(db: Firestore, auth: Auth, source: ChatSource, recordId: string) {
  const person = await actor(db, auth);
  if (!sources.includes(source) || (source as string) === 'work_orders' || !safeId(recordId)) throw Error('Invalid conversation.');
  await runTransaction(db, async transaction => {
    const reference = doc(db, source, recordId), snapshot = await transaction.get(reference);
    if (!snapshot.exists() || !Array.isArray(snapshot.data()?.messages)) throw Error('This conversation needs community office review.');
    if (uid(auth) !== person.id) throw Error('Your account changed. Sign in again.');
    transaction.update(reference, new FieldPath('readBy', person.id), snapshot.data()!.messages.length);
  });
}
