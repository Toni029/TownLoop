'use strict';
// One server-only control document serializes the two deletion engines. No TTL:
// a crash/uncertain provider response must never expire into concurrent deletion.
const CONTROL='database_cleanup_control/active';
function assertCleanupExecutionAvailable(state){if(state?.accountDeletionOwner!=null)throw Object.assign(Error('account_deletion_in_progress'),{code:'failed-precondition'});}
async function claimAccountExecution(db,owner,now=Date.now()){
 return db.runTransaction(async tx=>{const ref=db.doc(CONTROL),snap=await tx.get(ref),state=snap.data();
  if(state?.referenceWritesBlocked===true||state?.accountDeletionOwner!=null)return false;
  const patch={accountDeletionOwner:owner,accountDeletionStartedAt:now,accountDeletionCoordinationVersion:1};
  if(snap.exists)tx.update(ref,patch);else tx.create(ref,patch);return true;
 });
}
async function releaseAccountExecution(db,owner){
 return db.runTransaction(async tx=>{const ref=db.doc(CONTROL),snap=await tx.get(ref);if(snap.data()?.accountDeletionOwner!==owner)throw Error('coordination_owner_changed');tx.update(ref,{accountDeletionOwner:null,accountDeletionStartedAt:null});});
}
module.exports={CONTROL,claimAccountExecution,releaseAccountExecution,assertCleanupExecutionAvailable};
