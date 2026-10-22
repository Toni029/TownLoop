import {
  collection,
  doc,
  getDoc,
  getDocFromServer,
  or,
  query,
  runTransaction,
  where,
  type Firestore,
  type DocumentReference,
  type Transaction,
} from "firebase/firestore";
import type { UserProfile } from "../types";
import { marketLeft } from './marketplaceChatIdentity';
export { marketLeft } from './marketplaceChatIdentity';
import type {
  MarketplaceChat,
  MarketplaceChatMessage,
} from "./marketplaceChatTypes";

/** Canonical UIDs only. Sanitization is used for legacy document IDs, never authorization. */
export const marketChatId = (itemId: string, buyerId: string) =>
  `mkt_${clean(itemId)}_${clean(buyerId)}`;
const clean = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-zA-Z0-9_-]/g, "_");
export const marketplaceChatQuery = (db: Firestore, uid: string) =>
  query(
    collection(db, "marketplace_chats"),
    or(where("sellerId", "==", uid), where("buyerId", "==", uid)),
  );
export const marketSide = (chat: MarketplaceChat, uid: string) =>
  chat.sellerId === uid ? "seller" : chat.buyerId === uid ? "buyer" : null;

async function profile(db: Firestore, uid: string) {
  const snapshot = await getDoc(doc(db, "users", uid));
  const value = snapshot.data();
  if (
    !value ||
    value.approved !== true ||
    !["resident", "admin", "vip", "crew"].includes(value.role)
  )
    throw Error("An approved TownLoop account is required.");
  return {
    ...value,
    id: uid,
    name: typeof value.name === "string" ? value.name : "Resident",
  } as UserProfile & { id: string; name: string };
}
function message(
  user: Awaited<ReturnType<typeof profile>>,
  text: string,
  id: string,
): MarketplaceChatMessage {
  if (!text.trim() || text.length > 10000)
    throw Error("Enter a message of up to 10,000 characters.");
  const now = Date.now();
  return {
    id,
    senderId: user.id,
    senderName: user.name,
    senderAvatar: user.avatarUrl || user.avatar_url || "",
    text: text.trim(),
    timestamp: new Date(now).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }),
    createdAt: now,
  };
}
const summary = (msg: MarketplaceChatMessage) => ({
  lastMessage: msg.text,
  lastMessageTime: msg.timestamp,
  updatedAt: msg.createdAt!,
});

// A strict append rule can reject a stale optimistic transaction before the SDK
// reports ABORTED. Retry only when a server read proves another append won.
async function marketTransaction<T>(
  db: Firestore,
  ref: DocumentReference,
  action: (
    tx: Transaction,
    observed: (chat?: MarketplaceChat) => void,
  ) => Promise<T>,
) {
  for (let attempt = 0; ; attempt++) {
    let beforeCount = -2;
    try {
      return await runTransaction(db, (tx) =>
        action(tx, (chat) => {
          beforeCount = chat ? chat.messages.length : -1;
        }),
      );
    } catch (error) {
      if (
        (error as { code?: string }).code === "permission-denied" &&
        attempt < 2 &&
        beforeCount >= -1
      ) {
        const latest = await getDocFromServer(ref);
        if (
          latest.exists() &&
          Array.isArray(latest.data().messages) &&
          latest.data().messages.length > beforeCount
        )
          continue;
      }
      throw error;
    }
  }
}

