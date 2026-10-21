// Only unsigned mocked-auth contexts in a disposable local Firestore emulator.
// Does not create Firebase Authentication accounts or connect to production.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
if (!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || ""))
  throw Error("Loopback Firestore emulator required");
const require = createRequire(process.argv[2]);
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require("@firebase/rules-unit-testing");
const {
  doc,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  deleteDoc,
  collection,
  query,
  where,
  or,
} = require("firebase/firestore");
const env = await initializeTestEnvironment({
  projectId: "demo-townloop-marketplace-c1",
  firestore: {
    rules: readFileSync(
      new URL("../../security/c1/firestore.c1-candidate.rules", import.meta.url),
      "utf8",
    ),
  },
});
const db = (uid) => env.authenticatedContext(uid).firestore(),
  ref = (uid, id = "mkt_item_buyeruid") =>
    doc(db(uid), "marketplace_chats", id);
const msg = (uid, id = "first", text = "Hello") => ({
  id,
  senderId: uid,
  senderName: uid,
  senderAvatar: "",
  text,
  timestamp: "12:00 PM",
  createdAt: 100,
});
const summary = (m) => ({
  lastMessage: m.text,
  lastMessageTime: m.timestamp,
  updatedAt: m.createdAt,
});
const first = msg("BuyerUID");
const chat = {
  id: "mkt_item_buyeruid",
  itemId: "item",
  itemTitle: "Item",
  itemPrice: "FREE",
  itemMediaUrl: "",
  sellerId: "SellerUID",
  sellerName: "SellerUID",
  sellerAvatar: "",
  sellerApt: "",
  buyerId: "BuyerUID",
  buyerName: "BuyerUID",
  buyerAvatar: "",
  buyerApt: "",
  participantIds: ["SellerUID", "BuyerUID"],
  messages: [first],
  ...summary(first),
  unreadForBuyer: false,
  unreadForSeller: true,
};
let checks = 0;
const yes = async (p) => {
    await assertSucceeds(p);
    checks++;
  },
  no = async (p) => {
    await assertFails(p);
    checks++;
  };
