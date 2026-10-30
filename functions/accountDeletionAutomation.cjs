const {randomBytes}=require('node:crypto');
const {jobIdFor}=require('./accountDeletionPolicy.cjs');
const {millis,deadlines,POLICY_ID}=require('./accountDeletionRetention.cjs');
// Only a persisted, independent, canonical Admin/VIP decision can enter processing.
// Retried decisions and scheduler deliveries retain the original review and expiry.
async function authorizeApprovedRequest(db,ref,now=Date.now()) {
 return db.runTransaction(async tx=>{
  const job=(await tx.get(ref)).data();
  if(!job||job.review?.decision!=='approved'||job.review.processingAuthorized===true)return false;
  const review=job.review;
  if(typeof job.uid!=='string'||job.uid.includes('/')||jobIdFor(job.uid)!==ref.id||review.reviewerId===job.uid||review.policyReference!==POLICY_ID||!Number.isFinite(millis(review.reviewedAt)))throw Error('invalid_independent_review');
  const manager=(await tx.get(db.doc(`users/${review.reviewerId}`))).data();
  if(manager?.approved!==true||manager.deletionPending===true||!['admin','vip'].includes(manager.role))throw Error('reviewer_authorization_changed');
  const audits=await tx.get(ref.collection('reviews').limit(100));
  if(!audits.docs.some(doc=>{const a=doc.data();return a.decision==='approved'&&a.reviewerId===review.reviewerId&&a.policyReference===POLICY_ID&&millis(a.reviewedAt)===millis(review.reviewedAt);}))throw Error('approval_receipt_required');
  const dates=deadlines(job.createdAt,review.reviewedAt,now);if(dates.requiresDeadlineReview)throw Error('invalid_request_time');
  tx.create(ref.collection('reviews').doc('automatic_processing'),{kind:'automatic_processing_authorization',reviewerId:review.reviewerId,policyReference:POLICY_ID,createdAt:new Date(now),expiresAt:new Date(dates.retentionDueAt)});
  tx.update(ref,{processingProtocol:3,policyVersion:2,status:'queued',phase:'requested',redactionKey:randomBytes(32).toString('hex'),review:{...review,processingAuthorized:true},lastAttemptAt:new Date(now)});
  return true;
 });
}
module.exports={authorizeApprovedRequest};
