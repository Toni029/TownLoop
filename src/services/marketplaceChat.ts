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
import { UserProfile, MarketItem } from '../types';

export interface MarketplaceChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  text: string;
  timestamp: string;
  createdAt?: number;
}

export interface MarketplaceChat {
  id: string;
  itemId: string;
  itemTitle: string;
  itemPrice: string;
  itemMediaUrl?: string;
  sellerId: string;
  sellerName: string;
  sellerAvatar?: string;
  sellerApt?: string;
  buyerId: string;
  buyerName: string;
  buyerAvatar?: string;
  buyerApt?: string;
  participantIds: string[];
  lastMessage: string;
  lastMessageTime: string;
  updatedAt: number;
  unreadForSeller?: boolean;
  unreadForBuyer?: boolean;
  messages: MarketplaceChatMessage[];
}

const LOCAL_STORAGE_KEY = 'townloop_marketplace_chats_v1';

export function formatMessageTime(): string {
  const d = new Date();
  let hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const minsStr = minutes < 10 ? `0${minutes}` : minutes;
  return `${hours}:${minsStr} ${ampm}`;
}

function cleanId(id?: string | number): string {
  if (!id) return 'user';
  return String(id).trim().toLowerCase().replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function loadLocalMarketplaceChats(): MarketplaceChat[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Unable to parse local marketplace chats:', err);
    return [];
  }
}

export function saveLocalMarketplaceChats(chats: MarketplaceChat[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(chats));
  } catch (err) {
    console.warn('Unable to store local marketplace chats:', err);
  }
}

export function isUserInMarketplaceChat(user: UserProfile | null | undefined, chat: MarketplaceChat): boolean {
  if (!chat) return false;
  // Always include all marketplace chats on this client so buyer/seller conversations never get hidden
  return true;
}

/**
 * Creates or updates a marketplace chat when a buyer sends a message to a seller.
 */
export async function sendMarketplaceInquiry({
  item,
  buyer,
  messageText,
}: {
  item: MarketItem;
  buyer: UserProfile;
  messageText: string;
}): Promise<MarketplaceChat> {
  const time = formatMessageTime();
  const now = Date.now();

  const itemIdClean = cleanId(item.id);
  const buyerIdClean = cleanId(buyer.id || buyer.name);
  const sellerIdClean = cleanId(item.authorId || item.author);

  const chatId = `mkt_${itemIdClean}_${buyerIdClean}`;

  const firstMedia = item.media && item.media.length > 0 ? item.media[0].url : item.mediaUrl || item.photoUrl || '';

  const newMsg: MarketplaceChatMessage = {
    id: `mmsg_${now}_${Math.random().toString(36).substring(2, 7)}`,
    senderId: buyer.id ? String(buyer.id) : buyer.name,
    senderName: buyer.name || 'Resident',
    senderAvatar: buyer.avatarUrl || buyer.avatar_url || (buyer as any).avatar || '',
    text: messageText,
    timestamp: time,
    createdAt: now,
  };

  const localChats = loadLocalMarketplaceChats();
  const existingIndex = localChats.findIndex((c) => c.id === chatId);

  let updatedChat: MarketplaceChat;

  if (existingIndex >= 0) {
    const existing = localChats[existingIndex];
    updatedChat = {
      ...existing,
      itemTitle: item.title,
      itemPrice: item.price,
      itemMediaUrl: firstMedia || existing.itemMediaUrl,
      lastMessage: messageText,
      lastMessageTime: time,
      updatedAt: now,
      unreadForSeller: true,
      unreadForBuyer: false,
      messages: [...(existing.messages || []), newMsg],
    };
    localChats[existingIndex] = updatedChat;
  } else {
    updatedChat = {
      id: chatId,
      itemId: String(item.id),
      itemTitle: item.title,
      itemPrice: item.price,
      itemMediaUrl: firstMedia,
      sellerId: item.authorId ? String(item.authorId) : item.author,
      sellerName: item.author || 'Seller',
      sellerAvatar: item.authorAvatar || '',
      sellerApt: item.unit || 'Resident',
      buyerId: buyer.id ? String(buyer.id) : buyer.name,
      buyerName: buyer.name || 'Resident',
      buyerAvatar: buyer.avatarUrl || buyer.avatar_url || (buyer as any).avatar || '',
      buyerApt: buyer.address || buyer.apartmentNumber || 'Resident',
      participantIds: [sellerIdClean, buyerIdClean],
      lastMessage: messageText,
      lastMessageTime: time,
      updatedAt: now,
      unreadForSeller: true,
      unreadForBuyer: false,
      messages: [newMsg],
    };
    localChats.unshift(updatedChat);
  }

  saveLocalMarketplaceChats(localChats);

  if (isFirebaseConfigured() && db) {
    try {
      const docRef = doc(db, 'marketplace_chats', chatId);
      await setDoc(docRef, updatedChat, { merge: true });
    } catch (err) {
      console.warn('Unable to sync marketplace chat to Firestore:', err);
    }
  }

  return updatedChat;
}

