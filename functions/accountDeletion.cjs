const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore, FieldPath, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { randomUUID } = require('node:crypto');
const { jobIdFor, SHARED, validateRequest, referencesUid, approvedRetention, approvedSocialDeletion, ownsSocial, approvedSharedSocialRetention } = require('./accountDeletionPolicy.cjs');
const database = process.env.TOWNLOOP_FIRESTORE_DATABASE_ID || '(default)';
const options = { region: 'us-central1', maxInstances: 1, timeoutSeconds: 300 };
exports.requestAccountDeletion = onCall({ ...options, timeoutSeconds: 60 }, async request => {
  const invalid = validateRequest(request.auth, request.data);
  if (invalid) throw new HttpsError(invalid === 'unauthenticated' ? 'unauthenticated' : 'failed-precondition', invalid);
  // Callable authentication checks the signature; additionally reject revoked/disabled sessions.
  const bearer = request.rawRequest.headers.authorization?.match(/^Bearer (.+)$/i)?.[1];
  if (!bearer) throw new HttpsError('unauthenticated', 'Missing session.');
  let verified;
  try { verified = await getAuth().verifyIdToken(bearer, true); } catch { throw new HttpsError('unauthenticated', 'Sign in again.'); }
  if (verified.uid !== request.auth.uid || validateRequest({ uid: verified.uid, token: verified }, request.data))
    throw new HttpsError('failed-precondition', 'Sign in again before deleting your account.');
  const db = getFirestore(database), jobId = jobIdFor(verified.uid), ref = db.doc(`account_deletion_jobs/${jobId}`);
  await db.runTransaction(async tx => {
    const [existing, profile] = await Promise.all([tx.get(ref), tx.get(db.doc(`users/${verified.uid}`))]);
    if (!existing.exists) tx.create(ref, { uid: verified.uid, phase: 'disable', status: 'queued',
      createdAt: FieldValue.serverTimestamp(), lastAttemptAt: FieldValue.serverTimestamp(), collectionIndex: 0, cursor: '', inventoryComplete: false });
    if (profile.exists) tx.update(profile.ref, { deletionPending: true });
    tx.delete(db.doc(`resident_directory/${verified.uid}`));
  });
  return { jobId, status: 'queued' };
});

