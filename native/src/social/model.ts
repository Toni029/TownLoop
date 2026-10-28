import type {
  PostItem,
  MarketItem,
  CommentItem,
  UserProfile,
  MediaAttachment,
} from "../../../src/types";
import { marketLeft } from '../../../src/services/marketplaceChatIdentity';
export type Post = PostItem & { createdAt: number; likedBy: Record<string, boolean> };
export type Listing = MarketItem & { createdAt: number };
export interface Chat {
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
  messages: {
    id: string;
    senderId: string;
    senderName: string;
    senderAvatar?: string;
    text: string;
    timestamp: string;
    createdAt?: number;
    isSystem?: boolean;
  }[];
}
const time = (value: any): number => {
  const seconds = value?.seconds ?? value?._seconds;
  const result = typeof value?.toMillis === "function" ? value.toMillis()
    : typeof value?.getTime === "function" ? value.getTime()
    : typeof seconds === "number" ? seconds * 1000 + (value.nanoseconds ?? value._nanoseconds ?? 0) / 1e6
    : typeof value === "string" ? Number(value) || Date.parse(value)
    : Number(value);
  return Number.isFinite(result) && result > 0 && result <= 8640000000000000 ? result : 0;
};
function postedAt(value: unknown): string {
  const timestamp = time(value);
  return timestamp ? new Date(timestamp).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  }) : "Date unavailable";
}
export function communityResidentLabel(community: string | null): string {
  return community === "cecil_pines" ? "Cecil Pines Resident" : "Community Resident";
}
export function avatar(d: Record<string, any>): string {
  return (
    d.authorAvatar ||
    d.author_avatar ||
    d.avatarUrl ||
    d.avatar_url ||
    d.photoURL ||
    d.avatar ||
    d.userAvatar ||
    ""
  );
}
export function readPerson(id: string, d: Record<string, any>): UserProfile {
  return {
    ...d,
    id,
    name: d.name || d.displayName || "Resident",
    email: d.email || "",
    avatarUrl:
      d.avatarUrl || d.avatar_url || d.avatar || d.photoURL || d.photoUrl || "",
  };
}
export function mediaFor(item: {
  media?: MediaAttachment[];
  mediaUrl?: string;
  photoUrl?: string;
  photos?: string[];
}): MediaAttachment[] {
  if (item.media?.length) return item.media;
  if (item.photos?.length)
    return item.photos.map((url) => ({ type: "image", url }));
  const url = item.mediaUrl || item.photoUrl;
  return url ? [{ type: "image", url }] : [];
}
export function commentsFor(d: Record<string, any>): CommentItem[] {
  return Array.isArray(d.comments)
    ? d.comments.map((c: any) => ({
        ...c,
        authorAvatar: avatar(c),
        authorId: c.authorId || c.userId,
        authorEmail: c.authorEmail || c.email || "",
        text: c.text || "",
        author: c.author || "Resident",
        timeAgo: c.timeAgo || "Recent",
      }))
    : [];
}
export function readPost(id: string, d: Record<string, any>): Post {
  return {
    id,
    author: d.author || "Resident",
    authorAvatar: avatar(d),
    authorId: d.userId || d.authorId || d.uid,
    authorEmail: d.authorEmail || d.email || "",
    unit: d.unit || "TownLoop Resident",
    timeAgo: postedAt(d.createdAt),
    tag: d.tag || "Community",
    title: d.title || "Community Post",
    content: d.content || "",
    mediaUrl: d.mediaUrl,
    media: mediaFor(d),
    likes: Number(d.likes) || 0,
    liked: false,
    likedBy: d.likedBy && typeof d.likedBy === "object" ? d.likedBy : {},
    comments: commentsFor(d),
    createdAt: time(d.createdAt),
  };
}
export function readListing(id: string, d: Record<string, any>): Listing {
  const clearedMedia = Array.isArray(d.media) && !d.media.length && d.mediaUrl === "";
  return {
    id,
    title: d.title || "Market Item",
    price: formatPrice(String(d.price ?? "")),
    description: d.description || "",
    author: d.author || "Resident",
    authorAvatar: avatar(d),
    authorId: d.userId || d.authorId || d.uid,
    authorEmail: d.authorEmail || d.email || "",
    unit: d.unit || "TownLoop Resident",
    timeAgo: postedAt(d.createdAt),
    isOwner: false,
    claimed: !!(d.claimed || d.sold),
    sold: !!(d.sold || d.claimed),
    mediaUrl: d.mediaUrl,
    photoUrl: clearedMedia ? "" : d.photoUrl || d.mediaUrl,
    media: clearedMedia ? [] : mediaFor(d),
    comments: commentsFor(d),
    createdAt: time(d.createdAt),
  };
}
export function owns(
  item: { authorId?: string | number },
  user: UserProfile | null,
) {
  return !!user && String(item.authorId) === String(user.id);
}
type AvatarRecord = { authorId?: string | number; authorEmail?: string; authorAvatar?: string };
/** Build once per directory change, preserving first-match and signed-in-user precedence. */
export function avatarResolver(people: UserProfile[], user: UserProfile | null) {
  const byId = new Map<string, UserProfile>();
  const byEmail = new Map<string, UserProfile>();
  for (const person of [...(user ? [user] : []), ...people]) {
    const id = String(person.id), email = person.email?.toLowerCase();
    if (!byId.has(id)) byId.set(id, person);
    if (email && !byEmail.has(email)) byEmail.set(email, person);
  }
  return (record: AvatarRecord) => {
    const person = record.authorId ? byId.get(String(record.authorId)) : byEmail.get(record.authorEmail?.toLowerCase() || '');
    return person?.avatarUrl || person?.avatar_url || person?.avatar || record.authorAvatar || '';
  };
}
export function withAvatar<
  T extends {
    authorId?: string | number;
    authorEmail?: string;
    authorAvatar?: string;
    comments?: CommentItem[];
  },
