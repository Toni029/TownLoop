/*
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 * Proprietary and Confidential.
 * Unauthorized copying, distribution, or modification of this source code,
 * via any medium, is strictly prohibited.
 */
import { collection, query, where, runTransaction, onSnapshot } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../firebase';
import { UserProfile, MaintenanceChat, MaintenanceChatMessage } from '../types';
import { getUserRole } from '../utils/permissions';
import { inboxUid, inboxActor, residentThreadRef, ownInboxCursor, projectInbox } from './inboxIntegrity';
export function formatMessageTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
export function getResidentChatDocId(user: { id?: string | number; email?: string } | null | undefined): string { return inboxUid(user); }

export function subscribeToMaintenanceChats(user: UserProfile | null | undefined, onUpdate: (chats: MaintenanceChat[]) => void): () => void {
  if (!isFirebaseConfigured() || !db || !user || !inboxUid(user)) { onUpdate([]); return () => {}; }
  const team = getUserRole(user) === 'crew';
  const base = collection(db, 'maintenance_chats');
  const source = team ? base : query(base, where('residentId', '==', inboxUid(user)));
  return onSnapshot(source, snapshot => {
    const chats = snapshot.docs.map(item => projectInbox({ ...item.data(), id: item.id } as MaintenanceChat, inboxUid(user), team ? 'unreadByCrew' : 'unreadByResident')).filter(Boolean) as MaintenanceChat[];
    chats.sort((a,b) => b.updatedAt - a.updatedAt); onUpdate(chats);
  }, error => { console.warn('Unable to subscribe to maintenance chats:', error); onUpdate([]); });
}
export interface SendMaintenanceMessageParams {
  resident: { id: string | number; name: string; email?: string; unit?: string; address?: string; phone?: string; avatar?: string };
  sender: UserProfile; body: string; subject?: string; messageId?: string;
}
export async function sendMaintenanceChatMessage(params: SendMaintenanceMessageParams): Promise<boolean> {
  if (!isFirebaseConfigured() || !db) return false;
  try {
    const { resident, body, subject, messageId } = params;
    if (messageId !== undefined && !/^[A-Za-z0-9_-]{1,120}$/.test(messageId)) return false;
    const user = await inboxActor(inboxUid(params.sender));
    if (!body.trim() || body.length > 10000 || !inboxUid(resident)) return false;
    const team = getUserRole(user) === 'crew';
    if (!team && inboxUid(resident) !== inboxUid(user)) return false;
    const reference = await residentThreadRef('maintenance_chats', inboxUid(resident)), now = Date.now();
    const message: MaintenanceChatMessage = { id: messageId || `msg_${now}_${Math.random().toString(36).slice(2,9)}`, senderId: inboxUid(user),
      senderName: user.name || 'Resident', senderRole: getUserRole(user), senderAvatar: user.avatar_url ?? user.avatarUrl ?? '',
      body: body.trim(), createdAt: now, time: formatMessageTime(now) };
    if (auth?.currentUser?.uid !== inboxUid(user)) return false;
    await runTransaction(db, async tx => {
      const snapshot = await tx.get(reference), existing = snapshot.data() as MaintenanceChat | undefined;
      if (auth?.currentUser?.uid !== inboxUid(user)) throw Error('Your session changed.');
      const duplicate = existing?.messages?.find(item => item.id === message.id);
      if (duplicate) {
        if (duplicate.senderId !== message.senderId || duplicate.body !== message.body) throw Error('Message ID conflict.');
        return;
      }
      const patch = { messages: [...(existing?.messages || []), message], lastMessage: message.body, updatedAt: now,
        subject: subject?.trim().slice(0,160) || existing?.subject || 'Maintenance Service Request', unreadByCrew: !team, unreadByResident: team };
      if (snapshot.exists()) tx.update(reference, patch);
      else tx.set(reference, { id: reference.id, residentId: inboxUid(resident), residentName: resident.name || 'Resident',
        residentEmail: '', residentApt: '', residentPhone: '', residentAvatar: resident.avatar || '', ...patch });
    });
    return auth?.currentUser?.uid === inboxUid(user);
  } catch (error) { console.warn('Unable to send maintenance chat message:', error); return false; }
}
export async function markMaintenanceChatRead(residentId: string | number, _asRole: 'crew' | 'resident'): Promise<void> {
  await ownInboxCursor('maintenance_chats', String(residentId), 'readBy');
}
export async function deleteMaintenanceChat(chatId: string): Promise<boolean> {
  try { await ownInboxCursor('maintenance_chats', String(chatId), 'hiddenBy'); return true; } catch { return false; }
}
