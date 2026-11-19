'use strict';
const {randomUUID,createHash}=require('node:crypto'),L=require('./accountDeletionLifecycle.cjs');
const {CONTROL}=require('./deletionExecutionCoordination.cjs');
const retry=message=>Object.assign(Error(message),{code:'deletion-retry'});
// New-policy events only. The scheduled monitor never calls this executor.
async function processDeletionJob({control,jobId,requestId,enabled,verifyRules,auth,dbFor,bucket,now=Date.now,maxSteps=120,step=require('./accountDeletionScoped.cjs').advanceScopedDeletion,preflight=require('./accountDeletionPreflight.cjs').preflightDeletion,reconcile=require('./accountDeletionLateMedia.cjs').reconcileLateAccountMedia}){
 if(!enabled||!/^[a-f0-9]{64}$/.test(jobId||''))return;
 const ref=control.doc('account_deletion_jobs/'+jobId),initial=(await ref.get()).data();
 if(!L.isNewJob(initial)||require('./accountDeletionPolicy.cjs').jobIdFor(initial.uid)!==jobId||initial.requestId!==requestId)return;
 const stableOwner=`account-v3:${jobId}:${createHash('sha256').update(requestId).digest('hex')}`,coordRef=control.doc(CONTROL);
 if(['complete','needs_review'].includes(initial.status)||initial.phase==='complete'&&initial.identityDeletedAt){
  await control.runTransaction(async tx=>{const [j,c]=await Promise.all([tx.get(ref),tx.get(coordRef)]),job=j.data();if(job?.requestId!==requestId||c.data()?.accountDeletionOwner!==stableOwner)return;if(job.leaseUntil>now())throw retry('deletion_terminal_recovery_wait');tx.update(coordRef,{accountDeletionOwner:null,accountDeletionStartedAt:null});tx.update(ref,{leaseOwner:'',leaseUntil:0,...(job.phase==='complete'&&job.identityDeletedAt?{status:'complete'}:{})});});await require('./accountDeletionReceipts.cjs').markReceiptExpiry(control,ref,initial,{dbFor,now:now()});return;
 }
 if(['rejected','cancelled','requested'].includes(initial.status))return;
 const policy=(await control.doc('deletion_policies/account').get()).data(),mediaPolicy=(await control.doc('deletion_policies/media').get()).data();
 if(!L.policyReady(policy)||!L.executionAuthorized(initial,policy))return;
 try{await verifyRules(policy,mediaPolicy);}catch(error){await control.runTransaction(async tx=>{const j=(await tx.get(ref)).data();if(j?.requestId===requestId&&!(j.leaseUntil>now()))tx.update(ref,{status:'retrying',lastError:'policy_changed_or_incomplete',lastAttemptAt:new Date(now())});});throw retry('deletion_rules_retry');}
 const lease=randomUUID();
 try{await control.runTransaction(async tx=>{
  const [j,c]=await Promise.all([tx.get(ref),tx.get(coordRef)]),job=j.data(),coord=c.data();
  if(!L.isNewJob(job)||job.requestId!==requestId||!L.executionAuthorized(job,policy)||['complete','needs_review'].includes(job.status))throw retry('deletion_generation_changed');
  if(job.leaseUntil>now()||coord?.referenceWritesBlocked===true||coord?.accountDeletionOwner&&coord.accountDeletionOwner!==stableOwner)throw retry('deletion_coordination_busy');
  if(!job.authorizationVerifiedAt&&job.authorization.source==='admin_approval'){
   const actor=await tx.get(control.doc('users/'+job.authorization.actorId)),audit=await tx.get(ref.collection('reviews').doc(job.requestId+'_approved')),a=actor.data(),record=audit.data();
   if(a?.approved!==true||a.deletionPending===true||!['admin','vip'].includes(a.role)||record?.decision!=='approved'||record.reviewerId!==job.authorization.actorId||record.requestId!==job.requestId||L.millis(record.reviewedAt)!==L.millis(job.authorization.authorizedAt))throw Error('approval_receipt_or_authority_changed');
  }
  // Same-generation retries retain exclusivity after uncertain provider failures.
  // No timeout ever hands this owner to a different account or bulk purge.
  const owner={accountDeletionOwner:stableOwner,accountDeletionStartedAt:coord?.accountDeletionStartedAt||now(),accountDeletionCoordinationVersion:1};
  if(c.exists)tx.update(coordRef,owner);else tx.create(coordRef,owner);
  tx.update(ref,{leaseOwner:lease,leaseUntil:now()+360000,status:'processing',authorizationVerifiedAt:job.authorizationVerifiedAt||new Date(now()),lastAttemptAt:new Date(now())});
 });}catch(error){if(error.message!=='approval_receipt_or_authority_changed')throw error;await control.runTransaction(async tx=>{const job=(await tx.get(ref)).data();if(job?.requestId===requestId&&!job.authorizationVerifiedAt&&!(job.leaseUntil>now()))tx.update(ref,{status:'needs_review',lastError:'approval_receipt_or_authority_changed',lastAttemptAt:new Date(now())});});return;}
 let wait=false,failed=null,needsReview=false,finished=false;
 const deadline=now()+240000;
 try{
  const fresh={...(await ref.get()).data(),id:jobId};
  if(fresh.v3ReceiptExpiresAt)await require('./accountDeletionReceipts.cjs').markReceiptExpiry(control,ref,fresh,{dbFor,now:now()});
  if(fresh.recheckRequested)await require('./accountDeletionRecheck.cjs').recheckJob(control,ref,fresh,{dbFor,bucket,mediaPolicy,preflight});
  for(let n=0;n<maxSteps&&now()<deadline;n++){
   let job=(await ref.get()).data();if(job.requestId!==requestId||job.leaseOwner!==lease)throw Error('deletion_lease_changed');job={...job,id:jobId};
   if(job.status==='complete'){finished=true;break;}
   if(job.status==='needs_review'){needsReview=true;break;}
   if(job.phase==='scoped_drain'){
    if(now()<L.millis(job.tokensDrainUntil)){wait=true;break;}
    if(!job.preflight){const proof=await preflight(job,{dbFor,bucket,mediaPolicy,now:now()});await ref.update({preflight:proof,...(proof.holds.length?{status:'needs_review',lastError:proof.holds[0].reason}:{})});continue;}
   }
   if(job.phase==='scoped_run'&&job.status==='waiting_for_media')await require('./accountDeletionMedia.cjs').processAccountMedia(control,job,{dbFor,bucket,mediaPolicy});
   if(job.phase==='scoped_auth')await reconcile(control,ref,job,{dbFor,bucket,mediaPolicy,now:now()});
   await step(control,auth,ref,job,{dbFor,now:now(),clock:now});
  }
  const latest=(await ref.get()).data();finished=latest.status==='complete';needsReview=latest.status==='needs_review';
 }catch(error){failed=error;}
 let transient=failed&&[4,8,10,13,14,429,500,502,503,504,'ECONNRESET','ETIMEDOUT','auth/internal-error'].includes(failed.code);
 await control.runTransaction(async tx=>{
  const [j,c]=await Promise.all([tx.get(ref),tx.get(coordRef)]),job=j.data();
  if(job?.requestId!==requestId||job.leaseOwner!==lease||c.data()?.accountDeletionOwner!==stableOwner)throw Error('deletion_lease_changed');
  let patch={leaseOwner:'',leaseUntil:0,lastAttemptAt:new Date(now())};
  const committedComplete=job.phase==='complete'&&(job.status==='complete'||job.identityDeletedAt);
  if(committedComplete){failed=null;transient=false;finished=true;patch.status='complete';}
  if(failed)patch={...patch,status:transient?'retrying':'needs_review',lastError:transient?'retry_required':/^[a-z_]{3,100}$/.test(failed.message||'')?failed.message:'processing_permission_or_schema_requires_review'};
  else if(!finished&&!needsReview&&!wait)patch={...patch,status:'queued',executionSignal:(job.executionSignal||0)+1};
  tx.update(ref,patch);
  // An uncertain network operation remains exclusive until this same job retries.
  if(!transient)tx.update(coordRef,{accountDeletionOwner:null,accountDeletionStartedAt:null});
 });
 if(finished)await require('./accountDeletionReceipts.cjs').markReceiptExpiry(control,ref,(await ref.get()).data(),{dbFor,now:now()});
 if(transient)throw retry('deletion_transient_retry');
 if(wait)throw retry('deletion_security_drain');
}
module.exports={processDeletionJob};
