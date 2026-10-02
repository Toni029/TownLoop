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
import { UserProfile, MaintenanceChat, MaintenanceChatMessage } from '../types';
import { isCrew } from '../utils/permissions';

export function formatMessageTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (isToday) return timeStr;
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;
}

export function getResidentChatDocId(
  userOrResident: { id?: string | number; email?: string } | null | undefined
): string {
  if (!userOrResident) return 'resident_default';
  if (userOrResident.email && userOrResident.email.trim()) {
    return userOrResident.email.trim().toLowerCase().replace(/[^a-zA-Z0-9_-]/g, '_');
  }
  if (userOrResident.id && String(userOrResident.id).trim() && String(userOrResident.id) !== 'resident') {
    return String(userOrResident.id).trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  }
  return 'resident_default';
}

export function subscribeToMaintenanceChats(
  user: UserProfile | null | undefined,
  onUpdate: (chats: MaintenanceChat[]) => void
): () => void {
  if (!isFirebaseConfigured() || !db || !user) {
    onUpdate([]);
    return () => {};
  }

  const userIsCrew = isCrew(user);

  if (userIsCrew) {
    // Crew members see all resident maintenance chat threads
    const chatsCollection = collection(db, 'maintenance_chats');
    const unsubscribe = onSnapshot(
      chatsCollection,
      (snapshot) => {
        const chats: MaintenanceChat[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as MaintenanceChat;
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
        console.warn('Unable to subscribe to crew maintenance chats:', error);
        onUpdate([]);
      }
    );
    return unsubscribe;
  } else {
    // Non-crew residents only see their own chat thread with Maintenance Crew
    const residentDocId = getResidentChatDocId(user);
    const chatDocRef = doc(db, 'maintenance_chats', residentDocId);

    const unsubscribe = onSnapshot(
      chatDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as MaintenanceChat;
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
        console.warn('Unable to subscribe to resident maintenance chat:', error);
        onUpdate([]);
      }
    );
    return unsubscribe;
  }
}

export interface SendMaintenanceMessageParams {
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

export async function sendMaintenanceChatMessage(
  params: SendMaintenanceMessageParams
): Promise<boolean> {
  if (!isFirebaseConfigured() || !db) return false;

  const { resident, sender, body, subject } = params;
  if (!body.trim()) return false;

  const senderIsCrew = isCrew(sender);
  const residentDocId = getResidentChatDocId(resident);
  const docRef = doc(db, 'maintenance_chats', residentDocId);
  const now = Date.now();
  const timeFormatted = formatMessageTime(now);

  const newMessage: MaintenanceChatMessage = {
    id: `msg_${now}_${Math.random().toString(36).slice(2, 7)}`,
    senderId: String(sender.id || sender.email || 'unknown'),
    senderName: sender.name || (senderIsCrew ? 'Maintenance Crew' : 'Resident'),
    senderRole: senderIsCrew ? 'crew' : 'resident',
    senderAvatar: sender.avatar_url || sender.avatarUrl || '',
    body: body.trim(),
    createdAt: now,
    time: timeFormatted,
  };

  try {
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const existing = docSnap.data() as MaintenanceChat;
      const updatedMessages = [...(existing.messages || []), newMessage];

      await setDoc(
        docRef,
        {
          messages: updatedMessages,
          lastMessage: senderIsCrew ? `${sender.name}: ${body.trim()}` : body.trim(),
          updatedAt: now,
          unreadByCrew: senderIsCrew ? false : true,
          unreadByResident: senderIsCrew ? true : false,
          ...(subject ? { subject: subject.trim() } : {}),
        },
        { merge: true }
      );
    } else {
      // First message in thread
      const newChat: MaintenanceChat = {
        id: residentDocId,
        residentId: String(resident.id || ''),
        residentName: resident.name || 'Resident',
        residentEmail: resident.email || '',
        residentApt: resident.unit || resident.address || 'TownLoop Resident',
        residentPhone: resident.phone || '',
        residentAvatar: resident.avatar || '',
        subject: subject?.trim() || 'Maintenance Service Request',
        lastMessage: senderIsCrew ? `${sender.name}: ${body.trim()}` : body.trim(),
        updatedAt: now,
        unreadByCrew: senderIsCrew ? false : true,
        unreadByResident: senderIsCrew ? true : false,
        messages: [newMessage],
      };
      await setDoc(docRef, newChat);
    }
    return true;
  } catch (error) {
    console.warn('Unable to send maintenance chat message:', error);
    return false;
  }
}

export async function markMaintenanceChatRead(
  residentId: string | number,
  asRole: 'crew' | 'resident'
): Promise<void> {
  if (!isFirebaseConfigured() || !db) return;
  const cleanId = String(residentId).replace(/^maint_/, '');
  const docRef = doc(db, 'maintenance_chats', cleanId);
  try {
    if (asRole === 'crew') {
      await updateDoc(docRef, { unreadByCrew: false });
    } else {
      await updateDoc(docRef, { unreadByResident: false });
    }
  } catch (err) {
    // If doc not created yet or permission error, silently fail
  }
}

export async function deleteMaintenanceChat(chatId: string): Promise<boolean> {
  if (!isFirebaseConfigured() || !db) return false;
  const cleanId = String(chatId).replace(/^maint_/, '');
  try {
    const docRef = doc(db, 'maintenance_chats', cleanId);
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    console.warn('Unable to delete maintenance chat doc:', err);
    return false;
  }
}
