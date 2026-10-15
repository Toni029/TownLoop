import { useEffect, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  runTransaction,
  updateDoc,
} from "firebase/firestore";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import type { UserProfile } from "../../../src/types";
import { isCrew, canAccessAdminPanel } from "../../../src/utils/permissions";
import { auth, db } from "../lib/firebase";
import { approvedUser } from "../news/actions";
import { useLiveCollection } from "../lib/liveCollection";
import { readProfile, friendlyError } from "../lib/profile";
import { subscribeSafely } from "../lib/subscription";
import {
  collectionName,
  identifiers,
  participantKey,
  residentKey,
  readThread,
  officeManager,
  receiptMessages,
  type Category,
  type Thread,
} from "./model";
export function readPerson(id: string, data: Record<string, any>): UserProfile {
  return { ...data, ...readProfile(data), id } as UserProfile;
}
export function useProfileData(user: UserProfile | null) {
  const directory = useLiveCollection("users", readPerson, "");
  const [attempt, retry] = useState(0);
  const key = user ? `${user.id}:${user.email}:${user.role}:${attempt}` : "";
  const [owned, setOwned] = useState<{
    key: string;
    lists: Partial<Record<Category, Thread[]>>;
    errors: Partial<Record<Category, string>>;
  }>({ key: "", lists: {}, errors: {} });
  useEffect(() => {
    if (!user || user.approved === false) return;
    const stops = (["friend", "office", "maintenance"] as Category[]).map(
      (category) => {
        const base = collection(db, collectionName[category]);
        const source =
          category === "friend"
            ? query(
                base,
                where(
                  "participantIds",
                  "array-contains-any",
                  identifiers(user).slice(0, 30),
                ),
              )
            : (category === "office" ? officeManager(user) : isCrew(user))
              ? base
              : doc(base, residentKey(user));
        return subscribeSafely<Thread[]>(
          (next, fail) =>
            onSnapshot(
              source as ReturnType<typeof collection>,
              (snap) => {
                const docs =
                  "docs" in snap
                    ? snap.docs
                    : (snap as any).exists()
                      ? [snap]
                      : [];
                next(
                  docs
                    .map((d: any) => readThread(category, d.id, d.data(), user))
                    .filter(Boolean) as Thread[],
                );
              },
              fail,
            ),
          (items) =>
            setOwned((s) => ({
              key,
              lists: { ...(s.key === key ? s.lists : {}), [category]: items },
              errors: { ...(s.key === key ? s.errors : {}), [category]: "" },
            })),
          (error) =>
            setOwned((s) => ({
              key,
              lists: s.key === key ? s.lists : {},
              errors: {
                ...(s.key === key ? s.errors : {}),
                [category]: friendlyError(error),
              },
            })),
        );
      },
    );
    return () => stops.forEach((stop) => stop());
  }, [key, attempt, user]);
  const state = owned.key === key ? owned : { lists: {}, errors: {} };
  const threads = Object.values(state.lists)
    .flat()
    .sort((a, b) => b.updatedAt - a.updatedAt);
  return {
    directory,
    threads,
    errors: Object.values(state.errors).filter(Boolean),
    loading:
      Object.keys(state.lists).length +
        Object.values(state.errors).filter(Boolean).length <
      3,
    retry: () => retry((n) => n + 1),
  };
}
export async function markRead(thread: Thread) {
  const user = await approvedUser();
  await runTransaction(db, async (tx) => {
    const reference = doc(db, collectionName[thread.category], thread.id),
      snap = await tx.get(reference);
    if (
      !snap.exists() ||
      !readThread(thread.category, thread.id, snap.data(), user)
    )
      throw new Error("This conversation is no longer available.");
    tx.update(reference, {
      messages: receiptMessages(
        snap.data().messages || [],
        thread.category,
        user,
      ),
    });
    if (thread.category === "friend")
      tx.update(reference, {
        unreadBy: (snap.data().unreadBy || []).filter(
          (v: string) => !identifiers(user).includes(v.toLowerCase()),
        ),
      });
    else
      tx.update(reference, {
        [thread.category === "office" && officeManager(user)
          ? "unreadByVip"
          : thread.category === "maintenance" && isCrew(user)
            ? "unreadByCrew"
            : "unreadByResident"]: false,
      });
  });
}
export async function deleteThread(thread: Thread) {
  const user = await approvedUser();
  await runTransaction(db, async (tx) => {
    const reference = doc(db, collectionName[thread.category], thread.id),
      snap = await tx.get(reference);
    if (!snap.exists()) return;
    if (!readThread(thread.category, thread.id, snap.data(), user))
      throw Error("You cannot access this conversation.");
    tx.delete(reference);
  });
}
export async function sendMessage(
  category: Category,
  recipient: UserProfile,
  subject: string,
  body: string,
  thread?: Thread,
) {
  const user = await approvedUser();
  if (!body.trim() || body.length > 10000)
    throw new Error("Enter a message of up to 10,000 characters.");
  const manager =
    category === "office"
      ? officeManager(user)
      : category === "maintenance" && isCrew(user);
  const target = category === "friend" || manager ? recipient : user;
  if (
    !target.id ||
    (category === "friend" && String(target.id) === String(user.id))
  )
    throw new Error("Select a neighbor first.");
  const id =
    thread?.id ||
    (category === "friend"
      ? [participantKey(user), participantKey(target)].sort().join("_vs_")
      : residentKey(target));
  const now = Date.now(),
    message = {
      id: `msg_${now}_${Math.random().toString(36).slice(2, 9)}`,
      senderId: category === "friend" ? participantKey(user) : String(user.id),
      senderName: user.name,
      senderRole:
        category === "friend"
          ? user.role
          : category === "office" && manager
            ? user.role === "admin"
              ? "admin"
              : "vip"
            : category === "maintenance" && manager
              ? "crew"
              : "resident",
      senderAvatar: user.avatar_url || user.avatarUrl || "",
      body: body.trim(),
      createdAt: now,
      time: new Date(now).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      }),
    };
  await runTransaction(db, async (tx) => {
    const ref = doc(db, collectionName[category], id),
      snap = await tx.get(ref),
      existing = snap.data() || {};
    if (snap.exists() && !readThread(category, id, existing, user))
      throw new Error("You do not have access to this conversation.");
    if (auth.currentUser?.uid !== String(user.id))
      throw new Error("Your session changed. Sign in again.");
    const patch: Record<string, any> = {
      messages: [...(existing.messages || []), message],
      lastMessage: message.body,
      updatedAt: now,
      subject:
        subject.trim().slice(0, 160) || existing.subject || "Conversation",
    };
    if (category === "friend") {
      patch.participantIds = [
        ...new Set([
          ...(existing.participantIds || []),
          ...identifiers(user),
          ...identifiers(target),
        ]),
      ];
      patch.participants =
        existing.participants ||
        [user, target].map((p) => ({
          id: participantKey(p),
          name: p.name,
          email: p.email || "",
          avatar: p.avatar_url || p.avatarUrl || "",
          phone: p.phone || "",
          apt: p.address || "",
        }));
      patch.unreadBy = [
        ...new Set([
          ...(existing.unreadBy || []).filter(
            (v: string) => !identifiers(user).includes(v.toLowerCase()),
          ),
          participantKey(target),
        ]),
      ];
    } else {
      Object.assign(patch, {
        residentId: String(target.id),
        residentName: target.name,
        residentEmail: target.email || "",
        residentApt: target.address || target.unit || "",
        residentPhone: target.phone || "",
        residentAvatar: target.avatar_url || target.avatarUrl || "",
        unreadByResident: !!manager,
        [category === "office" ? "unreadByVip" : "unreadByCrew"]: !manager,
      });
    }
    tx.set(ref, { ...patch, id }, { merge: true });
  });
}
export async function updatePhoto() {
  const user = await approvedUser();
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });
  if (result.canceled) return false;
  const asset = result.assets[0];
  const side = Math.min(asset.width, asset.height);
  const image = await ImageManipulator.manipulate(asset.uri)
    .crop({
      originX: Math.floor((asset.width - side) / 2),
      originY: Math.floor((asset.height - side) / 2),
      width: side,
      height: side,
    })
    .resize({ width: 320, height: 320 })
    .renderAsync();
  const photo = await image.saveAsync({
    format: SaveFormat.JPEG,
    compress: 0.88,
    base64: true,
  });
  if (!photo.base64 || photo.base64.length > 650000)
    throw new Error(
      "Choose a smaller photo (under 480 KB) to save your profile picture.",
    );
  if (auth.currentUser?.uid !== String(user.id))
    throw new Error("Your session changed. Sign in again.");
  await updateDoc(doc(db, "users", String(user.id)), {
    avatar_url: `data:image/jpeg;base64,${photo.base64}`,
    avatarUrl: `data:image/jpeg;base64,${photo.base64}`,
  });
  return true;
}
export async function manageResident(
  id: string,
  patch: { approved?: boolean; role?: string },
) {
  const user = await approvedUser();
  if (!canAccessAdminPanel(user))
    throw new Error("Administrator access is required.");
  if (id === String(user.id))
    throw new Error("Use another administrator to change your own access.");
  if (
    patch.role &&
    !["resident", "crew", "staff", "vip", "admin"].includes(patch.role)
  )
    throw new Error("Invalid role.");
  await updateDoc(doc(db, "users", id), patch);
}

export async function updateOwnDetails(input: {
  phone: string;
  address: string;
  wing: string;
  emergencyContact: string;
  dietaryPreference: string;
}) {
  const user = await approvedUser();
  if (auth.currentUser?.uid !== String(user.id))
    throw new Error("Your session changed. Sign in again.");
  const clean = (value: string) => {
    if (typeof value !== "string" || value.length > 300)
      throw new Error("Profile fields must be under 300 characters.");
    return value.trim();
  };
  // Explicit fields prevent role/approval/email mutation; retain both legacy aliases.
  await updateDoc(doc(db, "users", String(user.id)), {
    phone: clean(input.phone),
    address: clean(input.address),
    wing: clean(input.wing),
    emergencyContact: clean(input.emergencyContact),
    emergency_contact: clean(input.emergencyContact),
    dietaryPreference: clean(input.dietaryPreference),
    dietary_preference: clean(input.dietaryPreference),
  });
}
