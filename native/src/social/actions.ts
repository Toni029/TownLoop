import {refreshBadge} from '../notifications/device';
import { mutateSocial } from "../../../src/services/socialIntegrity";
import {sendMarketInquiry, mutateMarketChat} from "../../../src/services/marketplaceChatProtocol";
import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import type {
  MediaAttachment,
  UserProfile,
} from "../../../src/types";
import { db } from "../lib/firebase";
import { approvedUser } from "../news/actions";
import { singleFlight } from "../news/model";
import {
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
      const previous = await tx.get(reference);
      if (previous.exists() && previous.data().storageDraft !== true) return;
      if (previous.exists() && previous.data().userId !== String(user.id)) throw Error('Draft ownership does not match.');
      const base = {
        storageDraft: false,
        title: draft.title.trim(),
        createdAt: serverTimestamp(),
        userId: String(user.id),
        author: user.name,
        authorAvatar: avatar(user),
        authorEmail: '',
        unit: "TownLoop Resident",
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
              likedBy: {},
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
    replyToCommentId?: string;
    liked?: boolean;
    sold?: boolean;
  } = {},
) {
  return runSocial(`${kind}:${id}`, async () => {
    const user = await approvedUser();
    await mutateSocial(db, String(user.id), collectionFor(kind), id, action, payload);
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
    if(action==='read')void refreshBadge(String(user.id),{category:'marketplace',conversationId:id}).catch(()=>{});
  });
}
