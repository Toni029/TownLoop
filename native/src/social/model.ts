import type {
  PostItem,
  MarketItem,
  CommentItem,
  UserProfile,
  MediaAttachment,
} from "../../../src/types";
export type Post = PostItem & { createdAt: number };
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
const time = (v: any) =>
  typeof v?.toMillis === "function" ? v.toMillis() : Number(v) || 0;
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
    timeAgo: d.timeAgo || "Recent",
    tag: d.tag || "Community",
    title: d.title || "Community Post",
    content: d.content || "",
    mediaUrl: d.mediaUrl,
    media: mediaFor(d),
    likes: Number(d.likes) || 0,
    liked: false,
    comments: commentsFor(d),
    createdAt: time(d.createdAt),
  };
}
export function readListing(id: string, d: Record<string, any>): Listing {
  return {
    id,
    title: d.title || "Market Item",
    price: d.price || "FREE",
    description: d.description || "",
    author: d.author || "Resident",
    authorAvatar: avatar(d),
    authorId: d.userId || d.authorId || d.uid,
    authorEmail: d.authorEmail || d.email || "",
    unit: d.unit || "TownLoop Resident",
    timeAgo: d.timeAgo || "Recent",
    isOwner: false,
    claimed: !!(d.claimed || d.sold),
    sold: !!(d.sold || d.claimed),
    mediaUrl: d.mediaUrl,
    photoUrl: d.photoUrl || d.mediaUrl,
    media: mediaFor(d),
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
export function withAvatar<
  T extends {
    authorId?: string | number;
    authorEmail?: string;
    authorAvatar?: string;
    comments?: CommentItem[];
  },
>(item: T, people: UserProfile[], user: UserProfile | null): T {
  const resolve = (record: {
    authorId?: string | number;
    authorEmail?: string;
    authorAvatar?: string;
  }) => {
    const found = [...(user ? [user] : []), ...people].find((p) =>
      record.authorId
        ? String(p.id) === String(record.authorId)
        : !!record.authorEmail &&
          p.email?.toLowerCase() === record.authorEmail.toLowerCase(),
    );
    return (
      found?.avatarUrl ||
      found?.avatar_url ||
      found?.avatar ||
      record.authorAvatar ||
      ""
    );
  };
  return {
    ...item,
    authorAvatar: resolve(item),
    comments: item.comments?.map((c) => ({ ...c, authorAvatar: resolve(c) })),
  };
}
export function formatPrice(value: string) {
  const v = value.trim();
  return !v || v.toUpperCase() === "FREE"
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
  return (
    !!(side === "seller"
      ? chat.sellerLeft || chat.deletedBySeller
      : chat.buyerLeft || chat.deletedByBuyer) ||
    !!chat.deletedBy?.includes(side) ||
    !!chat.deletedBy?.includes(
      cleanChatId(side === "seller" ? chat.sellerId : chat.buyerId),
    )
  );
}
export function visibleChat(chat: Chat, uid: string) {
  const side = chatSide(chat, uid);
  return !!side && !hasLeft(chat, side);
}
export function readChat(id: string, d: Record<string, any>): Chat {
  return {
    ...d,
    id,
    messages: Array.isArray(d.messages) ? d.messages : [],
    deletedBy: Array.isArray(d.deletedBy) ? d.deletedBy : [],
    updatedAt: time(d.updatedAt),
    lastMessage: d.lastMessage || "",
  } as Chat;
}

/** Reference subscribes to the full collection, including legacy chats lacking updatedAt. */
export function orderedChats(chats: Chat[], uid: string) {
  return chats
    .filter((chat) => visibleChat(chat, uid))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}
