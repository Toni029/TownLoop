const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore, FieldPath, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { randomUUID } = require('node:crypto');
const { accountPolicyReady, jobIdFor, SHARED, validateRequest, referencesUid, approvedRetention, approvedSocialDeletion, ownsSocial, approvedSharedSocialRetention } = require('./accountDeletionPolicy.cjs');
const database = process.env.TOWNLOOP_FIRESTORE_DATABASE_ID || '(default)';
const options = { region: 'us-central1', maxInstances: 1, timeoutSeconds: 300 };
exports.requestAccountDeletion = onCall({ ...options, timeoutSeconds: 60 }, async request => {
  const invalid = validateRequest(request.auth, request.data);
  if (invalid) throw new HttpsError(invalid === 'unauthenticated' ? 'unauthenticated' : 'failed-precondition', invalid);
  if (request.data?.requestOnly !== true) throw new HttpsError('failed-precondition', 'Update TownLoop or use the public deletion-request page to submit a verified request.');
  // Callable authentication checks the signature; additionally reject revoked/disabled sessions.
  const bearer = request.rawRequest.headers.authorization?.match(/^Bearer (.+)$/i)?.[1];
  if (!bearer) throw new HttpsError('unauthenticated', 'Missing session.');
  let verified;
  try { verified = await getAuth().verifyIdToken(bearer, true); } catch { throw new HttpsError('unauthenticated', 'Sign in again.'); }
  if (verified.uid !== request.auth.uid || validateRequest({ uid: verified.uid, token: verified }, request.data))
    throw new HttpsError('failed-precondition', 'Sign in again before deleting your account.');
  const db = getFirestore(database), jobId = jobIdFor(verified.uid), ref = db.doc(`account_deletion_jobs/${jobId}`);
  const status = await db.runTransaction(async tx => {
    const existing = await tx.get(ref);
    if (!existing.exists) tx.create(ref, { uid: verified.uid, phase: 'requested', status: 'requested',
      createdAt: FieldValue.serverTimestamp(), lastAttemptAt: FieldValue.serverTimestamp(), collectionIndex: 0, cursor: '', inventoryComplete: false });
    return existing.exists ? existing.data().status : 'requested';
  });
  return { jobId, status };
});

// Distinct protocol endpoint: new clients never hit a deployed legacy destructive handler.
exports.submitAccountDeletionRequest = exports.requestAccountDeletion;

