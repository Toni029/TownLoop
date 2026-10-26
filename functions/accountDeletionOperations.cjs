// Separate operations surface. Nothing here activates workers or rewrites ownership.
const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {getFirestore,FieldValue}=require('firebase-admin/firestore');
const {getAuth}=require('firebase-admin/auth');
const {DATABASES,writeFreezeReady}=require('./accountDeletionScope.cjs');
const {jobIdFor,referencesUid}=require('./accountDeletionPolicy.cjs');
const retention=require('./accountDeletionRetention.cjs');
const options={region:'us-central1',maxInstances:1,timeoutSeconds:60};
async function admin(request) {
 if(!request.auth?.uid)throw new HttpsError('unauthenticated','Sign in first.');
 let token;try{token=await getAuth().verifyIdToken(request.rawRequest?.headers?.authorization?.match(/^Bearer (.+)$/i)?.[1]||'',true);}catch{throw new HttpsError('unauthenticated','Sign in again.');}
 if(token.uid!==request.auth.uid)throw new HttpsError('unauthenticated','Session mismatch.');
 const profile=(await getFirestore('(default)').doc(`users/${token.uid}`).get()).data();
 if(profile?.approved!==true||profile.role!=='admin'||profile.deletionPending===true)throw new HttpsError('permission-denied','An authorized Admin is required.');
 return token;
}
function jobId(value){if(!/^[a-f0-9]{64}$/.test(value||''))throw new HttpsError('invalid-argument','Invalid request.');return value;}
exports.authorizeAccountDeletionProcessing=onCall(options,async request=>{
 const actor=await admin(request);
 if(process.env.TOWNLOOP_ACCOUNT_DELETION_ENABLED!=='true'||process.env.TOWNLOOP_SCOPED_DELETION_ENABLED!=='true')throw new HttpsError('failed-precondition','Processing remains inactive.');
 const authenticatedAt=Number(actor.auth_time)*1000;
 if(request.data?.confirmation!=='AUTHORIZE PROCESSING'||!Number.isFinite(authenticatedAt)||authenticatedAt>Date.now()+30000||Date.now()-authenticatedAt>300000)throw new HttpsError('failed-precondition','Verify your identity again and confirm authorization.');
 const db=getFirestore('(default)'),ref=db.doc(`account_deletion_jobs/${jobId(request.data?.jobId)}`);
 return db.runTransaction(async tx=>{
  const [profile,current,policy]=await Promise.all([tx.get(db.doc(`users/${actor.uid}`)),tx.get(ref),tx.get(db.doc('deletion_policies/account'))]);
  const p=profile.data(),job=current.data();
  if(p?.role!=='admin'||p.approved!==true||p.deletionPending)throw new HttpsError('permission-denied','Admin authorization changed.');
  if(!job||job.uid===actor.uid||job.review?.reviewerId===job.uid||job.review?.decision!=='approved')throw new HttpsError('permission-denied','Independent approved request required.');
  if(!retention.policyReady(policy.data())||job.review.policyReference!==policy.data().approvalReference||!writeFreezeReady(policy.data()))throw new HttpsError('failed-precondition','Verified processing policy required.');
  if(job.processingProtocol===3&&job.review.processingAuthorized===true)return {status:job.status};
  if(job.status!=='approved_held'||job.phase!=='requested')throw new HttpsError('failed-precondition','Request is not held for processing.');
  const due=retention.deadlines(job.createdAt).retentionDueAt;
  tx.create(ref.collection('reviews').doc('processing_authorization'),{kind:'processing_authorization',actorId:actor.uid,createdAt:FieldValue.serverTimestamp(),expiresAt:new Date(due)});
  tx.update(ref,{processingProtocol:3,policyVersion:2,status:'queued',review:{...job.review,processingAuthorized:true},lastAttemptAt:FieldValue.serverTimestamp()});return {status:'queued'};
 });
});
exports.listAccountDeletionExceptions=onCall(options,async request=>{
 await admin(request);
 const root=(await getFirestore('(default)').doc(`account_deletion_jobs/${jobId(request.data?.jobId)}`).get()).data();
 if(!root||root.processingProtocol!==3)throw new HttpsError('not-found','Scoped request not found.');
 const databaseId=request.data?.databaseId||DATABASES[0];if(!DATABASES.includes(databaseId))throw new HttpsError('invalid-argument','Invalid database scope.');
 const ref=getFirestore(databaseId).doc(`account_deletion_scopes/${jobIdFor(root.uid)}`);
 let query=ref.collection('inventory').where('state','==','needs_review').orderBy('__name__').limit(25);
 if(request.data?.cursor){if(!/^[a-f0-9]{64}$/.test(request.data.cursor))throw new HttpsError('invalid-argument','Invalid cursor.');query=query.startAfter(request.data.cursor);}
 const page=await query.get();
 return {databaseId,summary:root.lastError||'',exceptions:page.docs.map(d=>({id:d.id,collection:d.data().collection,recordId:d.data().path?.split('/').at(-1),reason:d.data().reason||'ownership_requires_review'})),nextCursor:page.size===25?page.docs.at(-1).id:null};
});
exports.recheckAccountDeletionException=onCall(options,async request=>{
 const actor=await admin(request),input=request.data||{},databaseId=input.databaseId;
 if(!DATABASES.includes(databaseId)||input.confirmation!=='RECHECK')throw new HttpsError('invalid-argument','Confirm the exact exception.');
 const control=getFirestore('(default)'),rootRef=control.doc(`account_deletion_jobs/${jobId(input.jobId)}`),root=(await rootRef.get()).data();
 if(root?.uid!==actor.uid&&root?.processingProtocol===3&&root.status==='processing'&&root.lastExceptionRecheck===`${databaseId}/${input.receiptId}`)return {status:'processing'};
 if(!root||root.uid===actor.uid||root.processingProtocol!==3||root.review?.processingAuthorized!==true||root.review?.decision!=='approved'||root.status!=='needs_review')throw new HttpsError('failed-precondition','Independent paused request required.');
 const db=getFirestore(databaseId),scopeRef=db.doc(`account_deletion_scopes/${jobIdFor(root.uid)}`),receiptRef=scopeRef.collection('inventory').doc(jobId(input.receiptId));
 await db.runTransaction(async tx=>{
  const [scope,receipt]=await Promise.all([tx.get(scopeRef),tx.get(receiptRef)]),data=receipt.data();
  if(scope.data()?.uid!==root.uid||!data||!(data.state==='needs_review'||data.recheckVerified===true)||typeof data.path!=='string'||data.path.split('/').length!==2||data.path.split('/')[0]!==data.collection)throw new HttpsError('failed-precondition','Exception identity changed.');
  if(data.state!=='needs_review'&&data.recheckVerified===true){tx.update(scopeRef,{phase:'v2_redact',status:'processing',verifyCursor:''});return;}
  const record=await tx.get(db.doc(data.path));
  if(!record.exists){tx.update(receiptRef,{state:'already_absent',reason:'',recheckVerified:true});}
  else if(data.reason==='media_link_requires_review'||data.reason==='removed_comment_media_requires_exact_link_review') {
   if(!data.cleanupJobId||(await tx.get(db.doc(`media_cleanup_jobs/${data.cleanupJobId}`))).data()?.status!=='complete')throw new HttpsError('failed-precondition','Verified media resolution is still required.');
   tx.update(receiptRef,{state:'redacted',reason:'',recheckVerified:true});
  }else{
   const plan=retention.plan(data.collection,record.data(),root.uid),after=['replace','replace_audit'].includes(plan.action)?plan.data:{...record.data(),...plan.patch};
   if(plan.action==='review'||(plan.action!=='delete_parent'&&referencesUid(after,root.uid)))throw new HttpsError('failed-precondition','Ownership is still unresolved; no change made.');
   tx.update(receiptRef,{state:'pending_redaction',reason:'',recheckVerified:true});
  }
  tx.update(scopeRef,{phase:'v2_redact',status:'processing',verifyCursor:''});
 });
 // Recheck canonical Admin in the root transaction; a cross-database update never grants authority.
 await control.runTransaction(async tx=>{
  const [profile,current]=await Promise.all([tx.get(control.doc(`users/${actor.uid}`)),tx.get(rootRef)]);
  if(profile.data()?.role!=='admin'||profile.data()?.approved!==true||profile.data()?.deletionPending||current.data()?.uid===actor.uid)throw new HttpsError('permission-denied','Admin authorization changed.');
  tx.set(rootRef.collection('reviews').doc(`exception_${jobId(input.receiptId)}`),{kind:'exception_recheck',actorId:actor.uid,databaseId,createdAt:FieldValue.serverTimestamp(),expiresAt:new Date(retention.deadlines(root.createdAt).retentionDueAt)});
  tx.update(rootRef,{status:'processing',lastError:'',lastExceptionRecheck:`${databaseId}/${input.receiptId}`,lastAttemptAt:FieldValue.serverTimestamp()});
 });
 return {status:'processing'};
});
exports.recheckAccountDeletionScope=onCall(options,async request=>{
 const actor=await admin(request),input=request.data||{};
 if(input.confirmation!=='RECHECK')throw new HttpsError('invalid-argument','Confirm the safeguard recheck.');
 const control=getFirestore('(default)'),ref=control.doc(`account_deletion_jobs/${jobId(input.jobId)}`),root=(await ref.get()).data();
 if(!root||root.uid===actor.uid||root.processingProtocol!==3||root.review?.processingAuthorized!==true||root.review?.decision!=='approved'||root.status!=='needs_review'||!['profile_identity_conflict','cross_database_completion_required','processing_permission_or_schema_requires_review'].includes(root.lastError))throw new HttpsError('failed-precondition','Resolve the specific record exception first.');
 if(root.lastError==='profile_identity_conflict') {
  const identity=await getAuth().getUser(root.uid);if(identity.uid!==root.uid)throw new HttpsError('failed-precondition','Identity is unresolved.');
  for(const databaseId of DATABASES){const profile=(await getFirestore(databaseId).doc(`users/${root.uid}`).get()).data();if(profile&&['id','uid','userId','authorId'].some(key=>profile[key]!=null&&profile[key]!==root.uid))throw new HttpsError('failed-precondition','Profile identity is still conflicting.');}
 }else if(root.lastError==='cross_database_completion_required')for(const databaseId of DATABASES){const scope=(await getFirestore(databaseId).doc(`account_deletion_scopes/${jobIdFor(root.uid)}`).get()).data();if(scope?.uid!==root.uid||scope.phase!=='scoped_complete'||scope.review?.policyReference!==root.review?.policyReference)throw new HttpsError('failed-precondition','Independent scope completion is still missing.');}
 if(root.lastError==='processing_permission_or_schema_requires_review'){const policy=(await control.doc('deletion_policies/account').get()).data();if(!retention.policyReady(policy)||!writeFreezeReady(policy))throw new HttpsError('failed-precondition','Restore the verified policy before retrying.');}
 await control.runTransaction(async tx=>{
  const [profile,current]=await Promise.all([tx.get(control.doc(`users/${actor.uid}`)),tx.get(ref)]);
  if(profile.data()?.role!=='admin'||profile.data()?.approved!==true||profile.data()?.deletionPending||current.data()?.uid!==root.uid||current.data()?.lastError!==root.lastError)throw new HttpsError('permission-denied','Authorization or scope changed.');
  tx.set(ref.collection('reviews').doc(`scope_recheck_${root.lastError}`),{kind:'scope_recheck',actorId:actor.uid,createdAt:FieldValue.serverTimestamp(),expiresAt:new Date(retention.deadlines(root.createdAt).retentionDueAt)});
  tx.update(ref,{phase:root.lastError==='profile_identity_conflict'?'requested':root.lastError==='cross_database_completion_required'?'scoped_run':root.phase,scopeIndex:root.lastError==='cross_database_completion_required'?0:root.scopeIndex||0,status:'processing',lastError:'',lastAttemptAt:FieldValue.serverTimestamp()});
 });return {status:'processing'};
});
