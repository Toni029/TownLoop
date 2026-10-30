// Review-only surface: never import workers, Storage, or deletion engines here.
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const retention = require('./accountDeletionRetention.cjs');
const { randomUUID } = require('node:crypto');
const { jobIdFor, validateRequest } = require('./accountDeletionPolicy.cjs');
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
      createdAt: FieldValue.serverTimestamp(), ...retention.deadlines(Date.now()), lastAttemptAt: FieldValue.serverTimestamp(), collectionIndex: 0, cursor: '', inventoryComplete: false });
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
  return { ...require('./accountDeletionStatus.cjs').processingSummary(job), jobId: id, status: job.status, createdAt: job.createdAt?.toMillis?.() || null,
    reviewedAt: job.review?.reviewedAt?.toMillis?.() || null,
    ...retention.deadlines(job.createdAt, job.review?.decision === 'approved' ? job.review.reviewedAt : null),
    reason: ['rejected','delayed'].includes(job.review?.decision) ? job.review.reason : '',
    escalationReason: job.escalationReason || '', nextReviewAt: job.review?.nextReviewAt || null,
    processingHeld: job.review?.processingAuthorized !== true };
}
exports.getAccountDeletionStatus = onCall({ ...options, timeoutSeconds: 60 }, async request => {
  const token = await verifiedSession(request), id = jobIdFor(token.uid);
  const job = await getFirestore(database).doc(`account_deletion_jobs/${id}`).get();
  return job.exists ? requestSummary(id, job.data()) : { status: 'none' };
});
exports.listAccountDeletionRequests = onCall({ ...options, timeoutSeconds: 60 }, async request => {
  await managerSession(request);
  const db = getFirestore(database);
  let query = db.collection('account_deletion_jobs').where('status', 'in', ['requested', 'pending_owner_approval', 'queued', 'approved_held', 'delayed', 'processing', 'needs_review', 'identity_complete_media_pending', 'retention_pending', 'waiting_for_media', 'failed']).orderBy('lastAttemptAt').limit(50);
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
      canReview: !['approved','rejected'].includes(data.review?.decision), isOwnRequest: data.uid === request.auth.uid };
  }));
  return { requests, policyReady: retention.policyReady(policy), exceptionsAvailable:process.env.TOWNLOOP_SCOPED_DELETION_REVIEW_ENABLED==='true',processingAvailable:process.env.TOWNLOOP_ACCOUNT_DELETION_ENABLED==='true'&&process.env.TOWNLOOP_SCOPED_DELETION_ENABLED==='true', nextCursor: jobs.size === 50 ? jobs.docs.at(-1).id : null };
});
exports.reviewAccountDeletionRequest = onCall({ ...options, timeoutSeconds: 60 }, async request => {
  const token = await managerSession(request);
  const { jobId, decision, reason, confirmation } = request.data || {};
  if (!/^[a-f0-9]{64}$/.test(jobId || '') || !['approved', 'rejected', 'delayed'].includes(decision) || confirmation !== decision ||
      typeof reason !== 'string' || !reason.trim() || reason.length > 1000)
    throw new HttpsError('invalid-argument', 'Confirm the decision and provide a brief reason.');
  if (decision !== 'approved' && (!retention.REASONS.has(request.data.reasonCategory) || typeof request.data.reasonReference !== 'string' || !request.data.reasonReference.trim() || request.data.reasonReference.length > 200))
    throw new HttpsError('invalid-argument', 'A legitimate reason category and case/reference are required.');
  const db = getFirestore(database), ref = db.doc(`account_deletion_jobs/${jobId}`);
  return db.runTransaction(async tx => {
    // Re-read canonical role atomically with the decision, preventing stale privileges.
    const [profile, current] = await Promise.all([tx.get(db.doc(`users/${token.uid}`)), tx.get(ref)]);
    const actor = profile.data(), job = current.data();
    if (actor?.approved !== true || actor.deletionPending === true || !['admin', 'vip'].includes(actor.role))
      throw new HttpsError('permission-denied', 'Admin/VIP approval is required.');
    if (!current.exists) throw new HttpsError('not-found', 'Request not found.');
    if (job.uid === token.uid) throw new HttpsError('permission-denied', 'Another Admin/VIP must review your request.');
    if (job.review?.decision === 'delayed' && decision === 'delayed' && job.review.reviewerId === token.uid && job.review.reasonReference === request.data.reasonReference && job.review.reason === reason.trim()) return requestSummary(jobId, job);
    if (job.review && job.review.decision !== 'delayed') {
      if (job.review.decision === decision && job.review.reviewerId === token.uid) return requestSummary(jobId, job);
      throw new HttpsError('failed-precondition', 'This request was already reviewed.');
    }
    if (!['requested', 'pending_owner_approval', 'queued', 'delayed'].includes(job.status) || !['requested', 'disable'].includes(job.phase))
      throw new HttpsError('failed-precondition', 'This request is not awaiting review.');
    if(decision === 'rejected' && request.data.reasonCategory !== 'requester_withdrawal') throw new HttpsError('failed-precondition','Verified requests cannot be arbitrarily denied. Only documented requester withdrawal can close a request without deletion.');
    const delayUntil = Number(request.data.delayUntil);
    if(decision === 'delayed' && (!['legal_obligation','security_investigation'].includes(request.data.reasonCategory) || !Number.isFinite(delayUntil) || delayUntil <= Date.now() || delayUntil > retention.deadlines(job.createdAt).retentionDueAt)) throw new HttpsError('invalid-argument','A documented legal/security delay needs a finite review date within the original 60-day window.');
    const review = { decision, reviewerId: token.uid, reviewedAt: FieldValue.serverTimestamp(), reason: reason.trim(),
      policyReference: decision === 'approved' ? retention.POLICY_ID : null,
      processingAuthorized: false,
      reasonCategory: decision === 'approved' ? 'verified_request' : request.data.reasonCategory, reasonReference: decision === 'approved' ? '' : request.data.reasonReference.trim(), ...(decision === 'delayed' ? {nextReviewAt:delayUntil} : {}) };
    const status = decision === 'approved' ? 'approved_held' : decision;
    tx.create(ref.collection('reviews').doc(randomUUID()), { ...review, expiresAt: new Date(retention.deadlines(job.createdAt).retentionDueAt || Date.now()) });
    tx.update(ref, { review, status, lastAttemptAt: FieldValue.serverTimestamp() });
    return { jobId, status };
  });
});