// Server-only APIs: Firestore client access to deletion jobs stays denied.
async function verifiedSession(request) {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  const bearer = request.rawRequest?.headers?.authorization?.match(/^Bearer (.+)$/i)?.[1];
  let token;
  try { token = await getAuth().verifyIdToken(bearer || '', true); }
  catch { throw new HttpsError('unauthenticated', 'Sign in again.'); }
  if (token.uid !== request.auth.uid) throw new HttpsError('unauthenticated', 'Session mismatch.');
  return token;
}
async function managerSession(request) {
  const token = await verifiedSession(request);
  const profile = (await getFirestore(database).doc(`users/${token.uid}`).get()).data();
  if (profile?.approved !== true || profile.deletionPending === true || !['admin', 'vip'].includes(profile.role))
    throw new HttpsError('permission-denied', 'Admin/VIP approval is required.');
  return token;
}
function requestSummary(id, job) {
  return { jobId: id, status: job.status, createdAt: job.createdAt?.toMillis?.() || null,
    reviewedAt: job.review?.reviewedAt?.toMillis?.() || null,
    reason: job.review?.decision === 'rejected' ? job.review.reason : '',
    processingHeld: process.env.TOWNLOOP_ACCOUNT_DELETION_ENABLED !== 'true' };
}
exports.getAccountDeletionStatus = onCall({ ...options, timeoutSeconds: 60 }, async request => {
  const token = await verifiedSession(request), id = jobIdFor(token.uid);
  const job = await getFirestore(database).doc(`account_deletion_jobs/${id}`).get();
  return job.exists ? requestSummary(id, job.data()) : { status: 'none' };
});
exports.listAccountDeletionRequests = onCall({ ...options, timeoutSeconds: 60 }, async request => {
  await managerSession(request);
  const db = getFirestore(database);
  let query = db.collection('account_deletion_jobs').where('status', 'in', ['requested', 'pending_owner_approval', 'queued']).orderBy('lastAttemptAt').limit(50);
  if (request.data?.cursor) {
    if (!/^[a-f0-9]{64}$/.test(request.data.cursor)) throw new HttpsError('invalid-argument', 'Invalid page.');
    const cursor = await db.doc(`account_deletion_jobs/${request.data.cursor}`).get();
    if (!cursor.exists) throw new HttpsError('failed-precondition', 'Refresh the request list.');
    query = query.startAfter(cursor);
  }
  const jobs = await query.get();
  const policy = (await db.doc('deletion_policies/account').get()).data();
  const requests = await Promise.all(jobs.docs.map(async job => {
    const data = job.data(), profile = (await db.doc(`resident_directory/${data.uid}`).get()).data();
    return { ...requestSummary(job.id, data), name: profile?.name || 'Resident',
      canReview: data.review?.decision !== 'approved', isOwnRequest: data.uid === request.auth.uid };
  }));
  return { requests, policyReady: accountPolicyReady(policy), nextCursor: jobs.size === 50 ? jobs.docs.at(-1).id : null };
});
exports.reviewAccountDeletionRequest = onCall({ ...options, timeoutSeconds: 60 }, async request => {
  const token = await managerSession(request);
  const { jobId, decision, reason, confirmation } = request.data || {};
  if (!/^[a-f0-9]{64}$/.test(jobId || '') || !['approved', 'rejected'].includes(decision) || confirmation !== decision ||
      typeof reason !== 'string' || !reason.trim() || reason.length > 1000)
    throw new HttpsError('invalid-argument', 'Confirm the decision and provide a brief reason.');
  const db = getFirestore(database), ref = db.doc(`account_deletion_jobs/${jobId}`);
  return db.runTransaction(async tx => {
    // Re-read canonical role atomically with the decision, preventing stale privileges.
    const [profile, current, policyDoc] = await Promise.all([tx.get(db.doc(`users/${token.uid}`)), tx.get(ref), tx.get(db.doc('deletion_policies/account'))]);
    const actor = profile.data(), job = current.data(), policy = policyDoc.data();
    if (actor?.approved !== true || actor.deletionPending === true || !['admin', 'vip'].includes(actor.role))
      throw new HttpsError('permission-denied', 'Admin/VIP approval is required.');
    if (!current.exists) throw new HttpsError('not-found', 'Request not found.');
    if (job.uid === token.uid) throw new HttpsError('permission-denied', 'Another Admin/VIP must review your request.');
    if (job.review) {
      if (job.review.decision === decision && job.review.reviewerId === token.uid) return requestSummary(jobId, job);
      throw new HttpsError('failed-precondition', 'This request was already reviewed.');
    }
    if (!['requested', 'pending_owner_approval', 'queued'].includes(job.status) || !['requested', 'disable'].includes(job.phase))
      throw new HttpsError('failed-precondition', 'This request is not awaiting review.');
    if (decision === 'approved' && !accountPolicyReady(policy))
      throw new HttpsError('failed-precondition', 'The owner-approved retention policy is not yet supported. No deletion has started.');
    const review = { decision, reviewerId: token.uid, reviewedAt: FieldValue.serverTimestamp(), reason: reason.trim(),
      policyReference: decision === 'approved' ? policy.approvalReference : null };
    const status = decision === 'approved' ? 'queued' : 'rejected';
    tx.create(ref.collection('reviews').doc('initial'), review);
    tx.update(ref, { review, status, lastAttemptAt: FieldValue.serverTimestamp() });
    return { jobId, status };
  });
});

async function processJob(db, auth, ref) {
  const snapshot = await ref.get();
  if (!snapshot.exists || snapshot.data().status === 'complete') return;
  const job = snapshot.data(), uid = job.uid;
  // Deployment alone must never activate deletion. Both operator activation and
  // an independent per-request Admin/VIP decision are mandatory at every phase.
  if (process.env.TOWNLOOP_ACCOUNT_DELETION_ENABLED !== 'true' ||
      job.review?.decision !== 'approved' || typeof job.review.reviewerId !== 'string' ||
      job.review.reviewerId === uid || !job.review.reviewerId || !job.review.policyReference || job.status === 'rejected') return;
  if (typeof uid !== 'string' || !uid || uid.includes('/')) throw Error('Invalid deletion job');
  if (job.phase === 'requested' || job.phase === 'disable') {
    const policy = (await db.doc('deletion_policies/account').get()).data();
    if (!accountPolicyReady(policy) || policy.approvalReference !== job.review.policyReference) {
      await ref.update({ status: 'pending_owner_approval', lastError: 'processing_policy_not_ready' });
      return;
    }
    // Freeze writes only once real processing can proceed, never when a request is submitted.
    const batch = db.batch();
    const profile = await db.doc(`users/${uid}`).get();
    if (profile.exists) batch.update(profile.ref, { deletionPending: true });
    batch.delete(db.doc(`resident_directory/${uid}`));
    batch.update(ref, { phase: 'inventory', status: 'processing' });
    await batch.commit();
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
    try { await auth.updateUser(uid, { disabled: true }); await auth.revokeRefreshTokens(uid); await auth.deleteUser(uid); } catch (error) { if (error.code !== 'auth/user-not-found') throw error; }
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
  if (process.env.TOWNLOOP_ACCOUNT_DELETION_ENABLED !== 'true') return;
  const db = getFirestore(database);
  const jobs = await db.collection('account_deletion_jobs').where('status', 'in', ['requested', 'queued', 'processing', 'pending_owner_approval', 'identity_complete_media_pending']).orderBy('lastAttemptAt').limit(20).get();
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
