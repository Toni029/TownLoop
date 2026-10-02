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
  isSystem?: boolean;
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
  deletedByBuyer?: boolean;
  deletedBySeller?: boolean;
  buyerLeft?: boolean;
  sellerLeft?: boolean;
  deletedBy?: string[];
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

const DELETED_CHATS_PREFIX = 'townloop_deleted_mkt_chats_';

export function getLocalDeletedChatIds(userId?: string | null): Set<string> {
  if (!userId) return new Set();
  const clean = cleanId(userId);
  try {
    const raw = localStorage.getItem(`${DELETED_CHATS_PREFIX}${clean}`);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

export function addLocalDeletedChatId(chatId: string, userId?: string | null) {
  if (!userId) return;
  const clean = cleanId(userId);
  try {
    const existing = getLocalDeletedChatIds(userId);
    existing.add(chatId);
    localStorage.setItem(`${DELETED_CHATS_PREFIX}${clean}`, JSON.stringify(Array.from(existing)));
  } catch (err) {
    console.warn('Failed to save local deleted chat id:', err);
  }
}

export function isUserInMarketplaceChat(user: UserProfile | null | undefined, chat: MarketplaceChat): boolean {
  if (!chat) return false;
  if (!user) return true;

  const userClean = cleanId(user.id || user.name);
  const userNameLower = (user.name || '').toLowerCase().trim();

  // Check if current user has personally deleted/left this chat locally
  const localDeleted = getLocalDeletedChatIds(user.id ? String(user.id) : user.name);
  if (localDeleted.has(chat.id)) {
    return false;
  }

  const isSeller =
    userClean === cleanId(chat.sellerId) ||
    (userNameLower && userNameLower === (chat.sellerName || '').toLowerCase().trim());

  const isBuyer =
    userClean === cleanId(chat.buyerId) ||
    (userNameLower && userNameLower === (chat.buyerName || '').toLowerCase().trim());

  // If user is the seller, only hide if the SELLER deleted/left the chat
  if (isSeller) {
    if (
      chat.deletedBySeller ||
      chat.sellerLeft ||
      (chat.deletedBy && (chat.deletedBy.includes('seller') || chat.deletedBy.includes(userClean) || chat.deletedBy.includes(cleanId(chat.sellerId))))
    ) {
      return false;
    }
    return true;
  }

  // If user is the buyer, only hide if the BUYER deleted/left the chat
  if (isBuyer) {
    if (
      chat.deletedByBuyer ||
      chat.buyerLeft ||
      (chat.deletedBy && (chat.deletedBy.includes('buyer') || chat.deletedBy.includes(userClean) || chat.deletedBy.includes(cleanId(chat.buyerId))))
    ) {
      return false;
    }
    return true;
  }

  // If user is neither seller nor buyer (e.g. general viewer)
  if (chat.deletedBy && (chat.deletedBy.includes(userClean) || (userNameLower && chat.deletedBy.includes(userNameLower)))) {
    return false;
  }

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
 * Soft-leaves or permanently deletes a marketplace chat session.
 * First user to tap trashcan leaves (hidden for them, kept for the other party).
 * Second user to tap trashcan permanently deletes from Firestore.
 */
export async function deleteMarketplaceChat(
  chatId: string,
  user?: UserProfile | null
): Promise<boolean> {
  const localChats = loadLocalMarketplaceChats();
  const targetChat = localChats.find((c) => c.id === chatId);

  const userClean = user ? cleanId(user.id || user.name) : 'user';
  const userNameLower = user ? (user.name || '').toLowerCase().trim() : '';

  // Store in local deleted chat ID set so it immediately disappears for this user
  if (user) {
    addLocalDeletedChatId(chatId, user.id ? String(user.id) : user.name);
  }

  const isSeller =
    Boolean(user) &&
    Boolean(targetChat) &&
    (userClean === cleanId(targetChat?.sellerId) ||
      (userNameLower && userNameLower === (targetChat?.sellerName || '').toLowerCase().trim()));

  const isBuyer =
    Boolean(user) &&
    Boolean(targetChat) &&
    (userClean === cleanId(targetChat?.buyerId) ||
      (userNameLower && userNameLower === (targetChat?.buyerName || '').toLowerCase().trim()));

  const leavingUserName = user?.name || (isSeller ? targetChat?.sellerName : targetChat?.buyerName) || 'Resident';

  const systemMsg: MarketplaceChatMessage = {
    id: `sys_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    senderId: 'system',
    senderName: 'System',
    text: `${leavingUserName} left the conversation.`,
    timestamp: formatMessageTime(),
    createdAt: Date.now(),
    isSystem: true,
  };

  const updatedDeletedBy = Array.from(
    new Set([
      ...(targetChat?.deletedBy || []),
      userClean,
      userNameLower,
      isSeller ? 'seller' : 'buyer',
    ])
  );

  // Update local chat object with system message and left flags
  const updatedLocalChats = localChats.map((c) => {
    if (c.id !== chatId) return c;
    return {
      ...c,
      deletedByBuyer: isBuyer ? true : c.deletedByBuyer,
      deletedBySeller: isSeller ? true : c.deletedBySeller,
      buyerLeft: isBuyer ? true : c.buyerLeft,
      sellerLeft: isSeller ? true : c.sellerLeft,
      deletedBy: updatedDeletedBy,
      lastMessage: `${leavingUserName} left the conversation.`,
      lastMessageTime: formatMessageTime(),
      updatedAt: Date.now(),
      messages: [...(c.messages || []), systemMsg],
    };
  });

  saveLocalMarketplaceChats(updatedLocalChats);

  if (isFirebaseConfigured() && db) {
    try {
      const docRef = doc(db, 'marketplace_chats', chatId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return true;
      }

      const remoteData = docSnap.data() as MarketplaceChat;
      const remoteSellerLeft = Boolean(
        remoteData.deletedBySeller ||
        remoteData.sellerLeft ||
        (remoteData.deletedBy && (remoteData.deletedBy.includes('seller') || remoteData.deletedBy.includes(cleanId(remoteData.sellerId))))
      );
      const remoteBuyerLeft = Boolean(
        remoteData.deletedByBuyer ||
        remoteData.buyerLeft ||
        (remoteData.deletedBy && (remoteData.deletedBy.includes('buyer') || remoteData.deletedBy.includes(cleanId(remoteData.buyerId))))
      );

      const remoteDeletedByList = remoteData.deletedBy || [];

      // Check if both parties will have left after this action
      const willBothBeLeft =
        (isSeller && remoteBuyerLeft) ||
        (isBuyer && remoteSellerLeft) ||
        (!isSeller && !isBuyer && remoteDeletedByList.length >= 1) ||
        (remoteSellerLeft && remoteBuyerLeft);

      if (willBothBeLeft) {
        // Both parties left -> hard delete doc completely from Firestore
        await deleteDoc(docRef);
        // Clean out from local chats completely
        saveLocalMarketplaceChats(localChats.filter((c) => c.id !== chatId));
      } else {
        // First party left -> set left flag and append system message for the other party
        const newDeletedBy = Array.from(
          new Set([
            ...remoteDeletedByList,
            userClean,
            userNameLower,
            isSeller ? 'seller' : 'buyer',
          ])
        );

        await updateDoc(docRef, {
          deletedByBuyer: isBuyer ? true : (remoteData.deletedByBuyer || false),
          deletedBySeller: isSeller ? true : (remoteData.deletedBySeller || false),
          buyerLeft: isBuyer ? true : (remoteData.buyerLeft || false),
          sellerLeft: isSeller ? true : (remoteData.sellerLeft || false),
          deletedBy: newDeletedBy,
          lastMessage: `${leavingUserName} left the conversation.`,
          lastMessageTime: formatMessageTime(),
          updatedAt: Date.now(),
          messages: [...(remoteData.messages || []), systemMsg],
        });
      }
      return true;
    } catch (err) {
      console.warn('Unable to delete/leave marketplace chat in Firestore:', err);
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
