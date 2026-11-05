import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url),
  ts = require("typescript");
const root = fileURLToPath(new URL("../../", import.meta.url));
function fixture(
  uid: string,
  data: Record<string, unknown>,
  role = "resident",
  existing = true,
  groupReply: { result?: unknown; error?: Error } = { result: { left: true } },
) {
  const writes: { kind: string; ref: any; patch?: any; value?: unknown }[] = [];
  const calls: { op: string; input: unknown }[] = [];
  const user = {
    id: uid,
    name: uid,
    email: `${uid}@example.invalid`,
    approved: true,
    role,
  };
  const cache = new Map();
  function load(file: string): any {
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const output = ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;
    const local = (name: string): any => {
      if (name === "firebase/firestore")
        return {
          collection: (_db: any, name: string) => ({ collection: name }),
          where: (...args: unknown[]) => args,
          limit: (count: number) => count,
          query: (ref: any, ...constraints: unknown[]) => ({ ref, constraints }),
          getDocs: async () => ({ docs: [] }),
          FieldPath: class { segments: string[]; constructor(...segments: string[]) { this.segments = segments; } },
          serverTimestamp: () => "SERVER_TIMESTAMP",
          updateDoc: async (ref: any, patch: any) =>
            writes.push({ kind: "update", ref, patch }),
          doc: (_db: any, collection: string, id: string) => ({
            collection,
            id,
          }),
          runTransaction: async (_db: any, fn: any) =>
            fn({
              get: async (ref: any) => ({ id: ref.id, exists: () => existing, data: () => data }),
              set: (ref: any, patch: any) =>
                writes.push({ kind: "set", ref, patch }),
              delete: (ref: any) => writes.push({ kind: "delete", ref }),
              update: (ref: any, patch: any, ...values: unknown[]) =>
                writes.push({ kind: "update", ref, patch, ...(values.length ? { value: values[0] } : {}) }),
            }),
        };
      if (name.startsWith("expo-image")) return {};
      if (!name.startsWith(".")) return require(name);
      const stem = path.resolve(path.dirname(file), name);
      if (stem.endsWith("/lib/firebase"))
        return { db: {}, auth: { currentUser: { uid } } };
      if (stem.endsWith("/news/actions"))
        return { approvedUser: async () => user };
      if (stem.endsWith("/groupInbox")) return { groupAction: async (op: string, input: unknown) => {
        calls.push({ op, input });
        if (groupReply.error) throw groupReply.error;
        return groupReply.result;
      } };
      if (stem.endsWith("/notifications/device")) return { refreshBadge: async () => {} };
      if (stem.endsWith("/lib/liveCollection"))
        return {};
      return load([stem, stem + ".ts", stem + ".tsx"].find(existsSync)!);
    };
    new Function("require", "module", "exports", output)(
      local,
      module,
      module.exports,
    );
    return module.exports;
  }
  return {
    actions: load(path.join(root, "native/src/profile/data.ts")),
    writes,
    calls,
  };
}
const chat = {
  identityVersion: 2,
  participantIds: ["alice", "bob"],
  participants: [
    { id: "alice", name: "Alice", email: "alice@example.invalid" },
    { id: "bob", name: "Bob", email: "bob@example.invalid" },
  ],
  unreadBy: ["alice", "bob"],
  messages: [],
};
const thread = { id: "chat-one", category: "friend", data: chat, messages: [] };
test("Admin and VIP can approve an ordinary signup but cannot reapprove a deletion-frozen account", async () => {
  for (const role of ["admin", "vip"]) {
    const fresh = fixture("manager", { role: "resident", approved: false }, role);
    await fresh.actions.manageResident("applicant", { approved: true });
    assert.equal(fresh.writes.length, 1);
    const deleting = fixture("manager", { role: "resident", approved: false, deletionPending: true }, role);
    await assert.rejects(deleting.actions.manageResident("applicant", { approved: true }), /delet/i);
    assert.equal(deleting.writes.length, 0);
  }
});
test("ordinary residents cannot approve signups and missing accounts cannot be recreated by approval", async () => {
  const resident = fixture("resident", { approved: false });
  await assert.rejects(resident.actions.manageResident("applicant", { approved: true }), /Administrator/);
  assert.equal(resident.writes.length, 0);
  const absent = fixture("manager", {}, "admin", false);
  await assert.rejects(absent.actions.manageResident("applicant", { approved: true }), /no longer/);
  assert.equal(absent.writes.length, 0);
});
test("conversation leaving requires server authorization and acknowledgement without direct document writes", async () => {
  const outsider = fixture("mallory", chat, "resident", true, {
    error: Object.assign(new Error("Not a participant"), { code: "functions/permission-denied" }),
  });
  await assert.rejects(outsider.actions.deleteThread(thread), /permission to leave/);
  assert.equal(outsider.writes.length, 0);
  const owner = fixture("alice", chat);
  await owner.actions.deleteThread(thread);
  assert.deepEqual(owner.calls, [{ op: "leaveLegacy", input: { source: "resident_chats", legacyId: "chat-one" } }]);
  assert.equal(owner.writes.length, 0);
  const unconfirmed = fixture("alice", chat, "resident", true, { result: { left: false } });
  await assert.rejects(unconfirmed.actions.deleteThread(thread), /Could not confirm/);
  assert.equal(unconfirmed.writes.length, 0);
  await owner.actions.deleteThread({ ...thread, data: { schemaVersion: 3 } });
  assert.deepEqual(owner.calls[1], { op: "leave", input: { conversationId: "chat-one" } });
  assert.equal(owner.writes.length, 0);
});
test("mark read updates only the current resident cursor and denies outsiders", async () => {
  const owner = fixture("alice", chat);
  await owner.actions.markRead(thread);
  assert.equal(owner.writes.length, 1);
  assert.deepEqual(owner.writes[0].ref, { collection: "resident_chats", id: "chat-one" });
  assert.deepEqual(owner.writes[0].patch.segments, ["readBy", "alice"]);
  assert.equal(owner.writes[0].value, chat.messages.length);
  assert.deepEqual(chat.unreadBy, ["alice", "bob"]);
  const outsider = fixture("mallory", chat);
  await assert.rejects(outsider.actions.markRead(thread), /no longer available/);
  assert.equal(outsider.writes.length, 0);
});