try {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    for (const [uid, role, approved] of [
      ["BuyerUID", "resident", true],
      ["SellerUID", "resident", true],
      ["OtherUID", "resident", true],
      ["admin", "admin", true],
      ["vip", "vip", true],
      ["crew", "crew", true],
      ["pending", "resident", false],
      ["missingApproval", "resident", undefined],
    ]) {
      const p = { name: uid, role };
      if (approved !== undefined) p.approved = approved;
      await setDoc(doc(ctx.firestore(), "users", uid), p);
    }
    await setDoc(doc(ctx.firestore(), "marketplace_posts", "item"), {
      userId: "SellerUID",
      title: "Item",
      price: "FREE",
      sold: false,
    });
  });
  await yes(getDoc(ref("BuyerUID"))); // Missing document read needed for atomic create.
  await yes(setDoc(ref("BuyerUID"), chat));
  for (const uid of ["BuyerUID", "SellerUID"]) {
    await yes(getDoc(ref(uid)));
    const own = query(
      collection(db(uid), "marketplace_chats"),
      or(where("sellerId", "==", uid), where("buyerId", "==", uid)),
    );
    const snap = await assertSucceeds(getDocs(own));
    assert.equal(snap.size, 1);
    checks++;
  }
  for (const uid of [
    "OtherUID",
    "admin",
    "vip",
    "crew",
    "pending",
    "missingApproval",
  ])
    await no(getDoc(ref(uid)));
  await no(
    getDoc(
      doc(
        env.unauthenticatedContext().firestore(),
        "marketplace_chats",
        "mkt_item_buyeruid",
      ),
    ),
  );
  await no(getDocs(collection(db("BuyerUID"), "marketplace_chats")));
  await no(
    getDocs(
      query(
        collection(db("OtherUID"), "marketplace_chats"),
        where("participantIds", "array-contains", "BuyerUID"),
      ),
    ),
  );
  await no(setDoc(ref("OtherUID", "fake"), { ...chat, id: "fake" }));
  await no(setDoc(ref("SellerUID", "fake"), { ...chat, id: "fake" }));
  await no(
    setDoc(ref("BuyerUID", "fake"), {
      ...chat,
      id: "fake",
      sellerId: "OtherUID",
      participantIds: ["OtherUID", "BuyerUID"],
    }),
  );
  await no(
    setDoc(ref("BuyerUID", "fake"), {
      ...chat,
      id: "fake",
      participantIds: ["BuyerUID", "OtherUID"],
    }),
  );
  await no(
    setDoc(ref("BuyerUID", "fake"), {
      ...chat,
      id: "fake",
      messages: [{ ...first, senderId: "SellerUID" }],
    }),
  );
  await no(updateDoc(ref("BuyerUID"), { sellerId: "OtherUID" }));
  await no(
    updateDoc(ref("BuyerUID"), { participantIds: ["BuyerUID", "OtherUID"] }),
  );
  await no(
    updateDoc(ref("BuyerUID"), { messages: [{ ...first, text: "Rewritten" }] }),
  );
  await no(updateDoc(ref("BuyerUID"), { messages: [] }));
  await no(
    updateDoc(ref("BuyerUID"), {
      messages: [{ ...first, senderName: "admin" }],
      unreadForBuyer: false,
    }),
  );
  await yes(updateDoc(ref("SellerUID"), { unreadForSeller: false }));
  await no(updateDoc(ref("BuyerUID"), { unreadForSeller: true }));
  const reply = msg("SellerUID", "second", "Reply\nwith multiple lines");
  const patch = {
    messages: [first, reply],
    ...summary(reply),
    unreadForBuyer: true,
    unreadForSeller: false,
  };
  await yes(updateDoc(ref("SellerUID"), patch));
  await no(
    updateDoc(ref("BuyerUID"), {
      ...patch,
      messages: [first, reply, { ...msg("SellerUID", "spoof") }],
    }),
  );
  const forged = msg("BuyerUID", "third");
  forged.senderName = "SellerUID";
  await no(
    updateDoc(ref("BuyerUID"), {
      messages: [first, reply, forged],
      ...summary(forged),
      unreadForSeller: true,
      unreadForBuyer: false,
    }),
  );
  await no(updateDoc(ref("OtherUID"), { unreadForBuyer: false }));
  await no(deleteDoc(ref("BuyerUID")));
  const left = {
    ...msg("SellerUID", "leave", "SellerUID left the conversation."),
    senderId: "system",
    senderName: "System",
    isSystem: true,
    actorId: "SellerUID",
  };
  await no(
    updateDoc(ref("BuyerUID"), {
      sellerLeft: true,
      deletedBySeller: true,
      messages: [first, reply, left],
      ...summary(left),
    }),
  );
  await yes(
    updateDoc(ref("SellerUID"), {
      sellerLeft: true,
      deletedBySeller: true,
      messages: [first, reply, left],
      ...summary(left),
    }),
  );
  const later = msg("BuyerUID", "later");
  await no(
    updateDoc(ref("BuyerUID"), {
      messages: [first, reply, left, later],
      ...summary(later),
      unreadForSeller: true,
      unreadForBuyer: false,
    }),
  );
  await no(
    updateDoc(ref("SellerUID"), { sellerLeft: false, deletedBySeller: false }),
  );
  await no(deleteDoc(ref("OtherUID")));
  await yes(deleteDoc(ref("BuyerUID"))); // Second participant leaves: compatible hard delete.
  // Historical sanitized participantIds are not authorization; exact UID fields remain readable.
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "marketplace_chats", "legacy"), {
      ...chat,
      id: "legacy",
      participantIds: ["selleruid", "buyeruid"],
    });
    await setDoc(doc(ctx.firestore(), "marketplace_chats", "ambiguous"), {
      ...chat,
      id: "ambiguous",
      sellerId: "Seller Display Name",
      buyerId: "Buyer Display Name",
    });
  });
  await yes(getDoc(ref("BuyerUID", "legacy")));
  await yes(getDoc(ref("SellerUID", "legacy")));
  await yes(updateDoc(ref("SellerUID", "legacy"), patch));
  await no(getDoc(ref("BuyerUID", "ambiguous")));
  await no(getDoc(ref("SellerUID", "ambiguous")));
  // A lossy UID in legacy deletedBy is not permission to delete someone else's history.
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "marketplace_chats", "alias-left"), {
      ...chat,
      id: "alias-left",
      deletedBy: ["selleruid"],
    });
  });
  await no(deleteDoc(ref("BuyerUID", "alias-left")));
  // Execute the real shared web/native write protocol against the same isolated rules.
  const local = createRequire(new URL("../package.json", import.meta.url));
  const ts = local("typescript");
  const source = readFileSync(
    new URL("../../src/services/marketplaceChatProtocol.ts", import.meta.url),
    "utf8",
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };
  const identity = { exports: {} };
  const identitySource = ts.transpileModule(readFileSync(
    new URL('../../src/services/marketplaceChatIdentity.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('module', 'exports', identitySource)(identity, identity.exports);
  new Function("require", "module", "exports", compiled)(
    (id) => id === './marketplaceChatIdentity' ? identity.exports : require(id),
    module,
    module.exports,
  );
  const protocol = module.exports;
  console.log("Protocol check: create");
  const id = await protocol.sendMarketInquiry(
    db("BuyerUID"),
    "BuyerUID",
    "item",
    "First inquiry",
    "operation-1",
  );
  console.log("Protocol check: idempotent inquiry");
  await protocol.sendMarketInquiry(
    db("BuyerUID"),
    "BuyerUID",
    "item",
    "First inquiry",
    "operation-1",
  );
  assert.equal((await getDoc(ref("BuyerUID", id))).data().messages.length, 1);
  checks++;
  console.log("Protocol check: concurrent replies");
  await Promise.all([
    protocol.mutateMarketChat(
      db("SellerUID"),
      "SellerUID",
      id,
      "reply",
      "Seller reply",
      "operation-2",
    ),
    protocol.mutateMarketChat(
      db("BuyerUID"),
      "BuyerUID",
      id,
      "reply",
      "Buyer reply",
      "operation-3",
    ),
  ]);
  assert.equal((await getDoc(ref("BuyerUID", id))).data().messages.length, 3);
  checks++;
  assert.equal(
    (
      await getDocs(protocol.marketplaceChatQuery(db("BuyerUID"), "BuyerUID"))
    ).docs.some((d) => d.id === id),
    true,
  );
  checks++;
  console.log("Protocol check: receipt");
  await protocol.mutateMarketChat(db("SellerUID"), "SellerUID", id, "read");
  checks++;
  console.log("Protocol check: first leave");
  await protocol.mutateMarketChat(db("SellerUID"), "SellerUID", id, "leave");
  checks++;
  await assert.rejects(
    protocol.mutateMarketChat(
      db("BuyerUID"),
      "BuyerUID",
      id,
      "reply",
      "No more replies",
      "operation-4",
    ),
    /left/,
  );
  checks++;
  await protocol.mutateMarketChat(db("BuyerUID"), "BuyerUID", id, "leave");
  const retained = (await getDoc(ref("BuyerUID", id))).data();
  assert.equal(retained.sellerLeft && retained.buyerLeft, true);
  assert.equal(retained.messages.length, 5, 'Leaving preserves the original messages and both leave notices');
  checks++;
  console.log(
    `PASS: ${checks} Marketplace C1 rule assertions; no Auth accounts created; demo emulator only.`,
  );
} finally {
  await env.cleanup();
}
