const { randomUUID } = require('node:crypto');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore, FieldPath, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const retention = require('./accountDeletionRetention.cjs');
const {databaseCompletionReady}=require('./accountDeletionScope.cjs');
const { processRetentionStep } = require('./accountDeletionV2.cjs');
const { accountPolicyReady, jobIdFor, SHARED, referencesUid, approvedRetention, approvedSocialDeletion, ownsSocial, approvedSharedSocialRetention } = require('./accountDeletionPolicy.cjs');
const database = process.env.TOWNLOOP_FIRESTORE_DATABASE_ID || '(default)';
const options = { region: 'us-central1', maxInstances: 1, timeoutSeconds: 300 };
Object.assign(exports, require('./accountDeletionReview.cjs'));

async function expireDeletionReceipts(db, ref, job) {
    const due=retention.deadlines(job.createdAt).retentionDueAt;
    if(!Number.isFinite(due)||Date.now()<due)return;
    // Bounded erasure of account-linked inventory and review receipts, then the UID-bearing job.
    for(const name of ['inventory','reviews']) {
      const page=await ref.collection(name).limit(100).get();
      if(!page.empty){
        for(const receipt of page.docs)await db.runTransaction(async tx=>{
          const live=await tx.get(receipt.ref),data=live.data();
          if(name==='inventory'&&data?.expireRecord){const recordRef=db.doc(data.path),record=await tx.get(recordRef);if(record.data()?.deletionExpiresAt===due)tx.delete(recordRef);}
          tx.delete(receipt.ref);
        });return;
      }
    }
    await db.runTransaction(async tx=>{tx.delete(ref);});return;
}

async function processJob(db, auth, ref) {
  const snapshot = await ref.get();
  if (!snapshot.exists || snapshot.data().status === 'complete') return;
  const job = snapshot.data(), uid = job.uid;
  // Deployment alone must never activate deletion. Both operator activation and
  // an independent per-request Admin/VIP decision are mandatory at every phase.
  if (process.env.TOWNLOOP_ACCOUNT_DELETION_ENABLED !== 'true') return;
  if(job.status==='rejected') { await expireDeletionReceipts(db,ref,job); return; }
  if (
      job.review?.processingAuthorized !== true || job.review?.decision !== 'approved' || typeof job.review.reviewerId !== 'string' ||
      job.review.reviewerId === uid || !job.review.reviewerId || !job.review.policyReference) return;
  if (typeof uid !== 'string' || !uid || uid.includes('/')) throw Error('Invalid deletion job');
  if(job.processingProtocol===3){await require('./accountDeletionScoped.cjs').advanceScopedDeletion(db,auth,ref,job);return;}
  if(job.policyVersion===2 || job.phase?.startsWith('v2_')) { const policy=(await db.doc('deletion_policies/account').get()).data(); if(!retention.policyReady(policy)||policy.approvalReference!==job.review.policyReference){await ref.update({status:'pending_owner_approval',lastError:'policy_changed_or_incomplete'});return;} }
  if (job.phase === 'v2_verify') {
    let query=ref.collection('inventory').orderBy(FieldPath.documentId()).limit(100);
    if(job.verifyCursor)query=query.startAfter(job.verifyCursor);
    const page=await query.get();
    for(const receipt of page.docs) {
      const data=receipt.data();
      if(!['redacted','already_absent'].includes(data.state)) {await ref.update({status:'needs_review',lastError:data.reason || 'unresolved_inventory_state',escalated:true});return;}
      if(data.cleanupJobId) {const media=await db.doc(`media_cleanup_jobs/${data.cleanupJobId}`).get();if(media.data()?.status!=='complete'){await ref.update({status:'identity_complete_media_pending',lastError:'media_cleanup_pending'});return;}}
    }
    await ref.update(page.size===100?{verifyCursor:page.docs.at(-1).id}:{phase:'retention_receipts',status:'retention_pending',completedAt:FieldValue.serverTimestamp()});return;
  }
  if(job.phase==='retention_receipts') { await expireDeletionReceipts(db,ref,job); return; }
  if (job.phase?.startsWith('v2_') || job.phase === 'requested' || job.phase === 'disable') {
    const policy = (await db.doc('deletion_policies/account').get()).data();
    if (policy?.policyVersion === 2 || job.phase?.startsWith('v2_')) { await processRetentionStep(db, auth, ref, job); return; }
  }
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
  // Global policy booleans cannot certify per-account named/default database completion.
  // Stop before private/Auth erasure unless both trusted executor receipts are complete.
  if (['private','auth'].includes(job.phase) && !databaseCompletionReady(job)) {
    await ref.update({status:'needs_review',lastError:'cross_database_completion_required'});return;
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
    await ref.update({ phase: job.policyVersion === 2 ? 'v2_verify' : job.mediaCleanupRequired ? 'media' : 'done', status: job.policyVersion === 2 || job.mediaCleanupRequired ? 'identity_complete_media_pending' : 'complete',
      mediaCleanupStatus: job.mediaCleanupRequired ? 'waiting_for_policy_gated_jobs' : 'no_owned_social_deletion_requested',
      identityDeletedAt: FieldValue.serverTimestamp(), ...(job.policyVersion === 2 || job.mediaCleanupRequired ? { mediaCursor: '' } : { completedAt: FieldValue.serverTimestamp() }) }); return;
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
  const jobs = await db.collection('account_deletion_jobs').where('status', 'in', ['queued', 'processing', 'pending_owner_approval', 'identity_complete_media_pending', 'waiting_for_media', 'retention_pending', 'rejected', 'failed']).orderBy('lastAttemptAt').limit(20).get();
  for (const job of jobs.docs) {
    const leaseOwner = randomUUID();
    const claimed = await db.runTransaction(async tx => {
      const current = (await tx.get(job.ref)).data();
      if (!current || current.status === 'complete' || current.leaseUntil > Date.now()) return false;
      // Lease exceeds this invocation's 300-second timeout. A crashed invocation is
      // reclaimable; overlapping cron deliveries cannot advance stale job phases.
      tx.update(job.ref, { ...(current.status === 'failed' ? {status:'processing'} : {}), leaseOwner, leaseUntil: Date.now() + 6 * 60000 }); return true;
    });
    if (!claimed) continue;
    let failed = false, humanReview = false;
    try {
      // Enough phases to promptly remove identity; inventories remain bounded per invocation.
      for (let step = 0; step < 8; step++) await processJob(db, getAuth(), job.ref);
    } catch (error) { failed = true;humanReview=[7,'permission-denied','auth/insufficient-permission','auth/user-not-found'].includes(error?.code)||['scope_identity_mismatch','missing_redaction_key','unsupported_scope_phase','missing_identity_proof','identity_mismatch'].includes(error?.message); }
    finally {
      await db.runTransaction(async tx => {
        const finalJob=(await tx.get(job.ref)).data();
        if (finalJob?.leaseOwner === leaseOwner) tx.update(job.ref, {
          lastAttemptAt: FieldValue.serverTimestamp(), ...(failed ? { status:humanReview?'needs_review':'failed', lastError:humanReview?'processing_permission_or_schema_requires_review':'retry_required', failureCount:(finalJob.failureCount||0)+1 } : {}),
          leaseOwner: FieldValue.delete(), leaseUntil: FieldValue.delete(),
        });
      });
    }
  }
});

// Kept separate so a scoped monitor deployment cannot import the deletion engine.
Object.assign(exports, require('./accountDeletionMonitor.cjs'));
