import test from "node:test";
import assert from "node:assert/strict";
import {
  identifiers,
  participantKey,
  residentKey,
  readThread,
  neighbors,
  senderLabel,
  receiptMessages,
  officeManager,
} from "../src/profile/model.ts";
import type { UserProfile } from "../../src/types.ts";
const resident = {
  id: "uid-one",
  name: "Alex Resident",
  email: "alex@example.invalid",
  role: "resident",
  approved: true,
} as UserProfile;
const other = { ...resident, id: "uid-two", email: "other@example.invalid" };
test("profile chats use stable identity and do not give a namesake access to another resident’s messages", () => {
  assert.equal(participantKey(resident), "alex@example.invalid");
  assert.equal(residentKey(resident), "alex_example_invalid");
  assert.ok(!identifiers(resident).includes("alex_resident"));
  const data = {
    participantIds: identifiers(resident),
    participants: [resident, { ...other, name: "Another Neighbor" }],
    unreadBy: ["uid-one"],
    messages: [],
  };
  assert.equal(
    readThread("friend", "chat", data, {
      ...other,
      id: "unrelated",
      email: "unrelated@example.invalid",
    }),
    null,
  );
  assert.equal(readThread("friend", "chat", data, resident)?.unread, true);
  assert.equal(
    readThread("friend", "chat", { ...data, unreadBy: [] }, resident)?.unread,
    false,
  );
});
test("office and maintenance inboxes select the correct resident and staff unread flags", () => {
  const data = {
    residentId: resident.id,
    residentEmail: resident.email,
    residentName: resident.name,
    unreadByVip: true,
    unreadByCrew: true,
    unreadByResident: false,
  };
  assert.equal(readThread("office", "one", data, other), null);
  assert.equal(readThread("maintenance", "one", data, other), null);
  assert.equal(
    readThread("office", "one", data, resident)?.name,
    "Community Office",
  );
  assert.equal(readThread("office", "one", data, resident)?.unread, false);
  assert.equal(
    readThread("office", "one", data, { ...other, role: "vip" })?.unread,
    true,
  );
  assert.equal(
    readThread("maintenance", "one", data, { ...other, role: "crew" })?.name,
    resident.name,
  );
});
test("directory excludes pending accounts, self and staff while preserving neighbor identity", () => {
  const people = [
    resident,
    other,
    { ...other, id: "pending", approved: false },
    ...["admin", "vip", "staff", "crew"].map((role) => ({
      ...other,
      id: role,
      role,
    })),
  ] as UserProfile[];
  assert.deepEqual(
    neighbors(people, resident).map((p) => p.id),
    ["uid-two"],
  );
});
test("office replies preserve anonymous office identity for residents", () => {
  const message = {
    id: "m",
    senderId: "vip",
    senderName: "Office Person",
    senderRole: "vip",
    body: "Hello",
    createdAt: 1,
  };
  assert.equal(senderLabel(message, "office", resident), "Community Office");
  assert.equal(
    senderLabel(message, "office", { ...other, role: "admin" }),
    "Office Person",
  );
});

test("only crew see the shared team identities; residents see one maintenance contact", () => {
  const message = {
    id: "m",
    senderId: "crew-one",
    senderName: "Pat",
    senderRole: "crew",
    body: "Hello",
    createdAt: 1,
  };
  assert.equal(
    senderLabel(message, "maintenance", resident),
    "Maintenance Crew",
  );
  assert.equal(
    senderLabel(message, "maintenance", { ...other, role: "crew" }),
    "Pat",
  );
  const data = {
    residentId: resident.id,
    residentEmail: resident.email,
    messages: [message],
  };
  for (const role of ["resident", "admin", "vip", "staff"]) {
    assert.equal(
      readThread("maintenance", "one", data, { ...other, role }),
      null,
    );
  }
  for (const role of ["admin", "vip"])
    assert.ok(readThread("office", "one", data, { ...other, role }));
  assert.equal(
    readThread("office", "one", data, { ...other, role: "crew" }),
    null,
  );
});

test("read receipts require the opposite side, not another sender-team member", () => {
  const crewReply = {
    id: "reply",
    senderId: "crew-one",
    senderRole: "crew",
    senderName: "Pat",
    body: "Hello",
    createdAt: 1,
  };
  assert.equal(
    receiptMessages([crewReply], "maintenance", { ...other, role: "crew" })[0]
      .readBy,
    undefined,
  );
  assert.deepEqual(
    receiptMessages([crewReply], "maintenance", resident)[0].readBy,
    [resident.id],
  );
  const request = {
    ...crewReply,
    senderId: String(resident.id),
    senderRole: "resident",
  };
  assert.deepEqual(
    receiptMessages([request], "maintenance", { ...other, role: "crew" })[0]
      .readBy,
    [other.id],
  );
  for (const role of ["resident", "crew", "staff"])
    assert.equal(officeManager({ ...other, role }), false);
  for (const role of ["admin", "vip"])
    assert.equal(officeManager({ ...other, role }), true);
});
