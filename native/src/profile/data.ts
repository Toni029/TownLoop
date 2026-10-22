import { useEffect, useEffectEvent, useMemo, useState } from "react";
import {
  collection,
  FieldPath,
  getDocs,
  limit,
  doc,
  onSnapshot,
  query,
  where,
  runTransaction,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import type { UserProfile } from "../../../src/types";
import { getUserRole, isCrew, canAccessAdminPanel } from "../../../src/utils/permissions";
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
  profileChanges,
  accountDetails,
  type ProfileDetails,
  type Category,
  type Thread,
} from "./model";
export function readPerson(id: string, data: Record<string, any>): UserProfile {
  return { ...data, ...readProfile(data), id } as UserProfile;
}
export function useProfileData(user: UserProfile | null) {
  // Only office managers receive private profiles for approvals and profile reviews.
  const privateDirectory = user?.approved === true && ["admin", "vip"].includes(user.role || "");
  const directory = useLiveCollection(privateDirectory ? "users" : "resident_directory", readPerson, "");
  const [attempt, retry] = useState(0);
  const uid = user ? String(user.id) : "";
  const email = user?.email || "";
  const role = user?.role || "";
  const approved = !!getUserRole(user);
  const manager = !!user && officeManager(user);
  const crew = !!user && isCrew(user);
  const key = `${uid}:${email}:${role}:${approved}:${manager}:${crew}:${attempt}`;
  const decode = useEffectEvent((category: Category, id: string, value: Record<string, any>) => user ? readThread(category, id, value, user) : null);
  const [owned, setOwned] = useState<{
    key: string;
    lists: Partial<Record<Category, Thread[]>>;
    errors: Partial<Record<Category, string>>;
  }>({ key: "", lists: {}, errors: {} });
  useEffect(() => {
    if (!uid || !approved) return;
    const stops = (["friend", "office", "maintenance"] as Category[]).map(
      (category) => {
        const base = collection(db, collectionName[category]);
        const source =
          category === "friend"
            ? query(
                base,
                where(
                  "participantIds",
                  "array-contains",
                  uid,
                ),
                where("identityVersion", "==", 2),
              )
            : (category === "office" ? manager : crew)
              ? base
              : query(base, where("residentId", "==", uid));
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
                    .map((d: any) => decode(category, d.id, d.data()))
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
  }, [key, uid, email, approved, manager, crew]);
  const state = owned.key === key ? owned : { lists: {}, errors: {} };
  const threads = useMemo(() => Object.values(state.lists).flat().sort((a, b) => b.updatedAt - a.updatedAt), [state.lists]);
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
    tx.update(reference, new FieldPath("readBy", String(user.id)), (snap.data().messages || []).length);
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
    tx.update(reference, new FieldPath("hiddenBy", String(user.id)), (snap.data().messages || []).length);
  });
}
export async function sendMessage(
  category: Category,
  recipient: UserProfile,
  subject: string,
  body: string,
  thread?: Thread,
  options: {officeDirect?: boolean; officeRequest?: boolean} = {},
) {
  const user = await approvedUser();
  if (!body.trim() || body.length > 10000)
    throw new Error("Enter a message of up to 10,000 characters.");
  if (options.officeDirect && (category !== "friend" || !officeManager(recipient) || recipient.approved === false))
    throw new Error("Select an approved Admin or VIP recipient.");
  if (options.officeRequest && category !== "office") throw new Error("Profile requests must go to the community office.");
  const manager = !options.officeRequest && (
    category === "office"
      ? officeManager(user)
      : category === "maintenance" && isCrew(user));
  const target = category === "friend" || manager ? recipient : user;
  if (
    !target.id ||
    (category === "friend" && String(target.id) === String(user.id))
  )
    throw new Error("Select a neighbor first.");
  let id =
    thread?.id ||
    (category === "friend"
      ? [participantKey(user), participantKey(target)].sort().join("_vs_")
      : residentKey(target));
  if (!thread && category !== "friend") {
    const matches = await getDocs(query(collection(db, collectionName[category]), where("residentId", "==", String(target.id)), limit(2)));
    id = matches.docs.find(item => item.id === id)?.id || matches.docs[0]?.id || id;
  }
  const now = Date.now(),
    message = {
      id: `msg_${now}_${Math.random().toString(36).slice(2, 9)}`,
      senderId: category === "friend" ? participantKey(user) : String(user.id),
      senderName: user.name,
      senderRole: getUserRole(user),
      senderAvatar: user.avatar_url ?? user.avatarUrl ?? "",
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
    if (snap.exists() && !readThread(category, id, { ...existing, hiddenBy: {} }, user))
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
      if (options.officeDirect && !snap.exists()) patch.officeDirect = true;
      if (!snap.exists()) {
        patch.identityVersion = 2;
        patch.participantIds = [String(user.id), String(target.id)];
        patch.participants = [user, target].map((p) => ({
          id: String(p.id), name: p.name, avatar: p.avatar_url || p.avatarUrl || "", role: getUserRole(p),
        }));
      }
      patch.unreadBy = [
        ...new Set([
          ...(existing.unreadBy || []).filter(
            (v: string) => !identifiers(user).includes(v),
          ),
          participantKey(target),
        ]),
      ];
    } else {
      if (!snap.exists()) Object.assign(patch, {
        residentId: String(target.id), residentName: target.name,
        residentEmail: "", residentApt: "", residentPhone: "",
        residentAvatar: target.avatar_url || target.avatarUrl || "",
      });
      Object.assign(patch, {
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
    !["resident", "crew", "vip", "admin"].includes(patch.role)
  )
    throw new Error("Invalid role.");
  await updateDoc(doc(db, "users", id), patch);
}

/** Persist the proposal without changing approved account information. */
export async function requestProfileUpdate(input: ProfileDetails) {
  const user = await approvedUser();
  const ref = doc(db, "users", String(user.id));
  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) throw new Error("Your account is no longer available.");
    const current = readPerson(snapshot.id, snapshot.data());
    const changes = profileChanges(current, input);
    transaction.update(ref, { profileUpdateRequest: {
      status: "pending", changes, previous: accountDetails(current),
      requestedAt: serverTimestamp(), requestedBy: String(user.id),
    } });
  });
}

