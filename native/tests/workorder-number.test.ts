import test from "node:test";
import assert from "node:assert/strict";
import {
  nextWorkOrderNumber,
  workOrderCode,
} from "../../src/data/workOrderNumber.ts";
test("new sequence avoids old random four-digit range and grows without truncation", () => {
  assert.equal(workOrderCode(nextWorkOrderNumber(undefined)), "WO-10000");
  assert.equal(nextWorkOrderNumber(10000), 10001);
  assert.equal(workOrderCode(nextWorkOrderNumber(99999)), "WO-100000");
});
test("invalid counter never silently resets and reuses a ticket number", () => {
  for (const value of [
    null,
    "10000",
    9999,
    10000.5,
    NaN,
    Number.MAX_SAFE_INTEGER,
  ])
    assert.throws(() => nextWorkOrderNumber(value));
});
