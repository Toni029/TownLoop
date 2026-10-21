import {sendMarketInquiry, mutateMarketChat} from "../../../src/services/marketplaceChatProtocol";
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
// Both clients use the same UID-only, transactional Marketplace protocol.
export async function inquire(itemId: string, text: string, includeContact: boolean, messageId = newSocialId()) {
  return runSocial(`inquiry:${itemId}`, async () => {
    const user = await approvedUser();
    return sendMarketInquiry(db, String(user.id), itemId, text, messageId, includeContact);
  });
}
export async function changeChat(id: string, action: "reply" | "read" | "leave", text = "", messageId = newSocialId()) {
  return runSocial(`chat:${id}:${action}`, async () => {
    const user = await approvedUser();
    await mutateMarketChat(db, String(user.id), id, action, text, messageId);
  });
}