test("crew members append to the same resident conversation without losing previous replies", async () => {
  const resident = {
    id: "alice",
    name: "Alice",
    email: "alice@example.invalid",
  };
  const original = {
    residentId: "alice",
    residentEmail: resident.email,
    messages: [{ id: "first", body: "Please help" }],
  };
  const crewOne = fixture("crew-one", original, "crew");
  await crewOne.actions.sendMessage(
    "maintenance",
    resident,
    "Repair",
    "On my way",
  );
  const first = crewOne.writes[0];
  // set(..., {merge:true}) retains the original resident identity on the server.
  const crewTwo = fixture("crew-two", { ...original, ...first.patch }, "crew");
  await crewTwo.actions.sendMessage(
    "maintenance",
    resident,
    "Repair",
    "I can help too",
  );
  assert.deepEqual(crewTwo.writes[0].ref, first.ref);
  assert.equal(first.ref.collection, "maintenance_chats");
  assert.equal(crewTwo.writes[0].patch.messages.length, 3);
  assert.equal(crewTwo.writes[0].patch.messages[1].senderId, "crew-one");
  assert.equal(crewTwo.writes[0].patch.messages[2].senderId, "crew-two");
  assert.equal(crewTwo.writes[0].patch.unreadByResident, true);
});

test("admin and vip can approve pending residents; residents and crew cannot", async () => {
  for (const role of ["admin", "vip"]) {
    const actor = fixture("manager", {}, role);
    await actor.actions.manageResident("signup", {
      approved: true,
      role: "resident",
    });
    assert.deepEqual(actor.writes[0], {
      kind: "update",
      ref: { collection: "users", id: "signup" },
      patch: { approved: true, role: "resident" },
    });
  }
  for (const role of ["resident", "crew"]) {
    const actor = fixture("outsider", {}, role);
    await assert.rejects(
      actor.actions.manageResident("signup", { approved: true }),
      /Administrator access/,
    );
    assert.equal(actor.writes.length, 0);
  }
});

test("profile detail edits target the signed-in user and cannot change access fields", async () => {
  const actor = fixture("resident", {});
  await actor.actions.updateOwnDetails({
    phone: " 555-0123 ",
    address: "Villa 2",
    wing: "West",
    emergencyContact: "Pat",
    dietaryPreference: "Vegetarian",
    role: "admin",
    approved: true,
  });
  assert.equal(actor.writes[0].ref.id, "resident");
  assert.deepEqual(actor.writes[0].patch, {
    phone: "555-0123",
    address: "Villa 2",
    wing: "West",
    emergencyContact: "Pat",
    emergency_contact: "Pat",
    dietaryPreference: "Vegetarian",
    dietary_preference: "Vegetarian",
  });
  await assert.rejects(
    actor.actions.updateOwnDetails({
      phone: "x".repeat(301),
      address: "",
      wing: "",
      emergencyContact: "",
      dietaryPreference: "",
    }),
    /300/,
  );
  assert.equal(actor.writes.length, 1);
});

test("Office selection sends a participant-restricted direct message to the selected VIP", async () => {
  const f=fixture('alice',{},'resident',false);
  const vip={id:'vip',name:'VIP',email:'vip@example.invalid',role:'vip',approved:true};
  await f.actions.sendMessage('friend',vip,'Office question','Private message',undefined,{officeDirect:true});
  assert.equal(f.writes.length,1);
  const w=f.writes[0];assert.equal(w.ref.collection,'resident_chats');assert.equal(w.patch.officeDirect,true);
  assert.ok(w.patch.participantIds.includes('alice') && w.patch.participantIds.includes('vip'));
  assert.equal(w.patch.participants.length,2);assert.equal(w.patch.participants[1].role,'vip');
  assert.equal(w.patch.unreadByVip,undefined);
  const other=fixture('alice',{},'resident',false);
  await assert.rejects(other.actions.sendMessage('friend',{...vip,role:'crew'},'Question','Body',undefined,{officeDirect:true}),/Admin or VIP/);
  assert.equal(other.writes.length,0);
});
test("profile edit requests persist an owner proposal without changing approved profile fields", async () => {
  for(const role of ['resident','admin']){
    const f=fixture('alice',{residentId:'alice',residentEmail:'alice@example.invalid',messages:[]},role);
    await f.actions.requestProfileUpdate({phone:'123',address:'',dateOfBirth:'',maritalStatus:'',emergencyContactName:'',emergencyContactPhone:'',emergencyContactAddress:''});
    assert.equal(f.writes.length,1);const w=f.writes[0];
    assert.equal(w.kind,'update');assert.deepEqual(w.ref,{collection:'users',id:'alice'});
    assert.deepEqual(Object.keys(w.patch),['profileUpdateRequest']);
    assert.deepEqual(w.patch.profileUpdateRequest,{
      status:'pending',changes:{phone:'123'},previous:{phone:'',address:'',dateOfBirth:'',maritalStatus:'',emergencyContactName:'',emergencyContactPhone:'',emergencyContactAddress:''},
      requestedAt:'SERVER_TIMESTAMP',requestedBy:'alice',
    });
  }
});
