const { test } = require('node:test');
const assert = require('node:assert/strict');
const { eligible, deleteIfExpired, RETENTION_MS } = require('./retention.cjs');
const now = Date.now();
const old = { status: 'Done', retentionVersion: 1, completedAt: { toMillis: () => now - RETENTION_MS } };
test('retention respects exact 30-day boundary, reopening, and historical opt-out', () => {
  assert.equal(eligible(old, now), true);
  assert.equal(eligible(old, now - 1), false);
  assert.equal(eligible({ ...old, status: 'In Progress' }, now), false);
  assert.equal(eligible({ ...old, retentionVersion: undefined }, now), false);
  assert.equal(eligible({ ...old, completedAt: new Date(0).toISOString() }, now), false);
  assert.equal(eligible({ ...old, completedAt: { toMillis: () => now } }, now), false);
});
test('transaction checks current state, tolerates deletion and never touches attachments', async () => {
  let current = old, removed = 0;
  const ref = { path: 'work_orders/test' };
  const db = { runTransaction: async callback => callback({ get: async () => ({ exists: !!current, data: () => current }), delete: actual => { assert.equal(actual, ref); removed++; current = null; } }) };
  assert.equal(await deleteIfExpired(db, ref, now), true);
  assert.equal(await deleteIfExpired(db, ref, now), false);
  current = { ...old, status: 'In Progress' };
  assert.equal(await deleteIfExpired(db, ref, now), false);
  assert.equal(removed, 1);
});
