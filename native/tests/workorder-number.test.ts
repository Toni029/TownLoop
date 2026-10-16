import test from 'node:test';
import assert from 'node:assert/strict';
import { nextWorkOrderNumber, workOrderCode } from '../../src/data/workOrderNumber.ts';
test('four-digit sequence starts at 1000 and ends safely at 9999', () => {
  assert.equal(nextWorkOrderNumber(999), 1000);
  assert.equal(nextWorkOrderNumber(9998), 9999);
  for (const n of [1000,1888,8888,9999]) assert.equal(workOrderCode(n), String(n));
  assert.throws(() => nextWorkOrderNumber(9999), /used/);
});
test('missing or corrupt counters never reset or reuse numbers', () => {
  for (const n of [undefined,null,'1000',998,10000,1000.5,NaN,Number.MAX_SAFE_INTEGER]) assert.throws(() => nextWorkOrderNumber(n));
  for (const n of [999,10000]) assert.throws(() => workOrderCode(n));
});
