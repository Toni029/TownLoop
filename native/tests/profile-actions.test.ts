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
) {
  const writes: { kind: string; ref: any; patch?: any }[] = [];
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
          updateDoc: async (ref: any, patch: any) =>
            writes.push({ kind: "update", ref, patch }),
          doc: (_db: any, collection: string, id: string) => ({
            collection,
            id,
          }),
          runTransaction: async (_db: any, fn: any) =>
            fn({
              get: async () => ({ exists: () => true, data: () => data }),
              set: (ref: any, patch: any) =>
                writes.push({ kind: "set", ref, patch }),
              delete: (ref: any) => writes.push({ kind: "delete", ref }),
              update: (ref: any, patch: any) =>
                writes.push({ kind: "update", ref, patch }),
            }),
        };
      if (name.startsWith("expo-image")) return {};
      if (!name.startsWith(".")) return require(name);
      const stem = path.resolve(path.dirname(file), name);
      if (stem.endsWith("/lib/firebase"))
        return { db: {}, auth: { currentUser: { uid } } };
      if (stem.endsWith("/news/actions"))
        return { approvedUser: async () => user };
      if (stem.endsWith("/lib/liveCollection") || stem.endsWith("/lib/profile"))
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
  };
}
const chat = {
  participantIds: ["alice", "bob"],
  participants: [
    { id: "alice", name: "Alice", email: "alice@example.invalid" },
    { id: "bob", name: "Bob", email: "bob@example.invalid" },
  ],
  unreadBy: ["alice", "bob"],
  messages: [],
};
const thread = { id: "chat-one", category: "friend" };
test("conversation deletion checks real participant identity before writing", async () => {
  const outsider = fixture("mallory", chat);
  await assert.rejects(outsider.actions.deleteThread(thread), /cannot access/);
  assert.equal(outsider.writes.length, 0);
  const owner = fixture("alice", chat);
  await owner.actions.deleteThread(thread);
  assert.deepEqual(owner.writes, [
    { kind: "delete", ref: { collection: "resident_chats", id: "chat-one" } },
  ]);
});
test("mark all read can clear only the current resident unread marker", async () => {
  const owner = fixture("alice", chat);
  await owner.actions.markRead(thread);
  assert.deepEqual(owner.writes[1].patch, { unreadBy: ["bob"] });
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
  const crewTwo = fixture("crew-two", first.patch, "crew");
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
