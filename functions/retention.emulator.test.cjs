'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { initializeApp, deleteApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { deleteIfExpired, RETENTION_MS } = require('./retention.cjs');

const host = process.env.FIRESTORE_EMULATOR_HOST ?? '';
assert.match(host, /^127\.0\.0\.1:\d+$/, 'Disposable local Firestore emulator required');

test('hourly Work Order retention preserves held and reported tickets and the 30-day policy', async () => {
  const app = initializeApp({ projectId: 'demo-townloop-retention-phase1' }, 'retention-phase1');
  const db = getFirestore(app);
  const order = id => db.collection('work_orders').doc(id);
  const now = Date.now();
  const old = { status: 'Done', retentionVersion: 1, completedAt: Timestamp.fromMillis(now - RETENTION_MS) };
  try {
    await Promise.all([
      order('legal').set({ ...old, legalHold: true }),
      order('evidence').set({ ...old, evidenceHold: true }),
      order('reported').set(old),
      order('young').set({ ...old, completedAt: Timestamp.fromMillis(now - RETENTION_MS + 1) }),
      order('eligible').set(old),
      db.doc('moderation_reports/review').set({ collection: 'work_orders', id: 'reported' }),
      db.doc('database_cleanup_control/active').set({ collections: ['work_orders'] }),
    ]);
    assert.equal(await deleteIfExpired(db, order('eligible'), now), false);
    await db.doc('database_cleanup_control/active').set({ collections: [] });
    for (const id of ['legal', 'evidence', 'reported', 'young']) {
      assert.equal(await deleteIfExpired(db, order(id), now), false);
      assert.equal((await order(id).get()).exists, true);
    }
    assert.equal(await deleteIfExpired(db, order('eligible'), now), true);
    assert.equal((await order('eligible').get()).exists, false);
  } finally {
    await deleteApp(app);
  }
});
