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
import { UserProfile, ResidentChat, ResidentChatMessage, ResidentChatParticipant } from '../types';
import { formatMessageTime } from './maintenanceChat';

const LOCAL_STORAGE_KEY = 'townloop_resident_chats_v1';

export function getAllParticipantIdentifiers(userOrFriend: any): string[] {
  if (!userOrFriend) return ['resident'];
  if (typeof userOrFriend === 'string') {
    const raw = userOrFriend.trim().toLowerCase();
    const clean = raw.replace(/[^a-zA-Z0-9_-]/g, '_');
    return Array.from(new Set([raw, clean].filter(Boolean)));
  }
  if (typeof userOrFriend === 'number') {
    return [String(userOrFriend)];
  }

  const ids: string[] = [];
  if (userOrFriend.id && String(userOrFriend.id).trim() && String(userOrFriend.id) !== 'resident') {
    const rawId = String(userOrFriend.id).trim().toLowerCase();
    ids.push(rawId);
    ids.push(rawId.replace(/[^a-zA-Z0-9_-]/g, '_'));
  }
  if (userOrFriend.email && userOrFriend.email.trim()) {
    const rawEmail = userOrFriend.email.trim().toLowerCase();
    ids.push(rawEmail);
    ids.push(rawEmail.replace(/[^a-zA-Z0-9_-]/g, '_'));
  }
  if (userOrFriend.name && userOrFriend.name.trim()) {
    const rawName = userOrFriend.name.trim().toLowerCase();
    ids.push(rawName);
    ids.push(rawName.replace(/[^a-zA-Z0-9_-]/g, '_'));
  }

  if (ids.length === 0) {
    ids.push('resident');
  }

  return Array.from(new Set(ids.filter(Boolean)));
}

export function getCleanParticipantKey(userOrId: any): string {
  const ids = getAllParticipantIdentifiers(userOrId);
  return ids[1] || ids[0] || 'resident';
}

export function getFriendChatDocId(userA: any, userB: any): string {
  const keyA = getCleanParticipantKey(userA);
  const keyB = getCleanParticipantKey(userB);
  return [keyA, keyB].sort().join('_vs_');
}

export function isUserInChat(user: any, chat: ResidentChat): boolean {
  if (!chat) return false;
  if (!user) return true; // If no specific user filter, allow chat so it is never dropped

  const myIds = getAllParticipantIdentifiers(user);
  if (myIds.length === 0 || (myIds.length === 1 && myIds[0] === 'resident')) {
    return true;
  }

  // 1. Check participantIds array
  const pIds = (chat.participantIds || []).map(p => String(p).toLowerCase());
  if (pIds.some(p => myIds.includes(p))) return true;

  // 2. Check participants object array
  if (chat.participants && Array.isArray(chat.participants)) {
    for (const p of chat.participants) {
      const pVariants = [
        p.id ? String(p.id).toLowerCase() : '',
        p.name ? p.name.toLowerCase() : '',
        p.name ? p.name.toLowerCase().replace(/[^a-zA-Z0-9_-]/g, '_') : '',
        p.email ? p.email.toLowerCase() : '',
      ].filter(Boolean);
      if (pVariants.some(v => myIds.includes(v))) return true;
    }
  }

  // 3. Check chat.id
  const chatIdLower = String(chat.id).toLowerCase();
  if (myIds.some(id => chatIdLower.includes(id))) return true;

  return false;
}

export function loadLocalChats(): ResidentChat[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalChats(chats: ResidentChat[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(chats));
  } catch {
    // ignore
  }
}

