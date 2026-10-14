import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url),
  ts = require("typescript");
const root = fileURLToPath(new URL("../../", import.meta.url));
function fixture(uid: string, data: Record<string, unknown>) {
  const writes: { kind: string; ref: any; patch?: any }[] = [];
  const user = {
    id: uid,
    name: uid,
    email: `${uid}@example.invalid`,
    approved: true,
    role: "resident",
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
          doc: (_db: any, collection: string, id: string) => ({
            collection,
            id,
          }),
          runTransaction: async (_db: any, fn: any) =>
            fn({
              get: async () => ({ exists: () => true, data: () => data }),
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
  assert.deepEqual(owner.writes[0].patch, { unreadBy: ["bob"] });
});