export async function sendMarketInquiry(
  db: Firestore,
  uid: string,
  itemId: string,
  text: string,
  messageId: string,
  includeContact = false,
) {
  const user = await profile(db, uid);
  const contact = [
    user.name,
    user.address || "",
    user.phone ? `Phone: ${user.phone}` : "",
  ]
    .filter(Boolean)
    .join(" • ");
  const msg = message(
    user,
    text + (includeContact ? `\n\n— ${contact}` : ""),
    messageId,
  );
  const id = marketChatId(itemId, uid),
    ref = doc(db, "marketplace_chats", id);
  await marketTransaction(db, ref, async (tx, observed) => {
    const [itemSnap, chatSnap] = await Promise.all([
      tx.get(doc(db, "marketplace_posts", itemId)),
      tx.get(ref),
    ]);
    observed(
      chatSnap.exists() ? (chatSnap.data() as MarketplaceChat) : undefined,
    );
    const item = itemSnap.data();
    if (!item || item.sold || item.claimed)
      throw Error("This listing is no longer available.");
    const sellerId = item.userId || item.authorId;
    if (typeof sellerId !== "string" || !sellerId || sellerId === uid)
      throw Error("A verified seller account is required.");
    const sellerSnap = await tx.get(doc(db, "resident_directory", sellerId)),
      seller = sellerSnap.data();
    if (
      !seller ||
      seller.approved !== true ||
      !["resident", "admin", "vip", "crew"].includes(seller.role)
    )
      throw Error("The seller account is unavailable.");
    if (chatSnap.exists()) {
      const chat = chatSnap.data() as MarketplaceChat;
      if (
        chat.buyerId !== uid ||
        chat.sellerId !== sellerId ||
        chat.itemId !== itemId ||
        marketLeft(chat, "buyer") ||
        marketLeft(chat, "seller")
      )
        throw Error(
          "This conversation is closed or requires an identity review by the office.",
        );
      if (chat.messages.some((m) => m.id === messageId)) return;
      tx.update(ref, {
        messages: [...chat.messages, msg],
        ...summary(msg),
        unreadForSeller: true,
        unreadForBuyer: false,
      });
    } else {
      tx.set(ref, {
        id,
        itemId,
        itemTitle: item.title || "",
        itemPrice: String(item.price ?? "FREE"),
        itemMediaUrl: item.media?.[0]?.url || item.mediaUrl || "",
        sellerId,
        sellerName: seller.name || "Resident",
        sellerAvatar: seller.avatarUrl || seller.avatar_url || "",
        sellerApt: seller.address || "",
        buyerId: uid,
        buyerName: user.name,
        buyerAvatar: user.avatarUrl || user.avatar_url || "",
        buyerApt: user.address || "",
        participantIds: [sellerId, uid],
        messages: [msg],
        ...summary(msg),
        unreadForSeller: true,
        unreadForBuyer: false,
      });
    }
  });
  return id;
}
export async function mutateMarketChat(
  db: Firestore,
  uid: string,
  id: string,
  action: "reply" | "read" | "leave",
  text = "",
  messageId = doc(collection(db, "marketplace_chats")).id,
) {
  const user = await profile(db, uid),
    ref = doc(db, "marketplace_chats", id);
  await marketTransaction(db, ref, async (tx, observed) => {
    const snapshot = await tx.get(ref);
    observed(
      snapshot.exists() ? (snapshot.data() as MarketplaceChat) : undefined,
    );
    if (!snapshot.exists()) {
      if (action === "read" || action === "leave") return;
      throw Error("This conversation is no longer available.");
    }
    const chat = snapshot.data() as MarketplaceChat,
      side = marketSide(chat, uid);
    if (!side) throw Error("You are not a participant in this conversation.");
    const other = side === "seller" ? "buyer" : "seller";
    if (action === "read") {
      tx.update(
        ref,
        side === "seller"
          ? { unreadForSeller: false }
          : { unreadForBuyer: false },
      );
      return;
    }
    if (marketLeft(chat, side)) {
      if (action === "leave") return;
      throw Error("You left this conversation.");
    }
    if (action === "leave") {
      // Leaving hides only this side. Keep participants and all history even if both leave.
      const msg = {
        ...message(user, `${user.name} left the conversation.`, messageId),
        senderId: "system",
        senderName: "System",
        isSystem: true,
        actorId: uid,
      };
      tx.update(ref, {
        ...(side === "seller"
          ? { deletedBySeller: true, sellerLeft: true }
          : { deletedByBuyer: true, buyerLeft: true }),
        messages: [...chat.messages, msg],
        ...summary(msg),
      });
      return;
    }
    if (marketLeft(chat, other))
      throw Error("The other participant has left this chat.");
    if (chat.messages.some((m) => m.id === messageId)) return;
    const msg = message(user, text, messageId);
    tx.update(ref, {
      messages: [...chat.messages, msg],
      ...summary(msg),
      unreadForBuyer: side === "seller",
      unreadForSeller: side === "buyer",
    });
  });
}
