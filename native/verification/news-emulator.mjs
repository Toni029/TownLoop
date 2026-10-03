/** Local demo-project emulator only. No production testing. */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { rsvpPatch } from "../src/news/model.ts";
if (!process.env.FIRESTORE_EMULATOR_HOST?.startsWith("127.0.0.1:"))
  throw Error("Local disposable emulator required.");
const require = createRequire(process.argv[2]);
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require("@firebase/rules-unit-testing");
const {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  runTransaction,
  onSnapshot,
} = require("firebase/firestore");
const env = await initializeTestEnvironment({
  projectId: "demo-townloop-news",
  firestore: {
    rules: readFileSync(
      new URL("../../firestore.rules", import.meta.url),
      "utf8",
    ),
  },
});
let checks = 0;
try {
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    for (const role of ["admin", "vip", "resident", "crew", "staff", "pending"])
      await setDoc(doc(db, "users", role), {
        id: role,
        name: role,
        email: `${role}@example.invalid`,
        role: role === "pending" ? "resident" : role,
        approved: role !== "pending",
      });
    await setDoc(doc(db, "community_events", "event"), {
      title: "Emulator only",
      month: "OCT",
      day: "20",
      attendees: [],
      attendeesCount: 0,
      spotsLeft: 2,
    });
    await setDoc(doc(db, "community_highlights", "notice"), {
      title: "Emulator only",
    });
    await setDoc(doc(db, "newsletters", "current"), {
      id: "edition",
      isRemoved: false,
    });
    await setDoc(doc(db, "newsletters", "edition", "chunks", "0"), {
      index: 0,
      data: "data:application/pdf;base64,JVBERi0=",
    });
  });
  for (const role of ["admin", "vip", "resident", "crew", "staff"]) {
    const db = env.authenticatedContext(role).firestore();
    await assertSucceeds(getDoc(doc(db, "community_events", "event")));
    await assertSucceeds(getDoc(doc(db, "community_highlights", "notice")));
    checks += 2;
  }
  await assertFails(
    getDoc(
      doc(
        env.unauthenticatedContext().firestore(),
        "community_events",
        "event",
      ),
    ),
  );
  await assertFails(
    getDoc(
      doc(
        env.authenticatedContext("pending").firestore(),
        "community_events",
        "event",
      ),
    ),
  );
  checks += 2;
  for (const role of ["resident", "crew", "staff", "pending"]) {
    const db = env.authenticatedContext(role).firestore();
    await assertFails(
      updateDoc(doc(db, "community_events", "event"), { attendeesCount: 1 }),
    );
    await assertFails(
      setDoc(doc(db, "community_highlights", "new"), { title: "denied" }),
    );
    await assertFails(
      updateDoc(doc(db, "newsletters", "current"), { isRemoved: true }),
    );
    checks += 3;
  }
  const admin = env.authenticatedContext("admin").firestore(),
    vip = env.authenticatedContext("vip").firestore();
  await Promise.all(
    [
      ["admin", admin],
      ["vip", vip],
    ].map(([id, db]) =>
      runTransaction(db, async (tx) => {
        const ref = doc(db, "community_events", "event");
        const snap = await tx.get(ref);
        const patch = rsvpPatch(
          snap.data(),
          { id, name: id, email: `${id}@example.invalid` },
          true,
          Date.now(),
        );
        if (patch) tx.update(ref, patch);
      }),
    ),
  );
  const event = (await getDoc(doc(admin, "community_events", "event"))).data();
  assert.equal(event.attendeesCount, 2);
  assert.equal(event.spotsLeft, 0);
  assert.equal(new Set(event.attendees.map((a) => a.userId)).size, 2);
  checks++;
  const removed = new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(Error("Removal listener timeout")),
      5000,
    );
    const stop = onSnapshot(
      doc(
        env.authenticatedContext("resident").firestore(),
        "newsletters",
        "current",
      ),
      (snap) => {
        if (snap.data()?.isRemoved) {
          clearTimeout(timer);
          stop();
          resolve();
        }
      },
      reject,
    );
  });
  await assertSucceeds(
    updateDoc(doc(admin, "newsletters", "current"), {
      isRemoved: true,
      pdfUrl: "",
    }),
  );
  await removed;
  await assertSucceeds(
    deleteDoc(doc(admin, "newsletters", "edition", "chunks", "0")),
  );
  assert.equal(
    (
      await getDoc(doc(admin, "newsletters", "edition", "chunks", "0"))
    ).exists(),
    false,
  );
  checks += 3;
  console.log(
    `${checks} emulator permission/concurrency/removal checks passed. Resident RSVP blocked by unchanged rules confirmed. No production access.`,
  );
} finally {
  await env.cleanup();
}
