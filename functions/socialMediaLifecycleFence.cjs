'use strict';
const {createHash,randomUUID}=require('node:crypto');
const {BUCKET}=require('./socialMediaLifecycle.cjs');
const hash=value=>createHash('sha256').update(value).digest('hex');
const CONTROL='social_media_control/active';
/**
 * Persistent, deliberately non-expiring write barrier. No global-cleanup state is read or changed.
 * deploymentReady must verify deployed rules AND all privileged writers; default is fail closed.
 * There is no timer-based unlock: uncertain Storage requests keep the default database frozen.
 */
function createSocialReferenceFence({databases,controlDb,bucket,deploymentReady=async()=>false,now=Date.now}){
 if(bucket.name!==BUCKET||controlDb.databaseId!=='(default)'||!databases.length||!databases.includes(controlDb)||new Set(databases.map(db=>db.databaseId)).size!==databases.length)throw Error('Social fence scope mismatch');
 const control=source=>source.doc(CONTROL),attempts=controlDb.collection('social_media_deletion_attempts');
 async function ready(){if(!await deploymentReady())throw Error('reference_writers_unfenced');}
 async function acquire(jobId){
  await ready();
  // The default control serializes workers globally; another job cannot steal a crashed worker's fence.
  const token=await controlDb.runTransaction(async tx=>{
   const snapshot=await tx.get(control(controlDb)),data=snapshot.data();
   if(data?.blocked===true&&data.jobId!==jobId)throw Error('reference_writers_unfenced');
   const token=data?.blocked===true?data.token:randomUUID();
   if(typeof token!=='string'||!token)throw Error('reference_writers_unfenced');
   tx.set(control(controlDb),{blocked:true,jobId,token,createdAt:data?.createdAt||now()});return token;
  });
  // Named databases are read-only references: readiness must prove their writers disabled.
  return token;
 }
 async function run(jobId,body){
  const token=await acquire(jobId);
  async function assertFrozen(){
   await ready();const snapshots=[await control(controlDb).get()];
   return snapshots.every(snapshot=>snapshot.data()?.blocked===true&&snapshot.data()?.jobId===jobId&&snapshot.data()?.token===token);
  }
  async function remove(path,conditions){
   if(!await assertFrozen())throw Error('reference_writers_unfenced');
   const ref=attempts.doc(hash(JSON.stringify([jobId,path,conditions])));
   await controlDb.runTransaction(async tx=>{
    const snapshot=await tx.get(control(controlDb)),data=snapshot.data();
    if(data?.blocked!==true||data.jobId!==jobId||data.token!==token)throw Error('reference_writers_unfenced');
    tx.set(ref,{jobId,token,path,conditions,settled:false,createdAt:now()});
   });
   try{await bucket.file(path).delete(conditions);await ref.update({settled:true,settledAt:now()});}
   catch(error){if(error.code===404||error.code===412)await ref.update({settled:true,settledAt:now()});throw error;}
  }
  try{
   // Settle requests with an unknown outcome under the SAME fence before allowing release.
   const pending=await attempts.where('jobId','==',jobId).where('settled','==',false).limit(201).get();
   if(pending.size>200)throw Error('in_flight_deletion');
   for(const row of pending.docs){const attempt=row.data();if(attempt.token!==token)throw Error('in_flight_deletion');
    try{await remove(attempt.path,attempt.conditions);}catch(error){if(error.code!==404&&error.code!==412)throw Error('in_flight_deletion');}
   }
   return await body(assertFrozen,remove);
  }finally{
   // Clearing the default gate transactionally prevents any additional claims before writes resume.
   const released=await controlDb.runTransaction(async tx=>{
    const [snapshot,pending]=await Promise.all([tx.get(control(controlDb)),tx.get(attempts.where('jobId','==',jobId).where('settled','==',false).limit(1))]);
    const data=snapshot.data();if(data?.jobId!==jobId||data.token!==token||!pending.empty)return false;
    tx.set(control(controlDb),{blocked:false,jobId:null,token:null});return true;
   });
   if(!released)throw Error('in_flight_deletion');
  }
 }
 return {run};
}
/** Every Admin SDK reference writer must read this in its own transaction before any writes. */
async function assertSocialReferenceWritesAllowed(tx,db){if((await tx.get(db.doc(CONTROL))).data()?.blocked===true)throw Error('social_media_cleanup_in_progress');}
module.exports={createSocialReferenceFence,assertSocialReferenceWritesAllowed,CONTROL};
