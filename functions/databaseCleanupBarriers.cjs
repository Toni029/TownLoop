'use strict';
/** Server metadata only. Never select or mutate any resident record in the named database. */
function createCleanupBarriers({db,databases}){
 const ref=source=>source.doc('database_cleanup_control/active');
 async function verify(job){
  const controls=await Promise.all(databases.map(source=>ref(source).get()));
  return controls.every(snapshot=>snapshot.data()?.jobId===job.id&&snapshot.data()?.referenceWritesBlocked===true);
 }
 async function acquire(job){
  const current=await ref(db).get();if(current.data()?.jobId!==job.id||current.data()?.referenceWritesBlocked!==true)throw Error('cleanup_barrier_not_confirmed');
  for(const source of databases){if(source===db)continue;
   await source.runTransaction(async tx=>{
    const lock=await tx.get(ref(source));
    if(lock.data()?.referenceWritesBlocked&&lock.data()?.jobId!==job.id)throw Error('cleanup_barrier_conflict');
    tx.set(ref(source),{jobId:job.id,referenceWritesBlocked:true,phase:'storage_cleanup',collections:[]},{merge:true});
   });
  }
  if(!await verify(job))throw Error('cleanup_barrier_incomplete');
 }
 async function release(job){
  // Default remains blocked until the job's terminal checkpoint commits.
  for(const source of databases){if(source===db)continue;await source.runTransaction(async tx=>{
   const snapshot=await tx.get(ref(source));if(snapshot.data()?.jobId===job.id)tx.set(ref(source),{jobId:null,referenceWritesBlocked:false,phase:'idle',collections:[]},{merge:true});
  });}
 }
 return {acquire,verify,release};
}
module.exports={createCleanupBarriers};
