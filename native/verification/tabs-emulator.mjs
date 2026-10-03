/** Executes native actions against a disposable local emulator only. */
import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";
if (!process.env.FIRESTORE_EMULATOR_HOST?.startsWith("127.0.0.1:"))
  throw Error("Local disposable emulator required.");
const tooling = createRequire(process.argv[2]);
const local = createRequire(new URL("../package.json", import.meta.url));
const ts = local("typescript");
const fb = tooling("firebase/firestore");
const { initializeTestEnvironment, assertFails } = tooling(
  "@firebase/rules-unit-testing",
);
const root = fileURLToPath(new URL("../../", import.meta.url));
const env = await initializeTestEnvironment({
  projectId: "demo-townloop-news",
  firestore: {
    rules: readFileSync(path.join(root, "firestore.rules"), "utf8"),
  },
});
let checks = 0;
function actionsFor(uid, folder) {
  const db = env.authenticatedContext(uid).firestore();
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const output = ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;
    const require = (name) => {
      if (name === "firebase/firestore") return fb;
      if (!name.startsWith(".")) return local(name);
      const stem = path.resolve(path.dirname(file), name);
      if (stem === path.join(root, "native/src/lib/firebase")) return { db };
      if (stem === path.join(root, "native/src/news/actions"))
        return {
          approvedUser: async () => {
            const snap = await fb.getDoc(fb.doc(db, "users", uid));
            if (!snap.exists() || snap.data().approved === false)
              throw Error("Account must be approved.");
            return { ...snap.data(), id: uid };
          },
        };
      const target = [stem, stem + ".ts", stem + ".tsx"].find(existsSync);
      if (!target) throw Error(`Unresolved ${name}`);
      return load(target);
    };
    new Function("require", "module", "exports", output)(
      require,
      module,
      module.exports,
    );
    return module.exports;
  }
  return {
    db,
    actions: load(path.join(root, `native/src/${folder}/actions.ts`)),
  };
}
try {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    for (const role of [
      "resident",
      "other",
      "admin",
      "vip",
      "crew",
      "staff",
      "pending",
    ])
      await fb.setDoc(fb.doc(ctx.firestore(), "users", role), {
        name: role,
        email: `${role}@example.invalid`,
        approved: role !== "pending",
        role: role === "other" || role === "pending" ? "resident" : role,
        address: "Unit test",
      });
  });
  const resident = actionsFor("resident", "workorders"),
    other = actionsFor("other", "workorders"),
    crew = actionsFor("crew", "workorders"),
    admin = actionsFor("admin", "workorders");
  const draft = {
    title: "Emulator only",
    description: "Local test",
    category: "Plumbing & Fixtures",
    photos: [],
  };
  await Promise.all([
    resident.actions.submitWorkOrder("one", draft),
    resident.actions.submitWorkOrder("one", draft),
  ]);
  assert.equal(
    (await fb.getDocs(fb.collection(resident.db, "work_orders"))).size,
    1,
  );
  checks++;
  await assert.rejects(other.actions.changeWorkOrder("one", "delete"));
  checks++;
  await assert.rejects(
    resident.actions.changeWorkOrder(
      "one",
      "complete",
      "fixed",
      "https://example.invalid/proof",
    ),
  );
  checks++;
  await assert.rejects(
    crew.actions.changeWorkOrder("one", "complete", "fixed"),
  );
  checks++;
  await Promise.all([
    crew.actions.changeWorkOrder("one", "note", "first", "", "first"),
    crew.actions.changeWorkOrder("one", "note", "first", "", "first"),
  ]);
  await crew.actions.changeWorkOrder("one", "note", "second", "", "second");
  await crew.actions.changeWorkOrder(
    "one",
    "complete",
    "resolved",
    "https://example.invalid/proof",
    "resolution",
  );
  let one = (await fb.getDoc(fb.doc(resident.db, "work_orders", "one"))).data();
  assert.equal(one.status, "Done");
  assert.equal(one.comments.length, 3);
  checks++;
  await crew.actions.changeWorkOrder(
    "one",
    "complete",
    "resolved",
    "https://example.invalid/proof",
    "resolution",
  );
  assert.equal(
    (await fb.getDoc(fb.doc(resident.db, "work_orders", "one"))).data().comments
      .length,
    3,
  );
  checks++;
  await assert.rejects(resident.actions.changeWorkOrder("one", "delete"));
  checks++;
  await crew.actions.changeWorkOrder("one", "reopen");
  one = (await fb.getDoc(fb.doc(resident.db, "work_orders", "one"))).data();
  assert.equal(one.status, "In Progress");
  assert.equal(one.completedAt, undefined);
  checks++;
  await resident.actions.changeWorkOrder("one", "delete");
  checks++;
  await resident.actions.submitWorkOrder("two", draft);
  await admin.actions.changeWorkOrder("two", "delete");
  checks++;
  await assert.rejects(
    actionsFor("crew", "workorders").actions.submitWorkOrder("denied", draft),
  );
  checks++;
  await assert.rejects(
    actionsFor("pending", "workorders").actions.submitWorkOrder(
      "denied",
      draft,
    ),
  );
  checks++;
  await assertFails(
    fb.getDocs(
      fb.collection(env.unauthenticatedContext().firestore(), "work_orders"),
    ),
  );
  checks++;
  if (process.argv.includes("--social")) {
    const owner = actionsFor("other", "social"),
      buyer = actionsFor("resident", "social"),
      moderator = actionsFor("admin", "social"),
      neighbor = actionsFor("vip", "social");
    const draft = {
      title: "Local fixture",
      description: "Emulator only",
      price: "25",
      media: [],
    };
    await Promise.all([
      owner.actions.publishSocial("post", "post", draft),
      owner.actions.publishSocial("post", "post", draft),
    ]);
    assert.equal(
      (await fb.getDocs(fb.collection(owner.db, "discussion_feed"))).size,
      1,
    );
    checks++;
    await assert.rejects(buyer.actions.changeSocial("post", "post", "delete"));
    checks++;
    await Promise.all([
      buyer.actions.changeSocial("post", "post", "comment", {
        text: "one",
        commentId: "one",
      }),
      neighbor.actions.changeSocial("post", "post", "comment", {
        text: "two",
        commentId: "two",
      }),
    ]);
    await buyer.actions.changeSocial("post", "post", "comment", {
      text: "one",
      commentId: "one",
    });
    assert.equal(
      (await fb.getDoc(fb.doc(owner.db, "discussion_feed", "post"))).data()
        .comments.length,
      2,
    );
    checks++;
    await Promise.all([
      buyer.actions.changeSocial("post", "post", "like", { liked: true }),
      neighbor.actions.changeSocial("post", "post", "like", { liked: true }),
    ]);
    assert.equal(
      (await fb.getDoc(fb.doc(owner.db, "discussion_feed", "post"))).data()
        .likes,
      2,
    );
    checks++;
    await buyer.actions.changeSocial("post", "post", "like", { liked: false });
    assert.equal(
      (await fb.getDoc(fb.doc(owner.db, "discussion_feed", "post"))).data()
        .likes,
      1,
    );
    checks++;
    await owner.actions.publishSocial("listing", "listing", draft);
    await assert.rejects(
      buyer.actions.changeSocial("listing", "listing", "sold", { sold: true }),
    );
    checks++;
    await owner.actions.changeSocial("listing", "listing", "sold", {
      sold: true,
    });
    let listing = (
      await fb.getDoc(fb.doc(owner.db, "marketplace_posts", "listing"))
    ).data();
    assert.equal(listing.sold, true);
    assert.equal(listing.claimed, true);
    checks++;
    await assert.rejects(buyer.actions.inquire("listing", "Available?", false));
    checks++;
    await owner.actions.changeSocial("listing", "listing", "sold", {
      sold: false,
    });
    const id = await buyer.actions.inquire(
      "listing",
      "Available?",
      true,
      "inquiry",
    );
    await buyer.actions.inquire("listing", "Available?", true, "inquiry");
    let chat = (
      await fb.getDoc(fb.doc(buyer.db, "marketplace_chats", id))
    ).data();
    assert.equal(chat.messages.length, 1);
    assert.equal(chat.unreadForSeller, true);
    checks++;
    await assert.rejects(neighbor.actions.changeChat(id, "reply", "outsider"));
    checks++;
    await owner.actions.changeChat(id, "read");
    assert.equal(
      (await fb.getDoc(fb.doc(owner.db, "marketplace_chats", id))).data()
        .unreadForSeller,
      false,
    );
    checks++;
    await owner.actions.changeChat(id, "reply", "Yes", "reply");
    await owner.actions.changeChat(id, "reply", "Yes", "reply");
    chat = (await fb.getDoc(fb.doc(owner.db, "marketplace_chats", id))).data();
    assert.equal(chat.messages.length, 2);
    assert.equal(chat.unreadForBuyer, true);
    checks++;
    await buyer.actions.changeChat(id, "leave");
    chat = (await fb.getDoc(fb.doc(owner.db, "marketplace_chats", id))).data();
    assert.equal(chat.buyerLeft, true);
    assert.equal(chat.messages.length, 3);
    checks++;
    await assert.rejects(owner.actions.changeChat(id, "reply", "closed"));
    checks++;
    await owner.actions.changeChat(id, "leave");
    assert.equal(
      (await fb.getDoc(fb.doc(owner.db, "marketplace_chats", id))).exists(),
      false,
    );
    checks++;
    await moderator.actions.changeSocial("post", "post", "delete");
    await owner.actions.changeSocial("listing", "listing", "delete");
    checks++;
    await assert.rejects(
      actionsFor("pending", "social").actions.publishSocial(
        "pending",
        "post",
        draft,
      ),
    );
    checks++;
  }
  console.log(
    `${checks} native tab action/permission/idempotence checks passed in a local emulator. No production writes.`,
  );
} finally {
  await env.cleanup();
}
