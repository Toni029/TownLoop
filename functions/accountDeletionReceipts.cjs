'use strict';
const L=require('./accountDeletionLifecycle.cjs'),{DATABASES}=require('./accountDeletionScope.cjs'),{jobIdFor}=require('./accountDeletionPolicy.cjs');
// One dedicated root TTL field; NEVER TTL child proofs independently. Reopening
// clears it atomically, preserving every recovery proof while cleanup is pending.
async function markReceiptExpiry(control,ref,job){
 if(!L.isNewJob(job)||!L.executionAuthorized(job))return;
 await control.runTransaction(async tx=>{const current=(await tx.get(ref)).data();if(current?.requestId!==job.requestId)return;
  const complete=current.status==='complete'&&current.phase==='complete'&&!!current.identityDeletedAt;
  const expiry=complete?new Date(Math.max(L.executionDates(current).retentionDueAt,L.millis(current.accessSecuredAt||current.identityDeletedAt)+7*L.DAY,L.millis(current.firstCompletedAt||current.completedAt))):null;
  tx.update(ref,{v3ReceiptExpiresAt:expiry});
 });
}
// The existing job event prunes only server-owned proofs after its completed root
// expires. A retry continues from remaining metadata. No Auth/content/Storage API.
async function expireReceipts(control,jobId,job,{dbFor,now=Date.now()}={}){
 if(jobId!==jobIdFor(job.uid)||!L.isNewJob(job)||job.status!=='complete'||job.phase!=='complete'||!job.identityDeletedAt||!L.executionAuthorized(job)||!Number.isFinite(L.millis(job.v3ReceiptExpiresAt))||L.millis(job.v3ReceiptExpiresAt)>now)return;
 const root=control.doc('account_deletion_jobs/'+jobId);if((await root.get()).exists)return;
 async function removeRows(db,collection,guard=()=>true){for(let page=0;page<20;page++){const rows=await collection.limit(100).get();if(rows.empty)return;const batch=db.batch();for(const row of rows.docs){if(!guard(row.data()))throw Error('receipt_identity_mismatch');batch.delete(row.ref);}await batch.commit();}throw Error('receipt_retry_required');}
 for(const databaseId of DATABASES){const db=dbFor(databaseId),scopeRef=db.doc('account_deletion_scopes/'+jobIdFor(job.uid)),scope=(await scopeRef.get()).data();
  if(scope){if(scope.uid!==job.uid||scope.requestId!==job.requestId)throw Error('scope_identity_mismatch');await removeRows(db,scopeRef.collection('inventory'));await db.runTransaction(async tx=>{const s=(await tx.get(scopeRef)).data();if(s?.uid===job.uid&&s.requestId===job.requestId)tx.delete(scopeRef);});}
  await removeRows(db,db.collection('media_cleanup_jobs').where('accountDeletionJobId','==',jobId).where('requestId','==',job.requestId),m=>m.uid===job.uid&&m.databaseId===databaseId&&m.status==='complete');
  const fence=db.doc('account_access_revocations/'+job.uid);await db.runTransaction(async tx=>{const f=(await tx.get(fence)).data();if(f?.uid===job.uid&&f.requestId===job.requestId)tx.delete(fence);});
 }
 await removeRows(control,control.collection('account_cleanup_devices').where('uid','==',job.uid).where('requestId','==',job.requestId));
 if(!(await root.get()).exists)for(const requestId of [...new Set([job.requestId,...(job.requestHistory||[])])])await removeRows(control,root.collection('reviews').where('requestId','==',requestId));
}
module.exports={markReceiptExpiry,expireReceipts};
