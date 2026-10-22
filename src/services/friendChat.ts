/*
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 * Proprietary and Confidential.
 * Unauthorized copying, distribution, or modification of this source code,
 * via any medium, is strictly prohibited.
 */
import { collection, query, where, runTransaction, doc, onSnapshot } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase';
import { UserProfile, ResidentChat, ResidentChatMessage } from '../types';
import { getUserRole } from '../utils/permissions';
import { formatMessageTime } from './maintenanceChat';
import { inboxUid, inboxActor, ownInboxCursor, projectInbox } from './inboxIntegrity';
const LOCAL_STORAGE_KEY = 'townloop_resident_chats_v1';
export function getAllParticipantIdentifiers(value: any): string[] { const uid = inboxUid(value); return uid ? [uid] : []; }
export function getCleanParticipantKey(value: any): string { return inboxUid(value); }
export function getFriendChatDocId(a: any, b: any): string { return [inboxUid(a), inboxUid(b)].sort().join('_vs_'); }
export function isUserInChat(user: any, chat: ResidentChat): boolean {
  return !!inboxUid(user) && (chat as any)?.identityVersion === 2 && !!chat?.participantIds?.includes(inboxUid(user));
}
export function loadLocalChats(): ResidentChat[] {
  try { return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]'); } catch { return []; }
}
export function saveLocalChats(chats: ResidentChat[]) { try { localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(chats)); } catch {} }
export function subscribeToFriendChats(user: UserProfile | null | undefined, onUpdate: (chats: ResidentChat[]) => void): () => void {
  const uid = inboxUid(user);
  // Only exact UID membership may expose a cached private conversation.
  onUpdate(loadLocalChats().filter(chat => isUserInChat(user, chat)).map(chat => projectInbox(chat, uid)).filter(Boolean) as ResidentChat[]);
  if (!isFirebaseConfigured() || !db || !uid) return () => {};
  return onSnapshot(query(collection(db, 'resident_chats'), where('participantIds', 'array-contains', uid), where('identityVersion', '==', 2)), snapshot => {
    const chats = snapshot.docs.map(item => projectInbox({ ...item.data(), id: item.id } as ResidentChat, uid)).filter(Boolean) as ResidentChat[];
    chats.sort((a,b) => b.updatedAt - a.updatedAt);
    // The server snapshot is authoritative; never merge edited cached histories over it.
    saveLocalChats([...loadLocalChats().filter(chat => !isUserInChat(user, chat)), ...chats]);
    onUpdate(chats);
  }, error => { console.warn('Unable to subscribe to resident chats:', error); onUpdate([]); });
}
export interface SendFriendMessageParams {
  sender: UserProfile;
  recipient: { id?: string | number; name: string; email?: string; avatar?: string; phone?: string; apt?: string };
  body: string; subject?: string;
}
export async function sendFriendChatMessage(params: SendFriendMessageParams): Promise<ResidentChat> {
  const { recipient, body, subject } = params;
  const sender = await inboxActor(inboxUid(params.sender));
  const senderId = inboxUid(sender), recipientId = inboxUid(recipient);
  if (!recipientId || recipientId === senderId || !body.trim() || body.length > 10000) throw Error('Choose a neighbor and enter a message of up to 10,000 characters.');
  if (!db) throw Error('Messaging is unavailable.');
  const id = getFriendChatDocId(sender, recipient), now = Date.now();
  const message: ResidentChatMessage = { id: `msg_${now}_${Math.random().toString(36).slice(2,9)}`, senderId,
    senderName: sender.name || 'Resident', senderRole: getUserRole(sender), senderAvatar: sender.avatar_url ?? sender.avatarUrl ?? '',
    body: body.trim(), createdAt: now, time: formatMessageTime(now) };
  const result = await runTransaction(db, async tx => {
    const reference = doc(db!, 'resident_chats', id), snapshot = await tx.get(reference);
    const existing = snapshot.data() as ResidentChat | undefined;
    if (existing && !isUserInChat(sender, existing)) throw Error('This conversation is unavailable.');
    const patch = { messages: [...(existing?.messages || []), message], lastMessage: message.body, updatedAt: now,
      subject: subject?.trim().slice(0,160) || existing?.subject || 'Conversation', unreadBy: [recipientId] };
    const created: ResidentChat & { identityVersion: number } = { identityVersion: 2, id, participantIds: [senderId, recipientId], participants: [
      { id: senderId, name: sender.name || 'Resident', avatar: message.senderAvatar },
      { id: recipientId, name: recipient.name || 'Resident', avatar: recipient.avatar || '' }], ...patch };
    if (snapshot.exists()) tx.update(reference, patch); else tx.set(reference, created);
    return { ...(existing || created), ...patch };
  });
  saveLocalChats([...loadLocalChats().filter(chat => chat.id !== id), result]);
  return result;
}
export async function markFriendChatRead(chatId: string, user: UserProfile | null | undefined): Promise<void> {
  if (!user) return;
  await ownInboxCursor('resident_chats', chatId, 'readBy', inboxUid(user));
}
export async function deleteFriendChat(chatId: string): Promise<boolean> {
  try { await ownInboxCursor('resident_chats', chatId, 'hiddenBy'); saveLocalChats(loadLocalChats().filter(chat => chat.id !== chatId)); return true; }
  catch { return false; }
}
