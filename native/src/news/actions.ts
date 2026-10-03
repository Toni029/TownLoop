import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { canManageNewsletter } from "../../../src/utils/permissions";
import type {
  CommunityRsvpEvent,
  PinnedHighlight,
  UserProfile,
} from "../models";
import { auth, db } from "../lib/firebase";
import { rsvpPatch, singleFlight } from "./model";
import type { EventDraft } from "./Editors";
export const runNewsAction = singleFlight();
export async function approvedUser(manager = false): Promise<UserProfile> {
  const user = auth.currentUser;
  if (!user) throw new Error("Please sign in again.");
  const snapshot = await getDoc(doc(db, "users", user.uid));
  const profile = {
    ...snapshot.data(),
    id: user.uid,
    name: snapshot.data()?.name || user.displayName || "Resident",
    email: snapshot.data()?.email || user.email || "",
  } as UserProfile;
  if (!snapshot.exists() || profile.approved === false)
    throw new Error("Your account must be approved.");
  if (manager && !canManageNewsletter(profile))
    throw new Error("Only administrators and VIP residents can manage News.");
  return profile;
}
export async function setRsvp(event: CommunityRsvpEvent) {
  return runNewsAction(`rsvp:${event.id}`, async () => {
    const user = await approvedUser();
    const going = !event.userRsvp;
    try {
      await runTransaction(db, async (tx) => {
        const reference = doc(db, "community_events", String(event.id));
        const current = await tx.get(reference);
        if (!current.exists())
          throw new Error("This event is no longer available.");
        const patch = rsvpPatch(
          { ...current.data(), id: event.id } as CommunityRsvpEvent,
          user,
          going,
          Date.now(),
        );
        if (patch)
          tx.update(reference, { ...patch, updatedAt: serverTimestamp() });
      });
    } catch (e) {
      if ((e as { code?: string }).code === "permission-denied")
        throw new Error(
          "Your RSVP was not saved. The community’s Firebase permissions currently prevent resident RSVP changes. Please contact the office.",
        );
      throw e;
    }
  });
}
export async function saveEvent(
  id: string,
  draft: EventDraft,
  editing: boolean,
) {
  await approvedUser(true);
  const ref = doc(db, "community_events", id);
  const patch = {
    ...draft,
    spotsLeft: draft.spotsLeft ?? null,
    updatedAt: serverTimestamp(),
  };
  if (editing) {
    await runTransaction(db, async (tx) => {
      if (!(await tx.get(ref)).exists())
        throw new Error("This event was removed.");
      tx.update(ref, patch);
    });
  } else
    await runTransaction(db, async (tx) => {
      if ((await tx.get(ref)).exists()) return;
      tx.set(ref, {
        ...patch,
        attendees: [],
        attendeesCount: 0,
        createdAt: Date.now(),
        isAiExtracted: false,
      });
    });
}
export async function saveHighlight(
  id: string,
  draft: Omit<PinnedHighlight, "id">,
) {
  await approvedUser(true);
  await setDoc(doc(db, "community_highlights", id), {
    ...draft,
    createdAt: Date.now(),
    updatedAt: serverTimestamp(),
  });
}
export async function removeNewsItem(
  collectionName: "community_events" | "community_highlights",
  id: string,
) {
  await approvedUser(true);
  await deleteDoc(doc(db, collectionName, id));
}
export function newNewsId(
  kind: "community_events" | "community_highlights" | "newsletters",
) {
  return doc(collection(db, kind)).id;
}
