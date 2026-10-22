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
  // Firebase UIDs are case-sensitive. Names, emails and lossy aliases are not identities.
  return user.id ? [String(user.id)] : [];
}
export function participantKey(user: { id?: string | number; email?: string; name?: string }) {
  return user.id ? String(user.id) : "";
}
export function residentKey(user: { id?: string | number; email?: string }) {
  return participantKey(user);
}
export function officeManager(user: UserProfile) {
  return ["admin", "vip"].includes(getUserRole(user));
}
export function neighbors(users: UserProfile[], current: UserProfile) {
  return users.filter(
    (u) =>
      getUserRole(u) === "resident" &&
      String(u.id) !== String(current.id) &&
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
  if (!getUserRole(user)) return null;
  const mine = identifiers(user);
  let recipient: UserProfile, unread: boolean;
  if (category === "friend") {
    const participants = Array.isArray(data.participants)
      ? data.participants
      : [];
    const ids = Array.isArray(data.participantIds) ? data.participantIds : [];
    if (data.identityVersion !== 2 || !ids.includes(String(user.id))) return null;
    const other = participants.find(
      (p: UserProfile) => !identifiers(p).some((v) => mine.includes(v)),
    );
    if (!other) return null;
    recipient = {
      ...other,
      address: other.apt || other.address || "",
      role: other.role || "resident",
    };
    unread = (data.unreadBy || []).some((v: string) =>
      mine.includes(v),
    );
  } else {
    const manager = category === "office" ? officeManager(user) : isCrew(user);
    if (
      !manager &&
      String(data.residentId) !== String(user.id)
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
  const stored = Array.isArray(data.messages) ? data.messages : [];
  if (Number.isInteger(data.hiddenBy?.[String(user.id)]) && data.hiddenBy[String(user.id)] >= stored.length) return null;
  if (Number.isInteger(data.readBy?.[String(user.id)])) {
    const seen = data.readBy[String(user.id)];
    const team = category === "office" ? officeManager(user) : category === "maintenance" && isCrew(user);
    unread = stored.some((message: Message, index: number) => index >= seen && !messageIsMine(message, user) &&
      (category === "friend" || team !== (category === "office" ? ["admin", "vip"].includes(message.senderRole) : message.senderRole === "crew")));
  }
  // Read receipts are projections only; persisted historical messages stay immutable.
  const messages = stored.map((message: Message, index: number) => ({ ...message,
    readBy: [...new Set([...(message.readBy || []), ...Object.entries(data.readBy || {})
      .filter(([uid, count]) => uid !== message.senderId && typeof count === "number" && count > index &&
        (category === "friend" || (category === "office" ? ["admin", "vip"].includes(message.senderRole) : message.senderRole === "crew")
          ? category === "friend" || uid === String(data.residentId)
          : uid !== String(data.residentId)))
      .map(([uid]) => uid)])],
  }));
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
  return identifiers(user).includes(message.senderId);
}

export function messageAvatar(message: Message, people: UserProfile[]): string {
  const sender = people.find((person) =>
    identifiers(person).includes(message.senderId),
  );
  return sender?.avatar_url || sender?.avatarUrl || message.senderAvatar || "";
}

// Directory extensions are optional; never invent presence, interests or a join date.
export function profileInterests(person: UserProfile): string[] {
  const value = (person as UserProfile & { interests?: unknown }).interests;
  return Array.isArray(value)
    ? [
        ...new Set(
          value
            .filter((v): v is string => typeof v === "string" && !!v.trim())
            .map((v) => v.trim()),
        ),
      ]
    : [];
}
export function residentSince(person: UserProfile): string {
  const value = person.createdAt || person.created_at;
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : String(date.getFullYear());
}
export function matchesNeighbor(person: UserProfile, query: string): boolean {
  return [
    person.name,
    person.address,
    person.unit,
    person.wing,
    ...profileInterests(person),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(query.trim().toLowerCase());
}

export type ProfileDetails = {
  phone:string; address:string; dateOfBirth:string; maritalStatus:string;
  emergencyContactName:string; emergencyContactPhone:string; emergencyContactAddress:string;
};
/** Normalize existing aliases without rewriting or deleting any profile fields. */
export function accountDetails(user: UserProfile): ProfileDetails {
  const raw = user as unknown as Record<string, unknown>;
  const legacy = raw.emergencyContact || raw.emergency_contact;
  const contact = legacy && typeof legacy === 'object' ? legacy as Record<string,unknown> : {};
  const text = (...values:unknown[]) => values.find((v):v is string => typeof v === 'string' && !!v.trim())?.trim() || '';
  const birth = raw.dateOfBirth ?? raw.date_of_birth ?? raw.dob ?? raw.birthDate;
  return {
    phone:text(user.phone), address:text(user.address,user.unit,user.apartmentNumber,user.apartment_number),
    dateOfBirth:text(birth), maritalStatus:text(raw.maritalStatus,raw.marital_status),
    emergencyContactName:text(raw.emergencyContactName,raw.emergency_contact_name,contact.name,typeof legacy === 'string' ? legacy : ''),
    emergencyContactPhone:text(raw.emergencyContactPhone,raw.emergency_contact_phone,contact.phone),
    emergencyContactAddress:text(raw.emergencyContactAddress,raw.emergency_contact_address,contact.address),
  };
}
export function profileRequestText(user: UserProfile, input: ProfileDetails) {
  const labels = {phone:'Resident Phone',address:'Residency Address',dateOfBirth:'Date of Birth',maritalStatus:'Marital Status',emergencyContactName:'Emergency Contact Name',emergencyContactPhone:'Emergency Contact Phone',emergencyContactAddress:'Emergency Contact Address'};
  const current = accountDetails(user);
  const changes = (Object.keys(labels) as (keyof ProfileDetails)[]).flatMap(key => {
    if(typeof input[key] !== 'string' || input[key].length > 300) throw new Error('Profile fields must be under 300 characters.');
    const next=input[key].trim();
    return next === current[key].trim() ? [] : [`${labels[key]}: ${current[key] || '(not provided)'} → ${next || '(remove)'}`];
  });
  if(!changes.length) throw new Error('Change at least one field before requesting an update.');
  return `Profile update request from ${user.name} (${user.email || user.id})\n\n${changes.join('\n')}\n\nPlease review these changes before updating my profile.`;
}

export function profileChanges(user: UserProfile, input: ProfileDetails): Partial<ProfileDetails> {
  profileRequestText(user, input); // Validate every field and reject empty requests.
  const current = accountDetails(user);
  return Object.fromEntries((Object.keys(current) as (keyof ProfileDetails)[])
    .filter(key => input[key].trim() !== current[key])
    .map(key => [key, input[key].trim()]));
}