export async function reviewProfileUpdate(id: string, requestedAt: unknown, approve: boolean) {
  const manager = await approvedUser();
  if (!officeManager(manager)) throw new Error("Admin or VIP access is required.");
  const ref = doc(db, "users", id);
  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(ref);
    const data = snapshot.data();
    const request = data?.profileUpdateRequest;
    if (!data || request?.status !== "pending" || !request.requestedAt?.isEqual(requestedAt))
      throw new Error("This request changed. Reopen it before reviewing.");
    const current = accountDetails(readPerson(id, data));
    const changes = request.changes as Partial<ProfileDetails>;
    const keys = Object.keys(changes) as (keyof ProfileDetails)[];
    if (!keys.length || keys.some(key => !(key in current) || typeof changes[key] !== "string" || changes[key]!.length > 300))
      throw new Error("Invalid profile request.");
    if (approve && keys.some(key => current[key] !== request.previous?.[key]))
      throw new Error("Account information has changed. Ask the resident to submit a fresh request.");
    transaction.update(ref, {
      ...(approve ? {
        ...changes,
        ...(changes.emergencyContactName !== undefined ? {emergencyContact: changes.emergencyContactName, emergency_contact: changes.emergencyContactName} : {}),
        ...(changes.emergencyContactPhone !== undefined ? {emergency_contact_phone: changes.emergencyContactPhone} : {}),
        ...(changes.emergencyContactAddress !== undefined ? {emergency_contact_address: changes.emergencyContactAddress} : {}),
        ...(changes.dateOfBirth !== undefined ? {date_of_birth: changes.dateOfBirth} : {}),
        ...(changes.maritalStatus !== undefined ? {marital_status: changes.maritalStatus} : {}),
      } : {}),
      profileUpdateRequest: {...request, status: approve ? "approved" : "rejected", reviewedAt: serverTimestamp(), reviewedBy: String(manager.id)},
    });
  });
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
