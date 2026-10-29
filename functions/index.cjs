const { onSchedule } = require('firebase-functions/v2/scheduler');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { logger } = require('firebase-functions');
const { RETENTION_MS, deleteIfExpired } = require('./retention.cjs');
initializeApp();
exports.cleanupCompletedWorkOrders = onSchedule({ schedule: 'every 60 minutes', region: 'us-central1', timeZone: 'Etc/UTC', timeoutSeconds: 300, maxInstances: 1 }, async () => {
  const db = getFirestore();
  const now = Date.now();
  let cursor;
  let deleted = 0;
  // Bounded runs resume naturally next hour. Transactions tolerate overlapping jobs.
  for (let page = 0; page < 10; page++) {
    let query = db.collection('work_orders').where('retentionVersion', '==', 1)
      .where('completedAt', '<=', Timestamp.fromMillis(now - RETENTION_MS))
      .orderBy('completedAt').limit(100);
    if (cursor) query = query.startAfter(cursor);
    const snapshot = await query.get();
    if (snapshot.empty) break;
    for (const ticket of snapshot.docs) {
      if (await deleteIfExpired(db, ticket.ref, now)) {
        deleted++;
        logger.info('Expired work order removed', { workOrderId: ticket.id });
      }
    }
    cursor = snapshot.docs[snapshot.docs.length - 1];
  }
  logger.info('Work order retention completed', { deleted });
});

// Prepared locally; deploy only after notification credentials and rules review.
Object.assign(exports, require('./inbox.cjs'));

Object.assign(exports, require("./translation.cjs"));

// Prepared privacy projection; deploy only with reviewed directory backfill/rules rollout.
Object.assign(exports, require("./profilePrivacy.cjs"));

// Local launch-security batch: deployment requires separate approval and matching rules/clients.
Object.assign(exports, require('./safety.cjs'));

// Prepared locally; do not deploy without owner-approved deletion/media policies.
Object.assign(exports, require('./accountDeletion.cjs'), require('./mediaCleanup.cjs'));

// C2 authorization projection only; separate explicit deployment approval required.
Object.assign(exports, require('./storageWebAccess.cjs'));

// Prepared only: cleanup-only proof capabilities and scoped processing operations.
const cleanupProof=require('./cleanupProof.cjs');
exports.registerAccountCleanupDevice=cleanupProof.registerAccountCleanupDevice;
exports.checkAccountCleanupProof=cleanupProof.checkAccountCleanupProof;
Object.assign(exports,require('./accountDeletionOperations.cjs'));

// Read-only resident queue lookup; deploy separately from all workers.
exports.getWorkOrderQueuePositions = require("./workOrderQueue.cjs").getWorkOrderQueuePositions;

// Stage A only, disabled by default; scoped deployment and rules require separate approval.
Object.assign(exports, require('./inbox-groups-entry.cjs'));
