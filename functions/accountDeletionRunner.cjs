const {randomUUID}=require('node:crypto');
const {authorizeApprovedRequest}=require('./accountDeletionAutomation.cjs');
const {advanceScopedDeletion}=require('./accountDeletionScoped.cjs');
const {preflightDeletion}=require('./accountDeletionPreflight.cjs');
const {processAccountMedia}=require('./accountDeletionMedia.cjs');
const {DATABASES,writeFreezeReady}=require('./accountDeletionScope.cjs');
const {policyReady,millis}=require('./accountDeletionRetention.cjs');
// No user payload selects a UID, database, Storage object or authorization policy.
async function runApprovedDeletions({control,dbFor,auth,bucket,verifyRules,now=Date.now,step=advanceScopedDeletion}) {
 if(process.env.TOWNLOOP_AUTOMATIC_ACCOUNT_DELETION_ENABLED!=='true'||process.env.TOWNLOOP_ACCOUNT_DELETION_ENABLED!=='true'||process.env.TOWNLOOP_SCOPED_DELETION_ENABLED!=='true')return;
 const policy=(await control.doc('deletion_policies/account').get()).data(),mediaPolicy=(await control.doc('deletion_policies/media').get()).data();
 if(!policyReady(policy)||!writeFreezeReady(policy))throw Error('activation_policy_incomplete');
 await verifyRules(policy,mediaPolicy);
 const jobs=await control.collection('account_deletion_jobs').where('status','in',['approved_held','queued','processing','waiting_for_media','retention_pending','failed']).orderBy('lastAttemptAt').limit(10).get();
 const deadline=now()+240000;
 for(const row of jobs.docs){if(now()>deadline)break;const leaseOwner=randomUUID();
  const claimed=await control.runTransaction(async tx=>{const current=(await tx.get(row.ref)).data();if(!current||current.leaseUntil>now()||current.review?.decision!=='approved')return false;tx.update(row.ref,{leaseOwner,leaseUntil:now()+360000,...(current.status==='failed'?{status:'processing'}:{})});return true;});if(!claimed)continue;
  let issue;
  try{
   await authorizeApprovedRequest(control,row.ref,now());
   for(let n=0;n<180&&now()<deadline;n++){
    let job=(await row.ref.get()).data();if(!job||job.status==='needs_review'||job.review?.processingAuthorized!==true)break;job={...job,id:row.id};
    // Resume the already completed operator revocation without extending its security wait.
    if(job.accessRevokedAt&&job.phase==='requested'&&Number.isFinite(millis(job.tokensDrainUntil))){
     const identity=await auth.getUser(job.uid);if(identity.disabled!==true)throw Error('access_revocation_not_confirmed');
     for(const databaseId of DATABASES){const proof=(await dbFor(databaseId).doc(`account_access_revocations/${job.uid}`).get()).data();if(proof?.uid!==job.uid||proof.jobId!==job.id||proof.policyReference!==policy.approvalReference)throw Error('access_fence_conflict');}
     await row.ref.update({phase:'scoped_drain',status:'processing',identityVerifiedAt:new Date(now())});continue;
    }
    if(job.phase==='scoped_drain'){
     if(now()<millis(job.tokensDrainUntil))break;
     if(!job.preflight){const proof=await preflightDeletion(job,{dbFor,bucket,mediaPolicy,now:now()});await row.ref.update({preflight:proof,...(proof.holds.length?{status:'needs_review',lastError:proof.holds[0].reason}:{})});continue;}
    }
    if(job.phase==='scoped_run'&&job.status==='waiting_for_media')await processAccountMedia(control,job,{dbFor,bucket,mediaPolicy});
    if(job.phase==='scoped_auth'||job.phase==='scoped_retention')await require('./accountDeletionLateMedia.cjs').reconcileLateAccountMedia(control,row.ref,job,{dbFor,bucket,mediaPolicy,now:now()});
    if(job.phase==='scoped_retention'&&now()<require('./accountDeletionRetention.cjs').deadlines(job.createdAt).retentionDueAt)break;
    await step(control,auth,row.ref,job,{dbFor,now:now(),clock:now});
   }
  }catch(error){
   // No raw exception/record contents in logs or client status. Transient failures retry;
   // authorization, ownership and provenance exceptions require a human decision.
   const transient=[4,8,10,13,14,429,500,502,503,504,'ECONNRESET','ETIMEDOUT','auth/internal-error'].includes(error?.code);
   issue={status:transient?'failed':'needs_review',lastError:transient?'retry_required':/^[a-z_]{3,100}$/.test(error.message||'')?error.message:'processing_permission_or_schema_requires_review'};
  }finally{await control.runTransaction(async tx=>{const current=(await tx.get(row.ref)).data();if(current?.leaseOwner===leaseOwner)tx.update(row.ref,{leaseOwner:'',leaseUntil:0,lastAttemptAt:new Date(now()),...(issue||{})});});}
 }
}
module.exports={runApprovedDeletions};
