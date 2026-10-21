/*
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 * Proprietary and Confidential.
 * Unauthorized copying, distribution, or modification of this source code,
 * via any medium, is strictly prohibited.
 */
// Marketplace conversations are server-authoritative and scoped to exact Firebase UIDs.
import { doc, getDoc, getDocFromServer, onSnapshot } from "firebase/firestore";
import { auth, db, isFirebaseConfigured } from "../firebase";
import type { UserProfile, MarketItem } from "../types";
import {
  marketplaceChatQuery,
  marketSide,
  marketLeft,
  sendMarketInquiry,
  mutateMarketChat,
} from "./marketplaceChatProtocol";
import type { MarketplaceChat } from "./marketplaceChatTypes";
import { recoverCachedMarketMessages } from './marketplaceChatRecovery';
import type { DraftStorage } from './marketplaceChatRecovery';
export type {
  MarketplaceChat,
  MarketplaceChatMessage,
} from "./marketplaceChatTypes";

function signedInUid(expected?: UserProfile | null) {
  const uid = auth?.currentUser?.uid;
  if (!db || !uid || (expected && String(expected.id) !== uid))
    throw Error("Please sign in again.");
  return uid;
}
export function isUserInMarketplaceChat(
  user: UserProfile | null | undefined,
  chat: MarketplaceChat,
) {
  if (!user) return false;
  const side = marketSide(chat, String(user.id));
  return !!side && !marketLeft(chat, side);
}
export async function sendMarketplaceInquiry({
  item,
  buyer,
  messageText,
  messageId,
}: {
  item: MarketItem;
  buyer: UserProfile;
  messageText: string;
  messageId?: string;
}) {
  const uid = signedInUid(buyer);
  const id = await sendMarketInquiry(
    db!,
    uid,
    String(item.id),
    messageText,
    messageId || `mmsg_${crypto.randomUUID()}`,
  );
  signedInUid(buyer);
  const snapshot = await getDoc(doc(db!, 'marketplace_chats', id));
  signedInUid(buyer);
  return { ...snapshot.data(), id } as MarketplaceChat;
}
export async function sendMarketplaceReply({
  chat,
  sender,
  text,
  messageId,
}: {
  chat: MarketplaceChat;
  sender: UserProfile;
  text: string;
  messageId?: string;
}) {
  const uid = signedInUid(sender);
  await mutateMarketChat(
    db!,
    uid,
    chat.id,
    "reply",
    text,
    messageId || `mmsg_${crypto.randomUUID()}`,
  );
  signedInUid(sender);
  const snapshot = await getDoc(doc(db!, 'marketplace_chats', chat.id));
  signedInUid(sender);
  return { ...snapshot.data(), id: chat.id } as MarketplaceChat;
}
export async function markMarketplaceChatRead(
  chatId: string,
  _isSeller: boolean,
) {
  // Derive the side from the actual server document, not the caller's UI flag.
  await mutateMarketChat(db!, signedInUid(), chatId, "read");
}
export async function deleteMarketplaceChat(
  chatId: string,
  user?: UserProfile | null,
): Promise<boolean> {
  await mutateMarketChat(db!, signedInUid(user), chatId, "leave");
  return true;
}
export function subscribeMarketplaceChats(
  currentUser: UserProfile | null | undefined,
  onChatsUpdate: (chats: MarketplaceChat[]) => void,
): () => void {
  onChatsUpdate([]); // Never display another session's cached private conversations.
  // Preserve the old unscoped archive verbatim. Never merge it into live history.
  if (
    !currentUser ||
    currentUser.approved !== true ||
    !isFirebaseConfigured() ||
    !db ||
    auth?.currentUser?.uid !== String(currentUser.id)
  )
    return () => {};
  const uid = auth.currentUser.uid;
  return onSnapshot(
    marketplaceChatQuery(db, uid),
    (snapshot) => {
      if (auth?.currentUser?.uid !== uid) {
        onChatsUpdate([]);
        return;
      }
      const chats = snapshot.docs.map(
        (d) => ({ ...d.data(), id: d.id }) as MarketplaceChat,
      );
      onChatsUpdate(
        chats
          .filter((c) => isUserInMarketplaceChat(currentUser, c))
          .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)),
      );
    },
    () => {
      onChatsUpdate([]);
      console.warn(
        "Marketplace conversations could not be loaded. Check your account access or connection.",
      );
    },
  );
}

/** Explicit user action only; check a fresh server document before reading local text. */
export async function recoverMarketplaceDrafts(chatId: string, user: UserProfile, storage: DraftStorage) {
  const uid = signedInUid(user);
  if (user.approved !== true) throw Error('An approved account is required.');
  const snapshot = await getDocFromServer(doc(db!, 'marketplace_chats', chatId));
  if (!snapshot.exists() || auth?.currentUser?.uid !== uid)
    throw Error('This conversation is not available.');
  const server = { ...snapshot.data(), id: snapshot.id } as MarketplaceChat;
  if (!marketSide(server, uid)) throw Error('This conversation is not available.');
  return recoverCachedMarketMessages(storage, server, uid);
}
