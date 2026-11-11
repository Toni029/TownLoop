'use strict';
const {advance}=require('./abusePolicy.cjs');
// Read before any writes, commit only after the operation's authorization/idempotency checks.
async function budget(tx,db,uid,scope,target,now=Date.now(),bytes=0){
 const ref=db.doc(`safety_limits/${uid}`),snapshot=await tx.get(ref),old=snapshot.data()||{};
 return()=>{const next=advance(old.activity?.[scope],scope,target,now,bytes);delete next.windowReset;delete next.dayReset;for(const key of ['windowAt','dayAt','lastAt'])next[key]=new Date(next[key]);tx.set(ref,{activity:{...(old.activity||{}),[scope]:next},activityScope:scope},{merge:true});};
}
async function charge(db,uid,scope,target,now=Date.now(),bytes=0){return db.runTransaction(async tx=>{const apply=await budget(tx,db,uid,scope,target,now,bytes);apply();});}
module.exports={budget,charge};