>(item: T, people: UserProfile[], user: UserProfile | null, resolve = avatarResolver(people, user)): T {
  return {
    ...item,
    authorAvatar: resolve(item),
    comments: item.comments?.map((c) => ({ ...c, authorAvatar: resolve(c) })),
  };
}
export function formatPrice(value: string) {
  const v = value.trim();
  const amount = v.replace(/^\$\s*/, "").replace(/[,\s]/g, "");
  const zero = /^(?:0+(?:\.0*)?|\.0+)$/.test(amount);
  return !v || v.toUpperCase() === "FREE" || zero
    ? "FREE"
    : /^\d/.test(v)
      ? `$${v}`
      : v;
}
export function appendComment(current: CommentItem[], comment: CommentItem) {
  return current.some((c) => String(c.id) === String(comment.id))
    ? current
    : [...current, comment];
}
export function cleanChatId(id: string | number) {
  return String(id)
    .trim()
    .toLowerCase()
    .replace(/[^a-zA-Z0-9_-]/g, "_");
}
export function chatSide(chat: Chat, uid: string): "seller" | "buyer" | null {
  return String(chat.sellerId) === uid
    ? "seller"
    : String(chat.buyerId) === uid
      ? "buyer"
      : null;
}
export function hasLeft(chat: Chat, side: "seller" | "buyer") {
  return marketLeft(chat, side);
}
export function visibleChat(chat: Chat, uid: string) {
  const side = chatSide(chat, uid);
  return !!side && !hasLeft(chat, side);
}
export function readChat(id: string, d: Record<string, any>): Chat {
  return {
    ...d,
    id,
    itemPrice: formatPrice(String(d.itemPrice ?? "")),
    messages: Array.isArray(d.messages) ? d.messages : [],
    deletedBy: Array.isArray(d.deletedBy) ? d.deletedBy : [],
    updatedAt: time(d.updatedAt),
    lastMessage: d.lastMessage || "",
  } as Chat;
}

/** Sort the participant-scoped result locally, retaining legacy chats without updatedAt. */
export function orderedChats(chats: Chat[], uid: string) {
  return chats
    .filter((chat) => visibleChat(chat, uid))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}
