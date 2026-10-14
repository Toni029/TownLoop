import type { CommunityRsvpEvent, UserProfile } from "../../../src/types";
import {
  getUserRole,
  isMasterAdminEmail,
} from "../../../src/utils/permissions.ts";
export function adminDirectory(people: UserProfile[]): UserProfile[] {
  const ids = new Set<string>(),
    emails = new Set<string>();
  return people
    .filter((p) => {
      const id = String(p.id || "").trim(),
        email = (p.email || "").trim().toLowerCase();
      if (
        ["admin", "vip"].includes(getUserRole(p)) ||
        isMasterAdminEmail(email) ||
        (id && ids.has(id)) ||
        (email && emails.has(email))
      )
        return false;
      if (id) ids.add(id);
      if (email) emails.add(email);
      return true;
    })
    .sort(
      (a, b) => Number(b.approved === false) - Number(a.approved === false),
    );
}
export function removeAttendeePatch(event: CommunityRsvpEvent, id: string) {
  const before = event.attendees || [],
    attendees = before.filter((a) => a.id !== id);
  if (before.length === attendees.length) return null;
  return {
    attendees,
    attendeesCount: attendees.length,
    ...(typeof event.capacity === "number"
      ? { spotsLeft: Math.max(0, event.capacity - attendees.length) }
      : {}),
  };
}