export function subscribeToFriendChats(
  user: UserProfile | null | undefined,
  onUpdate: (chats: ResidentChat[]) => void
): () => void {
  // 1. Immediately deliver cached chats so UI renders with 0ms latency on reload or switch
  const allLocal = loadLocalChats();
  const cached = allLocal.filter(chat => isUserInChat(user, chat));
  onUpdate(cached.length > 0 ? cached : allLocal);

  if (!isFirebaseConfigured() || !db) {
    return () => {};
  }

  try {
    const chatsCol = collection(db, 'resident_chats');
    const unsubscribe = onSnapshot(
      chatsCol,
      (snapshot) => {
        const cloudChats: ResidentChat[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as ResidentChat;
          const fullChat: ResidentChat = {
            ...data,
            id: docSnap.id,
            messages: Array.isArray(data.messages) ? data.messages : [],
            unreadBy: Array.isArray(data.unreadBy) ? data.unreadBy : [],
            participants: Array.isArray(data.participants) ? data.participants : [],
            participantIds: Array.isArray(data.participantIds) ? data.participantIds : [],
          };
          cloudChats.push(fullChat);
        });

        // Merge cloud chats into local cache by ID (never wipe local cache)
        const currentLocal = loadLocalChats();
        const mergedMap = new Map<string, ResidentChat>();
        currentLocal.forEach(l => mergedMap.set(l.id, l));

        cloudChats.forEach(c => {
          const prev = mergedMap.get(c.id);
          if (prev && (prev.updatedAt || 0) > (c.updatedAt || 0)) {
            // Deduplicate and merge messages
            const msgMap = new Map<string, ResidentChatMessage>();
            (c.messages || []).forEach(m => msgMap.set(m.id, m));
            (prev.messages || []).forEach(m => msgMap.set(m.id, m));
            const mergedMsgs = Array.from(msgMap.values());
            mergedMsgs.sort((a, b) => a.createdAt - b.createdAt);

            mergedMap.set(c.id, {
              ...c,
              ...prev,
              messages: mergedMsgs,
            });
          } else {
            mergedMap.set(c.id, c);
          }
        });

        const mergedAll = Array.from(mergedMap.values());
        mergedAll.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        saveLocalChats(mergedAll);

        const filtered = mergedAll.filter(chat => isUserInChat(user, chat));
        onUpdate(filtered.length > 0 ? filtered : mergedAll);
      },
      (err) => {
        console.warn('Unable to subscribe to resident_chats Firestore collection:', err);
        // On error, deliver all stored local chats so user never loses messages
        const fallback = loadLocalChats();
        const filtered = fallback.filter(c => isUserInChat(user, c));
        onUpdate(filtered.length > 0 ? filtered : fallback);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.warn('Failed to initialize resident chats listener:', err);
    return () => {};
  }
}

export interface SendFriendMessageParams {
  sender: UserProfile;
  recipient: {
    id?: string | number;
    name: string;
    email?: string;
    avatar?: string;
    phone?: string;
    apt?: string;
  };
  body: string;
  subject?: string;
}

export async function sendFriendChatMessage(
  params: SendFriendMessageParams
): Promise<ResidentChat> {
  const { sender, recipient, body, subject } = params;

  const now = Date.now();
  const timeFormatted = formatMessageTime(now);

  const senderIdentifiers = getAllParticipantIdentifiers(sender);
  const recipientIdentifiers = getAllParticipantIdentifiers(recipient);

  const senderKey = senderIdentifiers[1] || senderIdentifiers[0] || 'me';
  const recipientKey = recipientIdentifiers[1] || recipientIdentifiers[0] || 'friend';
  const docId = [senderKey, recipientKey].sort().join('_vs_');

  const newMessage: ResidentChatMessage = {
    id: `msg_${now}_${Math.random().toString(36).slice(2, 7)}`,
    senderId: senderKey,
    senderName: sender.name || 'Resident',
    senderRole: 'Resident',
    senderAvatar: sender.avatar_url || sender.avatarUrl || '',
    body: body.trim(),
    createdAt: now,
    time: timeFormatted,
  };

  const senderParticipant: ResidentChatParticipant = {
    id: senderKey,
    name: sender.name || 'Resident',
    email: sender.email || '',
    avatar: sender.avatar_url || sender.avatarUrl || '',
    phone: sender.phone || '',
    apt: sender.address || '',
  };

  const recipientParticipant: ResidentChatParticipant = {
    id: recipientKey,
    name: recipient.name || 'Resident',
    email: recipient.email || '',
    avatar: recipient.avatar || '',
    phone: recipient.phone || '',
    apt: recipient.apt || '',
  };

  const participantIds = Array.from(
    new Set([...senderIdentifiers, ...recipientIdentifiers].filter(Boolean))
  );

  // 1. Immediately update local cache
  const existingLocal = loadLocalChats();
  const existingChatIdx = existingLocal.findIndex(c => c.id === docId);
  const updatedMessages = existingChatIdx >= 0
    ? [...(existingLocal[existingChatIdx].messages || []), newMessage]
    : [newMessage];

  const updatedChat: ResidentChat = {
    id: docId,
    participantIds,
    participants: [senderParticipant, recipientParticipant],
    subject: subject?.trim() || existingLocal[existingChatIdx]?.subject || 'Conversation',
    lastMessage: `${sender.name || 'You'}: ${body.trim()}`,
    updatedAt: now,
    unreadBy: [recipientKey],
    messages: updatedMessages,
  };

  if (existingChatIdx >= 0) {
    existingLocal[existingChatIdx] = updatedChat;
  } else {
    existingLocal.unshift(updatedChat);
  }
  saveLocalChats(existingLocal);

  // 2. Persist to Firestore
  if (isFirebaseConfigured() && db) {
    try {
      const docRef = doc(db, 'resident_chats', docId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const cloudData = snap.data() as ResidentChat;
        const msgMap = new Map<string, ResidentChatMessage>();
        (cloudData.messages || []).forEach(m => msgMap.set(m.id, m));
        updatedMessages.forEach(m => msgMap.set(m.id, m));
        const mergedMessages = Array.from(msgMap.values());
        mergedMessages.sort((a, b) => a.createdAt - b.createdAt);

        await setDoc(
          docRef,
          {
            ...updatedChat,
            messages: mergedMessages,
            participantIds: Array.from(new Set([...(cloudData.participantIds || []), ...participantIds])),
          },
          { merge: true }
        );
      } else {
        await setDoc(docRef, updatedChat);
      }
    } catch (error) {
      console.warn('Unable to sync resident chat to Firestore (cached locally):', error);
    }
  }

  return updatedChat;
}

export async function markFriendChatRead(
  chatId: string,
  user: UserProfile | null | undefined
): Promise<void> {
  const myIds = getAllParticipantIdentifiers(user);

  // Update local
  const local = loadLocalChats();
  const target = local.find(c => c.id === chatId);
  if (target && target.unreadBy) {
    target.unreadBy = target.unreadBy.filter(u => !myIds.includes(u.toLowerCase()));
    saveLocalChats(local);
  }

  if (!isFirebaseConfigured() || !db) return;
  try {
    const docRef = doc(db, 'resident_chats', chatId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as ResidentChat;
      const unreadBy = (data.unreadBy || []).filter(
        u => !myIds.includes(u.toLowerCase())
      );
      await updateDoc(docRef, { unreadBy });
    }
  } catch {
    // ignore
  }
}

export async function deleteFriendChat(chatId: string): Promise<boolean> {
  // Delete from local
  const local = loadLocalChats().filter(c => c.id !== chatId);
  saveLocalChats(local);

  if (!isFirebaseConfigured() || !db) return true;
  try {
    const docRef = doc(db, 'resident_chats', chatId);
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    console.warn('Unable to delete resident chat doc:', err);
    return false;
  }
}
