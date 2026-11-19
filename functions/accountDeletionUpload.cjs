'use strict';
const {createHash}=require('node:crypto'),L=require('./accountDeletionLifecycle.cjs'),{jobIdFor}=require('./accountDeletionPolicy.cjs');
// Finalize only wakes the SAME authorized request. All ownership, evidence and
// cross-reference checks stay in the common processor; this function deletes nothing.
async function wakeLateUpload(db,object,{liveObject,now=Date.now()}={}){
 const m=object?.metadata,uid=m?.uploadedBy;
 if(object?.bucket!=='cc-livingcommunity-app.firebasestorage.app'||typeof uid!=='string'||!uid||uid.includes('/')||m.securityVersion!=='1'||!['discussion_feed','marketplace_posts','work_orders'].includes(m.collection)||typeof m.recordId!=='string'||typeof object.name!=='string'||!object.generation)return false;
 if(!await liveObject(object.name,object.generation))return false;
 const id=jobIdFor(uid),ref=db.doc('account_deletion_jobs/'+id),eventKey=createHash('sha256').update(object.name+'/'+object.generation).digest('hex');
 return db.runTransaction(async tx=>{
  const [j,f,p]=await Promise.all([tx.get(ref),tx.get(db.doc('account_access_revocations/'+uid)),tx.get(db.doc('users/'+uid))]),job=j.data(),fence=f.data();
  if(!L.isNewJob(job)||!L.executionAuthorized(job)||job.uid!==uid||fence?.uid!==uid||fence.jobId!==id||fence.requestId!==job.requestId||p.data()?.approved===true||['requested','rejected','cancelled','needs_review'].includes(job.status)||job.lastLateUpload===eventKey)return false;
  tx.update(ref,{status:'queued',v3ReceiptExpiresAt:null,...(job.status==='complete'?{phase:'scoped_auth',completedAt:null}:{}),lastLateUpload:eventKey,lastAttemptAt:new Date(now),executionSignal:(job.executionSignal||0)+1});return true;
 });
}
module.exports={wakeLateUpload};
