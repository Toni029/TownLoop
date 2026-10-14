import type { UserProfile } from "../../../src/types";
import {
  getUserRole,
  isAdmin,
  isVip,
  isCrew,
  isStaff,
} from "../../../src/utils/permissions.ts";
export type Category = "friend" | "office" | "maintenance";
export type Message = {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  body: string;
  createdAt: number;
  senderAvatar?: string;
  readBy?: string[];
};
export type Thread = {
  id: string;
  category: Category;
  name: string;
  subject: string;
  unread: boolean;
  messages: Message[];
  updatedAt: number;
  data: Record<string, any>;
  recipient: UserProfile;
};
export const collectionName = {
  friend: "resident_chats",
  office: "office_chats",
  maintenance: "maintenance_chats",
};
export function identifiers(user: {
  id?: string | number;
  email?: string;
  name?: string;
}): string[] {
  const values = user.id || user.email ? [user.id, user.email] : [user.name];
  return [
    ...new Set(
      values.filter(Boolean).flatMap((value) => {
        const raw = String(value).trim().toLowerCase();
        return [raw, raw.replace(/[^a-zA-Z0-9_-]/g, "_")];
      }),
    ),
  ];
}
export function participantKey(user: {
  id?: string | number;
  email?: string;
  name?: string;
}) {
  const ids = identifiers(user);
  return ids[1] || ids[0] || "";
}
export function residentKey(user: { id?: string | number; email?: string }) {
  return String(user.email || user.id || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .toLowerCase();
}
export function officeManager(user: UserProfile) {
  return ["admin", "vip"].includes(getUserRole(user));
}
export function neighbors(users: UserProfile[], current: UserProfile) {
  return users.filter(
    (u) =>
      u.approved !== false &&
      String(u.id) !== String(current.id) &&
      u.email?.toLowerCase() !== current.email?.toLowerCase() &&
      !isAdmin(u) &&
      !isVip(u) &&
      !isCrew(u) &&
      !isStaff(u),
  );
}
export function readThread(
  category: Category,
  id: string,
  data: Record<string, any>,
  user: UserProfile,
): Thread | null {
  const mine = identifiers(user);
  let recipient: UserProfile, unread: boolean;
  if (category === "friend") {
    const participants = Array.isArray(data.participants)
      ? data.participants
      : [];
    const ids = Array.isArray(data.participantIds) ? data.participantIds : [];
    if (
      !ids.some((v: string) => mine.includes(v.toLowerCase())) &&
      !participants.some((p: UserProfile) =>
        identifiers(p).some((v) => mine.includes(v)),
      )
    )
      return null;
    const other = participants.find(
      (p: UserProfile) => !identifiers(p).some((v) => mine.includes(v)),
    );
    if (!other) return null;
    recipient = {
      ...other,
      address: other.apt || other.address || "",
      role: "resident",
    };
    unread = (data.unreadBy || []).some((v: string) =>
      mine.includes(v.toLowerCase()),
    );
  } else {
    const manager = category === "office" ? officeManager(user) : isCrew(user);
    if (
      !manager &&
      String(data.residentId) !== String(user.id) &&
      data.residentEmail?.toLowerCase() !== user.email?.toLowerCase() &&
      id !== residentKey(user)
    )
      return null;
    recipient = manager
      ? ({
          id: data.residentId,
          name: data.residentName || "Resident",
          email: data.residentEmail || "",
          address: data.residentApt || "",
          phone: data.residentPhone || "",
          avatar_url: data.residentAvatar || "",
          role: "resident",
        } as UserProfile)
      : user;
    unread =
      !!data[
        manager
          ? category === "office"
            ? "unreadByVip"
            : "unreadByCrew"
          : "unreadByResident"
      ];
  }
  const messages = Array.isArray(data.messages) ? data.messages : [];
  return {
    id,
    category,
    name:
      category === "friend" ||
      (category === "office" ? officeManager(user) : isCrew(user))
        ? recipient.name
        : category === "office"
          ? "Community Office"
          : "Maintenance Crew",
    subject: data.subject || "Conversation",
    unread,
    messages,
    updatedAt:
      typeof data.updatedAt === "number"
        ? data.updatedAt
        : data.updatedAt?.toMillis?.() || 0,
    data,
    recipient,
  };
}
// Never reveal an individual office employee's identity in the resident conversation.
export function senderLabel(
  message: Message,
  category: Category,
  user: UserProfile,
) {
  if (
    category === "office" &&
    !officeManager(user) &&
    ["admin", "vip"].includes(message.senderRole)
  )
    return "Community Office";
  if (
    category === "maintenance" &&
    !isCrew(user) &&
    message.senderRole === "crew"
  )
    return "Maintenance Crew";
  return message.senderName || "Resident";
}

export function messageIsMine(message: Message, user: UserProfile) {
  return identifiers(user).includes(message.senderId.toLowerCase());
}
export function receiptMessages(
  messages: Message[],
  category: Category,
  user: UserProfile,
) {
  const team =
    category === "office"
      ? officeManager(user)
      : category === "maintenance" && isCrew(user);
  return messages.map((message) => {
    const fromTeam =
      category === "office"
        ? ["vip", "admin"].includes(message.senderRole)
        : category === "maintenance" && message.senderRole === "crew";
    if (
      messageIsMine(message, user) ||
      (category !== "friend" && !!team === !!fromTeam)
    )
      return message;
    return {
      ...message,
      readBy: [...new Set([...(message.readBy || []), String(user.id)])],
    };
  });
}

export function messageAvatar(message: Message, people: UserProfile[]): string {
  const sender = people.find((person) =>
    identifiers(person).includes(message.senderId.toLowerCase()),
  );
  return sender?.avatar_url || sender?.avatarUrl || message.senderAvatar || "";
}
