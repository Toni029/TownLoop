const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore, FieldPath, FieldValue } = require('firebase-admin/firestore');
const retention = require('./accountDeletionRetention.cjs');
const {expireAlertClaims}=require('./deletionAlertExpiry.cjs');
const { notifyAdmins } = require('./accountDeletionAdminAlerts.cjs');
const database = process.env.TOWNLOOP_FIRESTORE_DATABASE_ID || '(default)';
if(database!=='(default)')throw Error('Deletion review monitor is restricted to the default database.');
const options = { region:'us-central1', maxInstances:1, timeoutSeconds:300 };

// Non-destructive review escalation is a separate, disabled-by-default worker.
// Review receipts remain visible to Admin/VIP; automatic delivery is Admin-only.
exports.escalateAccountDeletionRequests = onSchedule({ ...options, schedule: 'every 60 minutes', timeZone: 'America/New_York' }, async () => {
  if(process.env.TOWNLOOP_DELETION_REVIEW_MONITOR_ENABLED!=='true')return;
  const db=getFirestore(database);
  if(process.env.TOWNLOOP_ACCOUNT_PROOF_EXPIRY_ENABLED==='true')await require('./cleanupProof.cjs').expireCleanupDevices(db);
  // Separate owner approval is required for expiry as well as monitoring.
  if(process.env.TOWNLOOP_DELETION_ALERT_EXPIRY_ENABLED==='true')await expireAlertClaims(db);
  const cursor=db.doc('deletion_policies/review_cursor'), state=(await cursor.get()).data();
  let query=db.collection('account_deletion_jobs').where('status','in',['requested','delayed','queued','approved_held','processing','failed','needs_review','identity_complete_media_pending','waiting_for_media']).orderBy('lastAttemptAt').orderBy(FieldPath.documentId()).limit(50);
  if(state?.lastAttemptAt && state?.lastJobId)query=query.startAfter(state.lastAttemptAt,state.lastJobId);
  const page=await query.get();
  let newAlerts=0, overdue=false;
  for(const job of page.docs){const created=await db.runTransaction(async tx=>{
    const current=(await tx.get(job.ref)).data();if(!current)return false;
    const dates=retention.deadlines(current.createdAt,current.review?.decision==='approved'?current.review.reviewedAt:null);
    const delayExpired=current.review?.decision==='delayed'&&Number(current.review.nextReviewAt)<=Date.now();
    if(!dates.reviewOverdue&&!dates.escalated&&!dates.processingOverdue&&!dates.retentionOverdue&&!delayExpired&&!dates.requiresDeadlineReview)return false;
    overdue=true;
    const reason=dates.retentionOverdue?'retention_overdue':dates.processingOverdue?'processing_overdue':delayExpired?'delay_review_due':dates.escalated?'review_escalated':'review_due';
    const receipt=job.ref.collection('reviews').doc(`escalation_${reason}`),existing=await tx.get(receipt);
    if(!existing.exists)tx.create(receipt,{kind:'escalation',reason,createdAt:FieldValue.serverTimestamp(),expiresAt:new Date(dates.retentionDueAt||Date.now())});
    tx.update(job.ref,{reviewOverdue:dates.reviewOverdue,escalated:reason!=='review_due',escalationReason:reason});
    return !existing.exists;
  });if(created)newAlerts++;}
  // A new durable receipt emits a static aggregate alert; no resident IDs/text in logs.
  if(newAlerts)require('firebase-functions').logger.warn('Deletion review requires office attention',{code:'TOWNLOOP_DELETION_REVIEW_OVERDUE',newAlerts});
  // No content or request IDs enter the notification. Retry discovery on later scans,
  // even when durable request receipts already exist. Delivery claims prevent storms.
  if(overdue && process.env.TOWNLOOP_DELETION_ADMIN_ALERTS_ENABLED==='true')await notifyAdmins(db);
  const last=page.docs.at(-1);
  await db.runTransaction(async tx=>{tx.set(cursor,page.size===50?{lastAttemptAt:last.data().lastAttemptAt,lastJobId:last.id}:{lastAttemptAt:null,lastJobId:''});});
});
