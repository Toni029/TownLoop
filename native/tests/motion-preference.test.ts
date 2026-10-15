import test from "node:test";
import assert from "node:assert/strict";
import { createMotionPreferenceStore } from "../src/motion/preference.ts";
test("consumers share one accessibility listener and respond to system changes", async () => {
  let starts = 0, stops = 0, changes = 0;
  let next!: (value: boolean) => void;
  const store = createMotionPreferenceStore({ read: async () => false, listen: fn => { starts++; next = fn; return () => { stops++; }; } });
  const first = store.subscribe(() => { changes++; }), second = store.subscribe(() => { changes++; });
  await Promise.resolve();
  assert.equal(starts, 1); assert.equal(store.snapshot(), false); assert.equal(changes, 2);
  next(true); assert.equal(store.snapshot(), true); assert.equal(changes, 4);
  first(); assert.equal(stops, 0); second(); assert.equal(stops, 1);
});
test("a late query cannot override a newer accessibility event", async () => {
  let resolve!: (value: boolean) => void, next!: (value: boolean) => void;
  const store = createMotionPreferenceStore({ read: () => new Promise(done => { resolve = done; }), listen: fn => { next = fn; return () => {}; } });
  const stop = store.subscribe(() => {});
  next(true); resolve(false); await Promise.resolve();
  assert.equal(store.snapshot(), true); stop();
});
