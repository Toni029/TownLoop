const {randomBytes}=require('node:crypto');
const {DATABASES,databaseCompletionReady,writeFreezeReady}=require('./accountDeletionScope.cjs');
const retention=require('./accountDeletionRetention.cjs');
const {jobIdFor}=require('./accountDeletionPolicy.cjs');
const {processRetentionStep}=require('./accountDeletionV2.cjs');
const {INVENTORY_VERSION}=require('./accountDeletionInventory.cjs');
const PRIVATE=['notification_devices','safety_limits'];
// Every call is made under the root worker lease and per-request independent approval.
async function advanceScopedDeletion(control,auth,ref,job,{dbFor=id=>require('firebase-admin/firestore').getFirestore(id),step=processRetentionStep,clearWebAccess=()=>require('./storageWebAccessPolicy.cjs').syncWebMembership(control,dbFor(DATABASES[1]),job.uid),now=Date.now(),clock=Date.now}={}) {
 if(process.env.TOWNLOOP_ACCOUNT_DELETION_ENABLED!=='true'||process.env.TOWNLOOP_SCOPED_DELETION_ENABLED!=='true')return;
 if(job.processingProtocol!==3||job.status==='needs_review'||job.review?.processingAuthorized!==true||job.review?.decision!=='approved'||job.review.reviewerId===job.uid)return;
 const policy=(await control.doc('deletion_policies/account').get()).data();
 if(!retention.policyReady(policy)||job.review.policyReference!==policy.approvalReference)return;
 if(!writeFreezeReady(policy)){await ref.update({status:'pending_owner_approval',lastError:'verified_scope_write_freeze_required'});return;}
 const uid=job.uid,id=jobIdFor(uid),dates=retention.deadlines(job.createdAt,job.review.reviewedAt);
 if(!uid||uid.includes('/')||dates.requiresDeadlineReview||!Number.isFinite(retention.millis(job.review.reviewedAt))){await ref.update({status:'needs_review',lastError:'invalid_identity_or_deadline'});return;}
 if(job.phase==='requested'||job.phase==='disable') {
  // Verify the exact Firebase identity before a single scope is mutated. No email/name matching.
  const identity=await auth.getUser(uid);if(identity.uid!==uid)throw Error('identity_mismatch');
  for(const databaseId of DATABASES){const profile=(await dbFor(databaseId).doc(`users/${uid}`).get()).data();if(profile&&['id','uid','userId','authorId'].some(key=>profile[key]!=null&&profile[key]!==uid)){await ref.update({status:'needs_review',blockedDatabase:databaseId,lastError:'profile_identity_conflict'});return;}}
  await ref.update({phase:'scoped_freeze',identityVerifiedAt:new Date(now),redactionKey:randomBytes(32).toString('hex'),scopeIndex:0,status:'processing',...dates});return;
 }
 if(job.phase==='scoped_freeze') {
  if(!Number.isFinite(retention.millis(job.identityVerifiedAt)))throw Error('missing_identity_proof');
  // Freeze both clients before revoking Auth. A stale website session must not recreate a profile.
  // A crash in the second scope replays the same request-bound fence; never overwrite another job.
  for(const databaseId of DATABASES)await dbFor(databaseId).runTransaction(async tx=>{
   const access=dbFor(databaseId).doc(`account_access_revocations/${uid}`),existing=(await tx.get(access)).data();
   const profileRef=dbFor(databaseId).doc(`users/${uid}`),profile=(await tx.get(profileRef)).data();
   if(profile&&['id','uid','userId','authorId'].some(key=>profile[key]!=null&&profile[key]!==uid))throw Error('profile_identity_conflict');
   if(existing&&(existing.uid!==uid||existing.jobId!==id||existing.policyReference!==policy.approvalReference))throw Error('access_fence_conflict');
   if(!existing)tx.create(access,{uid,jobId:id,policyReference:policy.approvalReference,createdAt:new Date(now),expiresAt:new Date(dates.retentionDueAt)});
   if(profile)tx.update(profileRef,{approved:false,deletionPending:true});
   tx.delete(dbFor(databaseId).doc(`resident_directory/${uid}`));
  });
  // No deletion request or review invokes this. It runs only after explicit processing authorization.
  await auth.updateUser(uid,{disabled:true});await auth.revokeRefreshTokens(uid);
  // Bind proof expiry to the original request, never extend it with processing retries.
  const devices=await control.collection('account_cleanup_devices').where('uid','==',uid).limit(50).get();
  for(const device of devices.docs)await device.ref.update({deletionConfirmed:true,expiresAt:new Date(Math.min(retention.millis(device.data().expiresAt),dates.retentionDueAt))});
  // Existing authenticated/offline device credentials learn authoritative state without an Auth session.
  await ref.update({phase:'scoped_drain',tokensDrainUntil:Math.max(now,clock())+policy.tokenDrainMs,scopeIndex:job.scopeIndex||0});return;
 }
 if(job.phase==='scoped_drain'){
  if(!Number.isFinite(job.tokensDrainUntil)||now<job.tokensDrainUntil)return;
  await ref.update({phase:'scoped_run',writesFrozen:true});return;
 }
 if(job.phase==='scoped_run') {
  if(job.writesFrozen!==true)throw Error('writes_not_frozen');
  const databaseId=DATABASES[job.scopeIndex||0];
  if(!databaseId){await ref.update({phase:'scoped_auth'});return;}
  const db=dbFor(databaseId),scopeRef=db.doc(`account_deletion_scopes/${id}`);
  let snap=await scopeRef.get();
  if(!snap.exists) {
   await db.runTransaction(async tx=>{const existing=await tx.get(scopeRef);if(!existing.exists)tx.create(scopeRef,{uid,rootJobId:ref.id||ref.path.split('/').at(-1),databaseId,redactionKey:job.redactionKey,phase:'requested',status:'processing',policyVersion:2,createdAt:job.createdAt,review:job.review,expiresAt:new Date(dates.retentionDueAt)});});return;
  }
  const scope=snap.data();
  if(scope.uid!==uid||scope.databaseId!==databaseId||scope.review.policyReference!==job.review.policyReference)throw Error('scope_identity_mismatch');
  if(scope.phase!=='requested'&&scope.phase!=='disable'&&scope.inventoryVersion!==INVENTORY_VERSION){await scopeRef.update({phase:'v2_inventory',status:'processing',collectionIndex:0,cursor:'',verifyCursor:'',finalInventory:false,inventoryComplete:false,inventoryVersion:INVENTORY_VERSION});return;}
  if(scope.status==='needs_review') {await ref.update({status:'needs_review',blockedDatabase:databaseId,lastError:'scope_exception_requires_review'});return;}
  if(scope.phase==='scoped_reconcile'){await scopeRef.update({phase:'v2_inventory',collectionIndex:0,cursor:'',verifyCursor:'',finalInventory:true,incomingBlocksChecked:false,blockCursor:''});return;}
  if(['requested','disable','v2_inventory','v2_redact'].includes(scope.phase)) {if(!/^[a-f0-9]{64}$/.test(scope.redactionKey||''))throw Error('missing_redaction_key');await step(db,auth,scopeRef,scope,{policy,databaseId,redactionKey:scope.redactionKey});return;}
  if(scope.phase==='private') {
   // Verify all inventory pages BEFORE erasing private profiles or creating a completion receipt.
   let query=scopeRef.collection('inventory').orderBy('__name__').limit(50);
   if(scope.verifyCursor)query=query.startAfter(scope.verifyCursor);
   const page=await query.get();
   for(const item of page.docs) {
    const data=item.data();
    if(!['redacted','already_absent'].includes(data.state)) {await scopeRef.update({status:'needs_review',blockedReceipt:item.id});await ref.update({status:'needs_review',blockedDatabase:databaseId,lastError:data.reason||'scope_inventory_unresolved'});return;}
    if(data.cleanupJobId) {
     const media=(await db.doc(`media_cleanup_jobs/${data.cleanupJobId}`).get()).data();
     if(!media||['pending_legacy_review','parent_restored'].includes(media.status)) {await item.ref.update({state:'needs_review',reason:'media_link_requires_review'});await scopeRef.update({status:'needs_review',blockedReceipt:item.id});await ref.update({status:'needs_review',blockedDatabase:databaseId,lastError:'media_link_requires_review'});return;}
     if(media.status!=='complete'){await ref.update({status:'waiting_for_media',lastError:'scope_media_pending'});return;}
    }
   }
   if(page.size===50){await scopeRef.update({verifyCursor:page.docs.at(-1).id});return;}
   await scopeRef.update({phase:'scoped_private',privateIndex:0});return;
  }
  if(scope.phase==='scoped_private') {
   const collection=PRIVATE[scope.privateIndex||0];
   if(collection) {
    const page=await db.collection(collection).where(collection==='safety_limits'?'__name__':'uid','==',uid).limit(50).get();
    const batch=db.batch();for(const doc of page.docs)batch.delete(doc.ref);
    if(page.size<50)batch.update(scopeRef,{privateIndex:(scope.privateIndex||0)+1});await batch.commit();return;
   }
   const blocks=await db.collection(`user_blocks/${uid}/targets`).limit(50).get();
   if(!blocks.empty){const batch=db.batch();for(const doc of blocks.docs)batch.delete(doc.ref);await batch.commit();return;}
   if(scope.incomingBlocksChecked!==true){
    // ID-only projection avoids reading another resident's block contents.
    let query=db.collectionGroup('targets').select().orderBy('__name__').limit(50);if(scope.blockCursor)query=query.startAfter(scope.blockCursor);
    const page=await query.get(),batch=db.batch();
    for(const doc of page.docs){const parts=doc.ref.path.split('/');if(parts.length===4&&parts[0]==='user_blocks'&&parts[2]==='targets'&&parts[3]===uid)batch.delete(doc.ref);}
    batch.update(scopeRef,page.size===50?{blockCursor:page.docs.at(-1).ref.path}:{incomingBlocksChecked:true,blockCursor:''});await batch.commit();return;
   }
   // Exact UID document paths, never a directory search by name/email.
   const batch=db.batch();batch.delete(db.doc(`users/${uid}`));batch.delete(db.doc(`resident_directory/${uid}`));batch.delete(db.doc(`user_blocks/${uid}`));
   batch.update(scopeRef,scope.finalInventory===true?{phase:'scoped_complete',status:'complete',completedAt:new Date(now)}:{phase:'scoped_reconcile',status:'processing'});await batch.commit();return;
  }
  if(scope.phase==='scoped_complete') {
   // Write through to the root AFTER the independent database's transaction committed.
   // A crash between those commits simply replays this deterministic receipt.
   const receipt={databaseId,uid,policyReference:job.review.policyReference,inventoryVersion:scope.inventoryVersion,inventoryComplete:true,recordsComplete:true,writesFrozen:true,unresolvedIdentityCount:0,unresolvedMediaCount:0,completedAt:scope.completedAt};
   const proofs=(job.databaseCompletion||[]).filter(s=>s.databaseId!==databaseId);
   await ref.update({databaseCompletion:[...proofs,receipt],scopeIndex:(job.scopeIndex||0)+1,status:'processing',lastError:''});return;
  }
  throw Error('unsupported_scope_phase');
 }
 if(job.phase==='scoped_auth') {
  if(!databaseCompletionReady(job,now)) {await ref.update({status:'needs_review',lastError:'cross_database_completion_required'});return;}
  await clearWebAccess();
  try{await auth.deleteUser(uid);}catch(error){if(error.code!=='auth/user-not-found')throw error;}
  await ref.update({phase:'scoped_retention',status:'retention_pending',identityDeletedAt:new Date(now),completedAt:new Date(now)});return;
 }
 if(job.phase==='scoped_retention') {
  if(now<dates.retentionDueAt)return;
  // Each scope's receipts are removed independently before the root, preserving retry progress.
  for(const databaseId of DATABASES) {
   const db=dbFor(databaseId),scopeRef=db.doc(`account_deletion_scopes/${id}`);
   const page=await scopeRef.collection('inventory').limit(50).get();
   if(!page.empty){for(const receipt of page.docs)await db.runTransaction(async tx=>{const data=(await tx.get(receipt.ref)).data();if(data?.expireRecord){const recordRef=db.doc(data.path),record=await tx.get(recordRef);if(record.data()?.deletionExpiresAt===dates.retentionDueAt)tx.delete(recordRef);}tx.delete(receipt.ref);});return;}
   const media=await db.collection('media_cleanup_jobs').where('uid','==',uid).where('status','in',['complete','parent_restored']).limit(50).get();
   if(!media.empty){for(const receipt of media.docs)await db.runTransaction(async tx=>{const live=(await tx.get(receipt.ref)).data();if(live?.uid===uid&&['complete','parent_restored'].includes(live.status))tx.delete(receipt.ref);});return;}
   await db.runTransaction(async tx=>{
    const fence=db.doc(`account_access_revocations/${uid}`),proof=(await tx.get(fence)).data();
    if(proof&&(proof.uid!==uid||proof.jobId!==id))throw Error('access_fence_conflict');
    tx.delete(scopeRef);if(proof)tx.delete(fence);
   });
  }
  const devices=await control.collection('account_cleanup_devices').where('uid','==',uid).limit(50).get();
  if(!devices.empty){const batch=control.batch();for(const device of devices.docs)batch.delete(device.ref);await batch.commit();return;}
  const reviews=await ref.collection('reviews').limit(50).get();
  if(!reviews.empty){const batch=control.batch();for(const review of reviews.docs)batch.delete(review.ref);await batch.commit();return;}
  await control.runTransaction(async tx=>{const cursor=control.doc('deletion_policies/review_cursor'),state=(await tx.get(cursor)).data();if(state?.lastJobId===id)tx.set(cursor,{lastAttemptAt:null,lastJobId:''});tx.delete(ref);});
 }
}
module.exports={advanceScopedDeletion};
