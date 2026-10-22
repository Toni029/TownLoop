import test from "node:test";
import assert from "node:assert/strict";
import {
  identifiers,
  participantKey,
  residentKey,
  readThread,
  neighbors,
  senderLabel,
  officeManager,
  messageAvatar,
  profileInterests,
  residentSince,
  matchesNeighbor,
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
  assert.equal(participantKey(resident), "uid-one");
  assert.equal(residentKey(resident), "uid-one");
  assert.ok(!identifiers(resident).includes("alex_resident"));
  const data = {
    identityVersion: 2,
    participantIds: [String(resident.id), String(other.id)],
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
  const data = { residentId: resident.id, residentName: resident.name, messages: [crewReply], readBy: { [other.id]: 1 } };
  assert.deepEqual(readThread("maintenance", "one", data, resident)?.messages[0].readBy, []);
  assert.deepEqual(readThread("maintenance", "one", {...data, readBy: {[resident.id]: 1}}, resident)?.messages[0].readBy, [resident.id]);
  const request = { ...crewReply, senderId: String(resident.id), senderRole: "resident" };
  assert.deepEqual(readThread("maintenance", "one", {...data, messages:[request]}, resident)?.messages[0].readBy, [other.id]);
  assert.equal("readBy" in crewReply, false, "stored message is never rewritten");
  for (const role of ["resident", "crew", "staff"])
    assert.equal(officeManager({ ...other, role }), false);
  for (const role of ["admin", "vip"])
    assert.equal(officeManager({ ...other, role }), true);
});

test("office avatars resolve older messages by sender identity and use current profile photos", () => {
  const message = {
    id: "old",
    senderId: String(resident.id),
    senderName: "Community Office",
    senderRole: "vip",
    body: "Hello",
    createdAt: 1,
    senderAvatar: "",
  };
  assert.equal(
    messageAvatar(message, [
      { ...resident, role: "vip", avatar_url: "current.jpg" },
    ]),
    "current.jpg",
  );
  assert.equal(
    messageAvatar({ ...message, senderAvatar: "saved.jpg" }, []),
    "saved.jpg",
  );
  assert.equal(
    messageAvatar(message, [
      { ...other, name: message.senderName, avatar_url: "wrong.jpg" },
    ]),
    "",
  );
});

test("directory supports real interests and does not fabricate a membership date", () => {
  const person = {
    ...other,
    unit: "Villa 12",
    interests: ["Gardening", "Gardening", null, ""],
    createdAt: "2025-06-01",
  };
  assert.deepEqual(profileInterests(person), ["Gardening"]);
  assert.equal(matchesNeighbor(person, "garden"), true);
  assert.equal(matchesNeighbor(person, "villa 12"), true);
  assert.equal(residentSince(person), "2025");
  assert.equal(residentSince(other), "");
  assert.equal(residentSince({ ...other, createdAt: "invalid" }), "");
});

test("UID case, legacy aliases, approval and per-user cursors fail closed", () => {
  const messages = [{id:"one", senderId:other.id, senderRole:"resident", senderName:other.name, body:"Hello", createdAt:1}];
  const data = { identityVersion:2, participantIds:[resident.id,other.id], participants:[resident,other], messages, unreadBy:[resident.id], readBy:{[resident.id]:1} };
  assert.equal(readThread("friend", "one", data, resident)?.unread, false);
  assert.equal(readThread("friend", "one", {...data, readBy:{[resident.id]:0}}, resident)?.unread, true);
  assert.equal(readThread("friend", "one", {...data, hiddenBy:{[resident.id]:1}}, resident), null);
  assert.ok(readThread("friend", "one", {...data, hiddenBy:{[other.id]:1}}, resident));
  assert.ok(readThread("friend", "one", {...data, hiddenBy:{[resident.id]:1}, messages:[...messages, {...messages[0],id:"two"}]}, resident));
  assert.equal(readThread("friend", "one", {...data, identityVersion:undefined}, resident), null);
  assert.equal(readThread("friend", "one", {...data, participantIds:[resident.email,other.id]}, resident), null);
  assert.equal(readThread("friend", "one", data, {...resident, id: String(resident.id).toUpperCase()}), null);
  assert.equal(readThread("friend", "one", data, {...resident, approved:false}), null);
  assert.equal(readThread("office", "one", {residentId:other.id,residentEmail:resident.email}, resident), null);
});


test("migrated friend chats route by canonical UID while displaying legacy participant IDs", () => {
 const me = { ...resident, id: "MixedCaseUid", email: "me@example.invalid" };
 const peer = { ...other, id: "OtherCaseUid", name: "Neighbor" };
 const data = { identityVersion: 2, participantIds: [me.id, peer.id], participants: [
   { id: "mixedcaseuid", name: "Me" }, { id: "othercaseuid", name: peer.name }
 ], unreadBy: ["me_example_invalid"], messages: [] };
 const thread = readThread("friend", "legacy", data, me);
 assert.equal(thread?.recipient.id, peer.id);
 assert.equal(thread?.name, peer.name);
 assert.equal(thread?.unread, true);
 assert.equal(readThread("friend", "legacy", data, { ...me, id: "mixedcaseuid" }), null);
 assert.equal(data.participants[0].id, "mixedcaseuid");
});