async function processJob(db, auth, ref) {
  const snapshot = await ref.get();
  if (!snapshot.exists || snapshot.data().status === 'complete') return;
  const job = snapshot.data(), uid = job.uid;
  if (typeof uid !== 'string' || !uid || uid.includes('/')) throw Error('Invalid deletion job');
  if (job.phase === 'disable') {
    try { await auth.updateUser(uid, { disabled: true }); await auth.revokeRefreshTokens(uid); }
    catch (error) { if (error.code !== 'auth/user-not-found') throw error; }
    await ref.update({ phase: 'inventory', status: 'processing' });
    return;
  }
  if (job.phase === 'private') {
    // Paginated and restart-safe. Never touch delivery/audit records or counters here.
    const devices = await db.collection('notification_devices').where('uid', '==', uid).limit(100).get();
    if (!devices.empty) {
      const batch = db.batch(); devices.docs.forEach(device => batch.delete(device.ref)); await batch.commit(); return;
    }
    const blocks = await db.collection(`user_blocks/${uid}/targets`).limit(100).get();
    if (!blocks.empty) {
      const batch = db.batch(); blocks.docs.forEach(block => batch.delete(block.ref)); await batch.commit(); return;
    }
    const batch = db.batch(); batch.delete(db.doc(`users/${uid}`)); batch.delete(db.doc(`resident_directory/${uid}`));
    batch.delete(db.doc(`safety_limits/${uid}`));
    batch.update(ref, { phase: 'auth' }); await batch.commit(); return;
  }
  if (job.phase === 'auth') {
    try { await auth.deleteUser(uid); } catch (error) { if (error.code !== 'auth/user-not-found') throw error; }
    await ref.update({ phase: job.mediaCleanupRequired ? 'media' : 'done', status: job.mediaCleanupRequired ? 'identity_complete_media_pending' : 'complete',
      mediaCleanupStatus: job.mediaCleanupRequired ? 'waiting_for_policy_gated_jobs' : 'no_owned_social_deletion_requested',
      identityDeletedAt: FieldValue.serverTimestamp(), ...(job.mediaCleanupRequired ? { mediaCursor: '' } : { completedAt: FieldValue.serverTimestamp() }) }); return;
  }
  if (job.phase === 'media') {
    let query = ref.collection('inventory').orderBy(FieldPath.documentId()).limit(100);
    if (job.mediaCursor) query = query.startAfter(job.mediaCursor);
    const page = await query.get();
    for (const receipt of page.docs) {
      const cleanupJobId = receipt.data().cleanupJobId;
      if (!cleanupJobId) continue;
      const cleanup = await db.doc(`media_cleanup_jobs/${cleanupJobId}`).get();
      if (!cleanup.exists || cleanup.data().status !== 'complete') {
        await ref.update({ mediaCleanupStatus: cleanup.exists ? 'waiting_for_policy_gated_jobs' : 'missing_cleanup_job_requires_review' }); return;
      }
    }
    await ref.update(page.size === 100 ? { mediaCursor: page.docs.at(-1).id } : {
      phase: 'done', status: 'complete', mediaCleanupStatus: 'all_tracked_jobs_complete', completedAt: FieldValue.serverTimestamp(),
    }); return;
  }
  if (job.phase === 'inventory') {
    const collection = SHARED[job.collectionIndex];
    if (!collection) { await ref.update({ phase: 'policy', inventoryComplete: true }); return; }
    let query = db.collection(collection).orderBy(FieldPath.documentId()).limit(100);
    if (job.cursor) query = query.startAfter(job.cursor);
    const page = await query.get(), batch = db.batch();
    for (const record of page.docs) if (referencesUid(record.data(), uid)) {
      batch.set(ref.collection('inventory').doc(jobIdFor(record.ref.path)), { path: record.ref.path, collection, state: 'pending_policy' });
    }
    batch.update(ref, page.size < 100 ? { collectionIndex: job.collectionIndex + 1, cursor: '' } : { cursor: page.docs.at(-1).id });
    await batch.commit(); return;
  }
  if (job.phase === 'policy') {
    const policy = (await db.doc('deletion_policies/account').get()).data();
    // Resolve one bounded page. Unknown decisions stay visible and retryable, never silently complete.
    const pending = await ref.collection('inventory').where('state', '==', 'pending_policy').limit(100).get();
    const batch = db.batch(); let resolved = 0;
    for (const item of pending.docs) {
      const inventory = item.data();
      if (approvedRetention(policy, inventory.collection)) {
        batch.update(item.ref, { state: 'retained_by_approved_policy', approvalReference: policy.approvalReference }); resolved++;
      } else if (approvedSocialDeletion(policy, inventory.collection)) {
        const changed = await db.runTransaction(async tx => {
          const cleanupJobId = jobIdFor(`account:${ref.path}:${inventory.path}`), cleanupRef = db.doc(`media_cleanup_jobs/${cleanupJobId}`);
          const recordRef = db.doc(inventory.path), [record, receipt, cleanup] = await Promise.all([tx.get(recordRef), tx.get(item.ref), tx.get(cleanupRef)]);
          if (receipt.data()?.state !== 'pending_policy') return false;
          if (!record.exists) {
            tx.update(item.ref, { state: 'already_absent', approvalReference: policy.approvalReference }); return true;
          }
          if (ownsSocial(record.data(), uid)) {
            // Atomic parent deletion, permanent ID tombstone and tracked durable media job.
            // The Firestore deletion trigger may also enqueue; generation-safe work is idempotent.
            if (!cleanup.exists) tx.create(cleanupRef, { collection: inventory.collection, recordId: record.id, uid,
              accountDeletionJobId: ref.path.split('/').at(-1), status: 'queued', pageToken: '',
              createdAt: FieldValue.serverTimestamp(), lastAttemptAt: FieldValue.serverTimestamp() });
            tx.set(db.doc(`media_deletion_tombstones/${inventory.collection}/records/${record.id}`), { deletedAt: FieldValue.serverTimestamp() });
            tx.delete(recordRef);
            tx.update(item.ref, { state: 'deleted_owned_social', approvalReference: policy.approvalReference, cleanupJobId, mediaCleanup: 'separate_policy_gated_jobs' });
            tx.update(ref, { mediaCleanupRequired: true }); return true;
          }
          // Authored comments in another resident's post are shared history.
          if (approvedSharedSocialRetention(policy, inventory.collection)) {
            tx.update(item.ref, { state: 'shared_reference_retained_by_approved_policy', approvalReference: policy.approvalReference }); return true;
          }
          return false;
        });
        if (changed) resolved++;
      }
    }
    if (resolved) await batch.commit();
    await ref.update(pending.empty ? { phase: 'private', status: 'processing' } : {
      status: resolved ? 'processing' : 'pending_owner_approval', policyBlock: 'Shared history requires explicit collection policy; anonymization is not yet approved.' });
  }
}
exports.resumeAccountDeletions = onSchedule({ ...options, schedule: 'every 5 minutes', timeZone: 'Etc/UTC' }, async () => {
  const db = getFirestore(database);
  const jobs = await db.collection('account_deletion_jobs').where('status', 'in', ['queued', 'processing', 'pending_owner_approval', 'identity_complete_media_pending']).orderBy('lastAttemptAt').limit(20).get();
  for (const job of jobs.docs) {
    const leaseOwner = randomUUID();
    const claimed = await db.runTransaction(async tx => {
      const current = (await tx.get(job.ref)).data();
      if (!current || current.status === 'complete' || current.leaseUntil > Date.now()) return false;
      // Lease exceeds this invocation's 300-second timeout. A crashed invocation is
      // reclaimable; overlapping cron deliveries cannot advance stale job phases.
      tx.update(job.ref, { leaseOwner, leaseUntil: Date.now() + 6 * 60000 }); return true;
    });
    if (!claimed) continue;
    let failed = false;
    try {
      // Enough phases to promptly remove identity; inventories remain bounded per invocation.
      for (let step = 0; step < 8; step++) await processJob(db, getAuth(), job.ref);
    } catch { failed = true; }
    finally {
      await db.runTransaction(async tx => {
        if ((await tx.get(job.ref)).data()?.leaseOwner === leaseOwner) tx.update(job.ref, {
          lastAttemptAt: FieldValue.serverTimestamp(), lastError: failed ? 'retry_required' : FieldValue.delete(),
          leaseOwner: FieldValue.delete(), leaseUntil: FieldValue.delete(),
        });
      });
    }
  }
});
