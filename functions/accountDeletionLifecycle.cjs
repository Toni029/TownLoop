'use strict';
const {randomUUID}=require('node:crypto');
const {budget}=require('./abuseLimits.cjs');
const DAY=86400000,PENDING_MS=30*DAY,POLICY_ID='townloop-account-deletion-v3-2026-11-19';
const millis=value=>typeof value?.toMillis==='function'?value.toMillis():value instanceof Date?value.getTime():typeof value==='number'?value:NaN;
const fail=(code,message)=>{throw Object.assign(Error(message||code),{code});};
const isNewJob=job=>job?.workflowVersion===3&&typeof job.requestId==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(job.requestId);
function policyReady(p){return p?.ownerApproved===true&&p.policyVersion===3&&p.approvalReference===POLICY_ID&&p.pendingPeriodDays===30&&p.executionMode==='firestore-event-v1'&&Number.isFinite(millis(p.effectiveFrom))&&p.receiptRetentionDays===60&&p.identityCoverageVerified===true&&p.mediaCoverageVerified===true&&p.databaseScopeVerified===true;}
function authorizationReference(job){return isNewJob(job)?job.authorization?.policyReference:job?.review?.policyReference;}
function authorizationTime(job){return isNewJob(job)?job.authorization?.authorizedAt:job?.review?.reviewedAt;}
function executionAuthorized(job,p){
 if(!isNewJob(job))return job?.review?.decision==='approved'&&job.review.processingAuthorized===true;
 if(typeof job.uid!=='string'||!job.uid||job.uid.length>128||job.uid.includes('/'))return false;
 const a=job.authorization,submitted=millis(job.createdAt),authorized=millis(a?.authorizedAt),due=millis(job.autoDeleteAt);
 if(p&&!policyReady(p)||!a||a.requestId!==job.requestId||a.policyReference!==POLICY_ID||!Number.isFinite(submitted)||!Number.isFinite(authorized)||authorized<submitted||due!==submitted+PENDING_MS||['requested','rejected','cancelled'].includes(job.status))return false;
 if(a.source==='admin_approval')return typeof a.actorId==='string'&&a.actorId!==job.uid&&job.review?.decision==='approved'&&job.review.reviewerId===a.actorId&&millis(job.review.reviewedAt)===authorized;
 return a.source==='pending_timeout'&&!job.review?.decision&&authorized>=due&&millis(a.dueAt)===due;
}
function executionDates(job){
 if(!isNewJob(job))return require('./accountDeletionRetention.cjs').deadlines(job.createdAt,authorizationTime(job));
 // Existing 60-day window is operational receipt/offline proof expiry only.
 // It is NEVER a wait before erasing personal data or reporting verified completion.
 return{retentionDueAt:millis(job.createdAt)+60*DAY,autoDeleteAt:millis(job.autoDeleteAt),completionDueAt:null,requiresDeadlineReview:!Number.isFinite(millis(job.createdAt))};
}
function canReview(job){return isNewJob(job)&&job.status==='requested'&&!job.review?.decision&&!job.authorization;}
function canRetry(job){return isNewJob(job)&&['failed','retrying','needs_review'].includes(job.status)&&executionAuthorized(job);}
function summary(id,job){return{jobId:id,requestId:job.requestId||null,workflowVersion:job.workflowVersion||null,status:job.status,createdAt:millis(job.createdAt)||null,submittedAt:millis(job.createdAt)||null,autoDeleteAt:isNewJob(job)?millis(job.autoDeleteAt):null,reviewedAt:millis(job.review?.reviewedAt)||null,reason:job.review?.decision==='rejected'?job.review.reason:'',canReview:canReview(job),canRetry:canRetry(job),canRequestAgain:isNewJob(job)&&['rejected','cancelled'].includes(job.status),processingStage:job.phase==='scoped_retention'?'retention_pending':job.phase||null,processingIssue:job.status==='failed'?'retry_required':job.status==='needs_review'?'manual_review_required':null,completedAt:millis(job.completedAt)||null,retainedOperationalReceipts:isNewJob(job)&&job.status==='complete',operationalReceiptsExpireAt:isNewJob(job)?millis(job.v3ReceiptExpiresAt)||executionDates(job).retentionDueAt:null};}
async function submitRequest(db,uid,{now,requestId=randomUUID(),allowLegacy=false}={}){
 const id=require('./accountDeletionPolicy.cjs').jobIdFor(uid),ref=db.doc('account_deletion_jobs/'+id);
 return db.runTransaction(async tx=>{
  const [old,policy,profile]=await Promise.all([tx.get(ref),tx.get(db.doc('deletion_policies/account')),tx.get(db.doc('users/'+uid))]);
  const submittedAt=now??Date.now(), active=policy.data();
  if(old.exists&&(!isNewJob(old.data())||!['rejected','cancelled'].includes(old.data().status)))return summary(id,old.data());
  if(profile.data()?.deletionPending===true)fail('failed-precondition','Account deletion is already processing.');
  // Reading the policy in the intake transaction serializes new requests with cutover.
  if(!policyReady(active)||submittedAt<millis(active.effectiveFrom)){
   if(!allowLegacy||active?.policyVersion===3||old.exists)fail('failed-precondition','The updated deletion policy is not active. No account data was changed.');
   const next={uid,phase:'requested',status:'requested',createdAt:new Date(submittedAt),
    ...require('./accountDeletionRetention.cjs').deadlines(submittedAt),lastAttemptAt:new Date(submittedAt),collectionIndex:0,cursor:'',inventoryComplete:false};
   tx.create(ref,next);
   return summary(id,next);
  }
  const next={uid,workflowVersion:3,requestId,requestHistory:old.exists?[...new Set([...(old.data().requestHistory||[]),old.data().requestId])]:[],processingProtocol:4,phase:'requested',status:'requested',createdAt:new Date(submittedAt),submittedAt:new Date(submittedAt),autoDeleteAt:new Date(submittedAt+PENDING_MS),lastAttemptAt:new Date(submittedAt),executionSignal:0,collectionIndex:0,cursor:'',inventoryComplete:false};
  tx.set(ref,next);if(profile.exists&&profile.data()?.accountDeletionNotice)tx.update(db.doc('users/'+uid),{accountDeletionNotice:null});return summary(id,next);
 });
}
async function decideRequest(db,actorId,input,{now=Date.now(),processingAvailable=true}={}){
 const {jobId,requestId,decision,reason,confirmation}=input||{};
 if(!/^[a-f0-9]{64}$/.test(jobId||'')||!['approved','rejected','retry'].includes(decision)||confirmation!==decision||typeof reason!=='string'||!reason.trim()||reason.length>1000)fail('invalid-argument','Confirm the decision and provide a documented reason.');
 const ref=db.doc('account_deletion_jobs/'+jobId);
 return db.runTransaction(async tx=>{
  const [actor,current,policy]=await Promise.all([tx.get(db.doc('users/'+actorId)),tx.get(ref),tx.get(db.doc('deletion_policies/account'))]);const p=actor.data(),job=current.data();
  if(p?.approved!==true||p.deletionPending===true||!['admin','vip'].includes(p.role))fail('permission-denied','Approved Admin/VIP access is required.');
  if(!current.exists)fail('not-found','Request not found.');
  if(!isNewJob(job))fail('failed-precondition','This historical request remains under its original policy.');
  if(!requestId)fail('failed-precondition','Update TownLoop before reviewing this new-policy request.');
  if(job.requestId!==requestId)fail('failed-precondition','This request changed. Refresh before reviewing.');
  if(job.uid===actorId)fail('permission-denied','Another Admin/VIP must review your request.');
  if(!policyReady(policy.data()))fail('failed-precondition','Deletion processing is not activated.');
  if(job.review?.decision===decision&&job.review.reviewerId===actorId)return summary(jobId,job);
  if(decision!=='rejected'&&!processingAvailable)fail('failed-precondition','Deletion processing is paused. The request was not changed.');
  if(decision==='retry'){
   if(!canRetry(job))fail('failed-precondition','This request is not eligible for an automatic retry.');
   const apply=await budget(tx,db,actorId,'adminMutation',ref.path,now);apply();
   const next={...job,status:'queued',recheckRequested:job.status==='needs_review',lastAttemptAt:new Date(now),executionSignal:(job.executionSignal||0)+1};tx.create(ref.collection('reviews').doc(randomUUID()),{kind:'processing_retry',requestId:job.requestId,actorId,createdAt:new Date(now)});tx.update(ref,{status:next.status,recheckRequested:next.recheckRequested,lastAttemptAt:next.lastAttemptAt,executionSignal:next.executionSignal});return summary(jobId,next);
  }
  if(!canReview(job))fail('failed-precondition','This request has already been decided or processing has started.');
  if(decision==='rejected'&&(!['identity_verification','invalid_request','requester_withdrawal'].includes(input.reasonCategory)||typeof input.reasonReference!=='string'||!input.reasonReference.trim()||input.reasonReference.length>200))fail('invalid-argument','Document the invalid request or withdrawal with a case reference.');
  // Finish all reads before any audit, notice, budget or job mutation.
  const resident=decision==='rejected'?await tx.get(db.doc('users/'+job.uid)):null;
  const apply=await budget(tx,db,actorId,'adminMutation',ref.path,now);
  const review={decision,reviewerId:actorId,reviewedAt:new Date(now),reason:reason.trim(),reasonCategory:decision==='approved'?'verified_request':input.reasonCategory,reasonReference:decision==='approved'?'':input.reasonReference.trim(),policyReference:POLICY_ID};
  const patch={review,status:decision==='approved'?'queued':'rejected',lastAttemptAt:new Date(now)};
  if(decision==='approved')Object.assign(patch,{authorization:{source:'admin_approval',actorId,authorizedAt:new Date(now),policyReference:POLICY_ID,requestId},executionSignal:(job.executionSignal||0)+1});
  apply();tx.create(ref.collection('reviews').doc(requestId+'_'+decision),{...review,requestId});tx.update(ref,patch);
  if(resident?.exists)tx.update(db.doc('users/'+job.uid),{accountDeletionNotice:{requestId,decision:'rejected',reason:reason.trim(),at:new Date(now)}});
  return summary(jobId,{...job,...patch});
 });
}
async function authorizeOverdue(db,{now=Date.now(),limit=50}={}){
 const p=(await db.doc('deletion_policies/account').get()).data();if(!policyReady(p)||now<millis(p.effectiveFrom))return 0;
 const rows=await db.collection('account_deletion_jobs').where('workflowVersion','==',3).where('status','==','requested').where('autoDeleteAt','<=',new Date(now)).orderBy('autoDeleteAt').limit(limit).get();let count=0;
 for(const row of rows.docs){const claimed=await db.runTransaction(async tx=>{const current=await tx.get(row.ref),policy=await tx.get(db.doc('deletion_policies/account')),job=current.data();if(!policyReady(policy.data())||!canReview(job)||millis(job.createdAt)<millis(policy.data().effectiveFrom)||millis(job.autoDeleteAt)!==millis(job.createdAt)+PENDING_MS||millis(job.autoDeleteAt)>now)return false;tx.update(row.ref,{status:'queued',authorization:{source:'pending_timeout',requestId:job.requestId,policyReference:POLICY_ID,authorizedAt:new Date(now),dueAt:job.autoDeleteAt},executionSignal:(job.executionSignal||0)+1,lastAttemptAt:new Date(now)});return true;});if(claimed)count++;}
 return count;
}
async function completeDeletion(db,ref,job,now){
 return db.runTransaction(async tx=>{const current=(await tx.get(ref)).data();
  if(current?.requestId!==job.requestId)fail('failed-precondition','Deletion generation changed.');
  if(current.executionSignal!==job.executionSignal){tx.update(ref,{status:'queued',phase:'scoped_auth'});return false;}
  tx.update(ref,{phase:'complete',status:'complete',identityDeletedAt:current.identityDeletedAt||new Date(now),firstCompletedAt:current.firstCompletedAt||new Date(now),completedAt:new Date(now),lastError:'',operationalReceiptsExpireAt:new Date(executionDates(job).retentionDueAt)});return true;
 });
}
module.exports={completeDeletion,DAY,PENDING_MS,POLICY_ID,millis,isNewJob,policyReady,executionAuthorized,authorizationTime,authorizationReference,executionDates,canReview,canRetry,summary,submitRequest,decideRequest,authorizeOverdue};