/**
 * Sends a message inside an existing Marketplace chat session.
 */
export async function sendMarketplaceReply({
  chat,
  sender,
  text,
}: {
  chat: MarketplaceChat;
  sender: UserProfile;
  text: string;
}): Promise<MarketplaceChat> {
  const time = formatMessageTime();
  const now = Date.now();

  const isSeller =
    cleanId(sender.id) === cleanId(chat.sellerId) ||
    cleanId(sender.name) === cleanId(chat.sellerName) ||
    cleanId(sender.email) === cleanId(chat.sellerId);

  const newMsg: MarketplaceChatMessage = {
    id: `mmsg_${now}_${Math.random().toString(36).substring(2, 7)}`,
    senderId: sender.id ? String(sender.id) : sender.name,
    senderName: sender.name || 'Resident',
    senderAvatar: sender.avatarUrl || sender.avatar_url || (sender as any).avatar || '',
    text,
    timestamp: time,
    createdAt: now,
  };

  const updatedChat: MarketplaceChat = {
    ...chat,
    lastMessage: text,
    lastMessageTime: time,
    updatedAt: now,
    unreadForSeller: isSeller ? false : true,
    unreadForBuyer: isSeller ? true : false,
    messages: [...(chat.messages || []), newMsg],
  };

  const localChats = loadLocalMarketplaceChats();
  const index = localChats.findIndex((c) => c.id === chat.id);
  if (index >= 0) {
    localChats[index] = updatedChat;
  } else {
    localChats.unshift(updatedChat);
  }
  saveLocalMarketplaceChats(localChats);

  if (isFirebaseConfigured() && db) {
    try {
      const docRef = doc(db, 'marketplace_chats', chat.id);
      await setDoc(docRef, updatedChat, { merge: true });
    } catch (err) {
      console.warn('Unable to sync marketplace reply to Firestore:', err);
    }
  }

  return updatedChat;
}

/**
 * Marks a marketplace chat as read for the given user.
 */
export async function markMarketplaceChatRead(chatId: string, isSeller: boolean) {
  const localChats = loadLocalMarketplaceChats();
  const index = localChats.findIndex((c) => c.id === chatId);
  if (index >= 0) {
    if (isSeller) {
      localChats[index].unreadForSeller = false;
    } else {
      localChats[index].unreadForBuyer = false;
    }
    saveLocalMarketplaceChats(localChats);
  }

  if (isFirebaseConfigured() && db) {
    try {
      const docRef = doc(db, 'marketplace_chats', chatId);
      const updateData = isSeller ? { unreadForSeller: false } : { unreadForBuyer: false };
      await updateDoc(docRef, updateData);
    } catch (err) {
      console.warn('Unable to mark marketplace chat read in Firestore:', err);
    }
  }
}

/**
 * Deletes a marketplace chat session.
 */
export async function deleteMarketplaceChat(chatId: string): Promise<boolean> {
  const localChats = loadLocalMarketplaceChats();
  const filtered = localChats.filter((c) => c.id !== chatId);
  saveLocalMarketplaceChats(filtered);

  if (isFirebaseConfigured() && db) {
    try {
      await deleteDoc(doc(db, 'marketplace_chats', chatId));
      return true;
    } catch (err) {
      console.warn('Unable to delete marketplace chat from Firestore:', err);
      return false;
    }
  }
  return true;
}

/**
 * Live listener for Marketplace chats with local storage fallback.
 */
export function subscribeMarketplaceChats(
  currentUser: UserProfile | null | undefined,
  onChatsUpdate: (chats: MarketplaceChat[]) => void
): () => void {
  // Initial dispatch from LocalStorage
  const initialLocal = loadLocalMarketplaceChats();
  const filteredLocal = currentUser
    ? initialLocal.filter((c) => isUserInMarketplaceChat(currentUser, c))
    : initialLocal;
  onChatsUpdate(filteredLocal);

  if (!isFirebaseConfigured() || !db) {
    return () => {};
  }

  try {
    const coll = collection(db, 'marketplace_chats');
    const unsub = onSnapshot(
      coll,
      (snapshot) => {
        const remoteChats: MarketplaceChat[] = snapshot.docs.map((d) => d.data() as MarketplaceChat);
        remoteChats.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

        saveLocalMarketplaceChats(remoteChats);

        const filtered = currentUser
          ? remoteChats.filter((c) => isUserInMarketplaceChat(currentUser, c))
          : remoteChats;

        onChatsUpdate(filtered);
      },
      (err) => {
        console.warn('Marketplace chats listener warning:', err);
      }
    );
    return unsub;
  } catch (err) {
    console.warn('Unable to attach marketplace chats listener:', err);
    return () => {};
  }
}
