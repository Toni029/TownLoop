/*
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 * Proprietary and Confidential.
 * Unauthorized copying, distribution, or modification of this source code,
 * via any medium, is strictly prohibited.
 */
import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase';
import { UserProfile, OfficeChat, OfficeChatMessage } from '../types';
import { isVip, isAdmin } from '../utils/permissions';
import { formatMessageTime, getResidentChatDocId } from './maintenanceChat';

export function isVipOrAdmin(user: UserProfile | null | undefined): boolean {
  if (!user) return false;
  return isVip(user) || isAdmin(user) || user.role === 'vip' || user.role === 'admin';
}

export function subscribeToOfficeChats(
  user: UserProfile | null | undefined,
  onUpdate: (chats: OfficeChat[]) => void
): () => void {
  if (!isFirebaseConfigured() || !db || !user) {
    onUpdate([]);
    return () => {};
  }

  const userIsVip = isVipOrAdmin(user);

  if (userIsVip) {
    // VIP and Admin users receive and view all resident office inquiries
    const chatsCollection = collection(db, 'office_chats');
    const unsubscribe = onSnapshot(
      chatsCollection,
      (snapshot) => {
        const chats: OfficeChat[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as OfficeChat;
          chats.push({
            ...data,
            id: docSnap.id,
            messages: Array.isArray(data.messages) ? data.messages : [],
          });
        });
        // Sort by updatedAt descending (newest activity first)
        chats.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        onUpdate(chats);
      },
      (error) => {
        console.warn('Unable to subscribe to VIP office chats:', error);
        onUpdate([]);
      }
    );
    return unsubscribe;
  } else {
    // Non-VIP residents only see their own chat thread with Community Office
    const residentDocId = getResidentChatDocId(user);
    const chatDocRef = doc(db, 'office_chats', residentDocId);

    const unsubscribe = onSnapshot(
      chatDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as OfficeChat;
          onUpdate([
            {
              ...data,
              id: docSnap.id,
              messages: Array.isArray(data.messages) ? data.messages : [],
            },
          ]);
        } else {
          onUpdate([]);
        }
      },
      (error) => {
        console.warn('Unable to subscribe to resident office chat:', error);
        onUpdate([]);
      }
    );
    return unsubscribe;
  }
}

export interface SendOfficeMessageParams {
  resident: {
    id: string | number;
    name: string;
    email?: string;
    unit?: string;
    address?: string;
    phone?: string;
    avatar?: string;
  };
  sender: UserProfile;
  body: string;
  subject?: string;
}

export async function sendOfficeChatMessage(
  params: SendOfficeMessageParams
): Promise<boolean> {
  if (!isFirebaseConfigured() || !db) return false;

  const { resident, sender, body, subject } = params;
  if (!body.trim()) return false;

  const senderIsVip = isVipOrAdmin(sender);
  const residentDocId = getResidentChatDocId(resident);
  const docRef = doc(db, 'office_chats', residentDocId);
  const now = Date.now();
  const timeFormatted = formatMessageTime(now);

  const newMessage: OfficeChatMessage = {
    id: `msg_${now}_${Math.random().toString(36).slice(2, 7)}`,
    senderId: String(sender.id || sender.email || 'unknown'),
    // VIP identity stored for internal audit, but rendered anonymously as "Community Office" to the resident
    senderName: sender.name || (senderIsVip ? 'Community Office' : 'Resident'),
    senderRole: senderIsVip ? 'vip' : 'resident',
    senderAvatar: senderIsVip ? '' : (sender.avatar_url || sender.avatarUrl || ''),
    body: body.trim(),
    createdAt: now,
    time: timeFormatted,
  };

  try {
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const existing = docSnap.data() as OfficeChat;
      const updatedMessages = [...(existing.messages || []), newMessage];

      await setDoc(
        docRef,
        {
          messages: updatedMessages,
          lastMessage: senderIsVip ? body.trim() : body.trim(),
          updatedAt: now,
          unreadByVip: senderIsVip ? false : true,
          unreadByResident: senderIsVip ? true : false,
          ...(subject ? { subject: subject.trim() } : {}),
        },
        { merge: true }
      );
    } else {
      // First message in thread
      const newChat: OfficeChat = {
        id: residentDocId,
        residentId: String(resident.id || ''),
        residentName: resident.name || 'Resident',
        residentEmail: resident.email || '',
        residentApt: resident.unit || resident.address || 'TownLoop Resident',
        residentPhone: resident.phone || '',
        residentAvatar: resident.avatar || '',
        subject: subject?.trim() || 'Office Inquiry',
        lastMessage: body.trim(),
        updatedAt: now,
        unreadByVip: senderIsVip ? false : true,
        unreadByResident: senderIsVip ? true : false,
        messages: [newMessage],
      };
      await setDoc(docRef, newChat);
    }
    return true;
  } catch (error) {
    console.warn('Unable to send office chat message:', error);
    return false;
  }
}

export async function markOfficeChatRead(
  residentId: string | number,
  asRole: 'vip' | 'resident'
): Promise<void> {
  if (!isFirebaseConfigured() || !db) return;
  const cleanId = String(residentId).replace(/^office_/, '');
  const docRef = doc(db, 'office_chats', cleanId);
  try {
    if (asRole === 'vip') {
      await updateDoc(docRef, { unreadByVip: false });
    } else {
      await updateDoc(docRef, { unreadByResident: false });
    }
  } catch (err) {
    // If doc not created yet or permission error, silently fail
  }
}

export async function deleteOfficeChat(chatId: string): Promise<boolean> {
  if (!isFirebaseConfigured() || !db) return false;
  const cleanId = String(chatId).replace(/^office_/, '');
  try {
    const docRef = doc(db, 'office_chats', cleanId);
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    console.warn('Unable to delete office chat doc:', err);
    return false;
  }
}

