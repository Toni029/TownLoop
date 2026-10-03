import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import type {
  MediaAttachment,
  CommentItem,
  UserProfile,
} from "../../../src/types";
import { canDeleteAnyPost } from "../../../src/utils/permissions";
import { db } from "../lib/firebase";
import { approvedUser } from "../news/actions";
import { singleFlight } from "../news/model";
import {
  readPost,
  readListing,
  owns,
  appendComment,
  formatPrice,
  readChat,
  chatSide,
  hasLeft,
  cleanChatId,
} from "./model";
export type SocialKind = "post" | "listing";
const collectionFor = (kind: SocialKind) =>
  kind === "post" ? "discussion_feed" : "marketplace_posts";
export const runSocial = singleFlight();
export const newSocialId = () => doc(collection(db, "discussion_feed")).id;
const avatar = (user: UserProfile) =>
  user.avatarUrl || user.avatar_url || user.avatar || "";
export async function publishSocial(
  id: string,
  kind: SocialKind,
  draft: {
    title: string;
    description: string;
    price: string;
    media: MediaAttachment[];
  },
) {
  return runSocial(`publish:${id}`, async () => {
    if (!draft.title.trim() || !draft.description.trim())
      throw Error("Please provide a title and description.");
    const user = await approvedUser();
    const reference = doc(db, collectionFor(kind), id);
    await runTransaction(db, async (tx) => {
      if ((await tx.get(reference)).exists()) return;
      const base = {
        title: draft.title.trim(),
        createdAt: serverTimestamp(),
        userId: String(user.id),
        author: user.name,
        authorAvatar: avatar(user),
        authorEmail: user.email,
        unit:
          user.address ||
          user.apartmentNumber ||
          user.unit ||
          "TownLoop Resident",
        media: draft.media,
        mediaUrl: draft.media[0]?.url || "",
        comments: [],
        timeAgo: "Just now",
      };
      tx.set(
        reference,
        kind === "post"
          ? {
              ...base,
              content: draft.description.trim(),
              tag: "Community",
              likes: 0,
            }
          : {
              ...base,
              description: draft.description.trim(),
              price: formatPrice(draft.price),
              sold: false,
              claimed: false,
            },
      );
    });
  });
}
export async function changeSocial(
  id: string,
  kind: SocialKind,
  action: "delete" | "sold" | "comment" | "like",
  payload: {
    text?: string;
    commentId?: string;
    liked?: boolean;
    sold?: boolean;
  } = {},
) {
  return runSocial(`${kind}:${id}`, async () => {
    const user = await approvedUser();
    const reference = doc(db, collectionFor(kind), id);
    const commentId = payload.commentId || newSocialId();
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(reference);
      if (!snap.exists()) throw Error("This item is no longer available.");
      const item =
        kind === "post"
          ? readPost(id, snap.data())
          : readListing(id, snap.data());
      if (action === "delete") {
        if (!owns(item, user) && !canDeleteAnyPost(user))
          throw Error(
            "Only the author, administrators and VIP residents can delete this item.",
          );
        tx.delete(reference);
        return;
      }
      if (action === "sold") {
        if (kind !== "listing" || !owns(item, user))
          throw Error("Only the seller can change availability.");
        tx.update(reference, { sold: !!payload.sold, claimed: !!payload.sold });
        return;
      }
      if (action === "like") {
        if (kind !== "post")
          throw Error("Only discussion posts have reactions.");
        tx.update(reference, {
          likes: Math.max(
            0,
            ("likes" in item ? item.likes : 0) + (payload.liked ? 1 : -1),
          ),
        });
        return;
      }
      if (!payload.text?.trim()) throw Error("Please enter a comment.");
      const comment: CommentItem = {
        id: commentId,
        author: user.name,
        authorId: String(user.id),
        authorEmail: user.email,
        authorAvatar: avatar(user),
        unit: user.address || user.unit || "TownLoop Resident",
        text: payload.text.trim(),
        timeAgo: "Just now",
      };
      tx.update(reference, {
        comments: appendComment(item.comments || [], comment),
      });
    });
  });
}
const messageFor = (user: UserProfile, text: string, id: string) => ({
  id,
  senderId: String(user.id),
  senderName: user.name,
  senderAvatar: avatar(user),
  text,
  timestamp: new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }),
  createdAt: Date.now(),
});
export async function inquire(
  itemId: string,
  text: string,
  includeContact: boolean,
  messageId = newSocialId(),
) {
  return runSocial(`inquiry:${itemId}`, async () => {
    if (!text.trim()) throw Error("Please enter a message.");
    const user = await approvedUser();
    const id = `mkt_${cleanChatId(itemId)}_${cleanChatId(user.id)}`;
    const reference = doc(db, "marketplace_chats", id);
    await runTransaction(db, async (tx) => {
      const itemSnap = await tx.get(doc(db, "marketplace_posts", itemId));
      const chatSnap = await tx.get(reference);
      if (!itemSnap.exists())
        throw Error("This listing is no longer available.");
      const item = readListing(itemId, itemSnap.data());
      if (item.sold || item.claimed) throw Error("This item has been sold.");
      if (owns(item, user)) throw Error("This is your own listing.");
      if (!item.authorId)
        throw Error(
          "Seller identity is unavailable. Please contact the office.",
        );
      const existing = chatSnap.exists() ? readChat(id, chatSnap.data()) : null;
      if (
        existing &&
        (chatSide(existing, String(user.id)) !== "buyer" ||
          hasLeft(existing, "buyer") ||
          hasLeft(existing, "seller"))
      )
        throw Error("This conversation has closed.");
      const contact = [
        user.name,
        user.address || user.wing,
        user.phone ? `Phone: ${user.phone}` : "",
      ]
        .filter(Boolean)
        .join(" • ");
      const msg = messageFor(
        user,
        text.trim() + (includeContact ? `\n\n— ${contact}` : ""),
        messageId,
      );
      if (existing?.messages.some((m) => m.id === messageId)) return;
      tx.set(reference, {
        ...(existing || {}),
        id,
        itemId,
        itemTitle: item.title,
        itemPrice: item.price,
        itemMediaUrl: item.media?.[0]?.url || item.mediaUrl || "",
        sellerId: String(item.authorId),
        sellerName: item.author,
        sellerAvatar: item.authorAvatar || "",
        sellerApt: item.unit,
        buyerId: String(user.id),
        buyerName: user.name,
        buyerAvatar: avatar(user),
        buyerApt: user.address || user.apartmentNumber || "Resident",
        participantIds: [cleanChatId(item.authorId), cleanChatId(user.id)],
        lastMessage: msg.text,
        lastMessageTime: msg.timestamp,
        updatedAt: msg.createdAt,
        unreadForSeller: true,
        unreadForBuyer: false,
        messages: [...(existing?.messages || []), msg],
      });
    });
    return id;
  });
}
export async function changeChat(
  id: string,
  action: "reply" | "read" | "leave",
  text = "",
  messageId = newSocialId(),
) {
  return runSocial(`chat:${id}:${action}`, async () => {
    const user = await approvedUser();
    const reference = doc(db, "marketplace_chats", id);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(reference);
      if (!snap.exists()) {
        if (action === "read") return;
        throw Error("This conversation is no longer available.");
      }
      const chat = readChat(id, snap.data());
      const side = chatSide(chat, String(user.id));
      if (!side) throw Error("You are not a participant in this conversation.");
      const other = side === "seller" ? "buyer" : "seller";
      if (hasLeft(chat, side)) {
        if (action === "leave" || action === "read") return;
        throw Error("You left this conversation.");
      }
      if (action === "read") {
        tx.update(
          reference,
          side === "seller"
            ? { unreadForSeller: false }
            : { unreadForBuyer: false },
        );
        return;
      }
      if (action === "leave") {
        if (hasLeft(chat, other)) {
          tx.delete(reference);
          return;
        }
        const msg = {
          ...messageFor(user, `${user.name} left the conversation.`, messageId),
          senderId: "system",
          senderName: "System",
          isSystem: true,
        };
        tx.update(reference, {
          ...(side === "seller"
            ? { deletedBySeller: true, sellerLeft: true }
            : { deletedByBuyer: true, buyerLeft: true }),
          deletedBy: [
            ...new Set([...(chat.deletedBy || []), side, cleanChatId(user.id)]),
          ],
          messages: [...chat.messages, msg],
          lastMessage: msg.text,
          lastMessageTime: msg.timestamp,
          updatedAt: msg.createdAt,
        });
        return;
      }
      if (hasLeft(chat, other))
        throw Error("The other participant has left this chat.");
      if (!text.trim()) throw Error("Please enter a reply.");
      if (chat.messages.some((m) => m.id === messageId)) return;
      const msg = messageFor(user, text.trim(), messageId);
      tx.update(reference, {
        messages: [...chat.messages, msg],
        lastMessage: msg.text,
        lastMessageTime: msg.timestamp,
        updatedAt: msg.createdAt,
        unreadForBuyer: side === "seller",
        unreadForSeller: side === "buyer",
      });
    });
  });
}
