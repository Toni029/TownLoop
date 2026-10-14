import test from "node:test";
import assert from "node:assert/strict";
import {
  adminDirectory,
  removeAttendeePatch,
} from "../src/profile/adminModel.ts";
import type { UserProfile, CommunityRsvpEvent } from "../../src/types";
test("admin directory retains applicants and deduplicates IDs/emails while hiding privileged accounts", () => {
  const person = (id: string, email: string, role: string, approved = true) =>
    ({ id, email, role, name: id, approved }) as UserProfile;
  const applicant = person("new", "new@example.invalid", "", false);
  assert.deepEqual(
    adminDirectory([
      applicant,
      person("new", "other@example.invalid", "resident"),
      person("duplicate", " NEW@example.invalid ", "resident"),
      person("crew", "crew@example.invalid", "crew"),
      person("admin", "admin@example.invalid", "admin"),
      person("vip", "vip@example.invalid", "vip"),
    ]).map((p) => p.id),
    ["new", "crew"],
  );
});
test("removing RSVP is idempotent and updates roster and capacity together", () => {
  const event = {
    capacity: 4,
    attendees: [
      { id: "a", name: "A" },
      { id: "b", name: "B" },
    ],
    attendeesCount: 2,
  } as CommunityRsvpEvent;
  const patch = removeAttendeePatch(event, "a")!;
  assert.equal(patch.attendeesCount, 1);
  assert.equal(patch.spotsLeft, 3);
  assert.deepEqual(
    patch.attendees.map((a) => a.id),
    ["b"],
  );
  assert.equal(removeAttendeePatch({ ...event, ...patch }, "a"), null);
  assert.equal(
    "spotsLeft" in removeAttendeePatch({ ...event, capacity: null }, "a")!,
    false,
  );
});
