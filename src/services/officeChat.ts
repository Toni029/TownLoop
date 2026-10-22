/*
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 * Proprietary and Confidential.
 * Unauthorized copying, distribution, or modification of this source code,
 * via any medium, is strictly prohibited.
 */
import { collection, query, where, runTransaction, onSnapshot } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../firebase';
import { UserProfile, OfficeChat, OfficeChatMessage } from '../types';
import { getUserRole } from '../utils/permissions';
import { inboxUid, inboxActor, residentThreadRef, ownInboxCursor, projectInbox } from './inboxIntegrity';
import { formatMessageTime } from './maintenanceChat';
export function isVipOrAdmin(user: UserProfile | null | undefined): boolean { return !!user && user.approved === true && ['admin', 'vip'].includes(getUserRole(user)); }

export function subscribeToOfficeChats(user: UserProfile | null | undefined, onUpdate: (chats: OfficeChat[]) => void): () => void {
  if (!isFirebaseConfigured() || !db || !user || !inboxUid(user)) { onUpdate([]); return () => {}; }
  const team = ['admin', 'vip'].includes(getUserRole(user));
  const base = collection(db, 'office_chats');
  const source = team ? base : query(base, where('residentId', '==', inboxUid(user)));
  return onSnapshot(source, snapshot => {
    const chats = snapshot.docs.map(item => projectInbox({ ...item.data(), id: item.id } as OfficeChat, inboxUid(user), team ? 'unreadByVip' : 'unreadByResident')).filter(Boolean) as OfficeChat[];
    chats.sort((a,b) => b.updatedAt - a.updatedAt); onUpdate(chats);
  }, error => { console.warn('Unable to subscribe to office chats:', error); onUpdate([]); });
}
export interface SendOfficeMessageParams {
  resident: { id: string | number; name: string; email?: string; unit?: string; address?: string; phone?: string; avatar?: string };
  sender: UserProfile; body: string; subject?: string; messageId?: string;
}
export async function sendOfficeChatMessage(params: SendOfficeMessageParams): Promise<boolean> {
  if (!isFirebaseConfigured() || !db) return false;
  try {
    const { resident, body, subject, messageId } = params;
    if (messageId !== undefined && !/^[A-Za-z0-9_-]{1,120}$/.test(messageId)) return false;
    const user = await inboxActor(inboxUid(params.sender));
    if (!body.trim() || body.length > 10000 || !inboxUid(resident)) return false;
    const team = ['admin', 'vip'].includes(getUserRole(user));
    if (!team && inboxUid(resident) !== inboxUid(user)) return false;
    const reference = await residentThreadRef('office_chats', inboxUid(resident)), now = Date.now();
    const message: OfficeChatMessage = { id: messageId || `msg_${now}_${Math.random().toString(36).slice(2,9)}`, senderId: inboxUid(user),
      senderName: user.name || 'Resident', senderRole: getUserRole(user), senderAvatar: user.avatar_url ?? user.avatarUrl ?? '',
      body: body.trim(), createdAt: now, time: formatMessageTime(now) };
    if (auth?.currentUser?.uid !== inboxUid(user)) return false;
    await runTransaction(db, async tx => {
      const snapshot = await tx.get(reference), existing = snapshot.data() as OfficeChat | undefined;
      if (auth?.currentUser?.uid !== inboxUid(user)) throw Error('Your session changed.');
      const duplicate = existing?.messages?.find(item => item.id === message.id);
      if (duplicate) {
        if (duplicate.senderId !== message.senderId || duplicate.body !== message.body) throw Error('Message ID conflict.');
        return;
      }
      const patch = { messages: [...(existing?.messages || []), message], lastMessage: message.body, updatedAt: now,
        subject: subject?.trim().slice(0,160) || existing?.subject || 'Office Inquiry', unreadByVip: !team, unreadByResident: team };
      if (snapshot.exists()) tx.update(reference, patch);
      else tx.set(reference, { id: reference.id, residentId: inboxUid(resident), residentName: resident.name || 'Resident',
        residentEmail: '', residentApt: '', residentPhone: '', residentAvatar: resident.avatar || '', ...patch });
    });
    return auth?.currentUser?.uid === inboxUid(user);
  } catch (error) { console.warn('Unable to send office chat message:', error); return false; }
}
export async function markOfficeChatRead(residentId: string | number, _asRole: 'vip' | 'resident'): Promise<void> {
  await ownInboxCursor('office_chats', String(residentId), 'readBy');
}
export async function deleteOfficeChat(chatId: string): Promise<boolean> {
  try { await ownInboxCursor('office_chats', String(chatId), 'hiddenBy'); return true; } catch { return false; }
}
