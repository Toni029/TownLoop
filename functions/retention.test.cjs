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
  const ref = { path: 'work_orders/test', id: 'test' };
  const lock = {}, query = { where: () => query, limit: () => query };
  const db = {
    doc: () => lock,
    collection: () => query,
    runTransaction: callback => callback({
      get: async target => target === ref ? { exists: !!current, data: () => current }
        : target === query ? { empty: true } : { data: () => undefined },
      delete: actual => { assert.equal(actual, ref); removed++; current = null; },
    }),
  };
  assert.equal(await deleteIfExpired(db, ref, now), true);
  assert.equal(await deleteIfExpired(db, ref, now), false);
  current = { ...old, status: 'In Progress' };
  assert.equal(await deleteIfExpired(db, ref, now), false);
  assert.equal(removed, 1);
});

test('eligible completed orders with current evidence or maintenance holds remain intact', async () => {
  const ref = { path: 'work_orders/test', id: 'test' };
  let current = old, lock = {}, report = false, removed = 0;
  const query = { where: () => query, limit: () => query };
  const db = {
    doc: path => ({ path }),
    collection: () => query,
    runTransaction: callback => callback({
      get: async target => target === ref ? { exists: true, data: () => current }
        : target === query ? { empty: !report } : { data: () => lock },
      delete: () => removed++,
    }),
  };
  for (const hold of [
    { legalHold: true },
    { evidenceHold: { by: 'fixture' } },
    { hold: 'retention check' },
    { retentionUntil: { toMillis: () => now + 1 } },
  ]) {
    current = { ...old, ...hold };
    assert.equal(await deleteIfExpired(db, ref, now), false);
  }
  current = old;
  report = true;
  assert.equal(await deleteIfExpired(db, ref, now), false);
  report = false;
  for (const guard of [{ referenceWritesBlocked: true }, { accountDeletionOwner: 'fixture' }, { collections: ['work_orders'] }]) {
    lock = guard;
    assert.equal(await deleteIfExpired(db, ref, now), false);
  }
  assert.equal(removed, 0);
  lock = {};
  assert.equal(await deleteIfExpired(db, ref, now), true);
  assert.equal(removed, 1);
});
