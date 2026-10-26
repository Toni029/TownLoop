// Read-only queue metadata. Never return another resident's ticket IDs or contents.
const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {getFirestore}=require('firebase-admin/firestore');
const {getAuth}=require('firebase-admin/auth');
function time(value){const n=typeof value?.toMillis==='function'?value.toMillis():typeof value?.seconds==='number'?value.seconds*1000:typeof value==='number'?value:typeof value==='string'?Number(value)||Date.parse(value):0;return Number.isFinite(n)?n:0;}
function positionsFor(records,uid){
 const pending=records.filter(d=>d.storageDraft===false&&d.status!=='Done').sort((a,b)=>time(a.createdAt)-time(b.createdAt)||(a.id<b.id?-1:a.id>b.id?1:0));
 return Object.fromEntries(pending.flatMap((d,i)=>d.userId===uid?[[d.id,i+1]]:[]));
}
exports.positionsFor=positionsFor;
exports.getWorkOrderQueuePositions=onCall({region:'us-central1',timeoutSeconds:30,maxInstances:2},async request=>{
 if(!request.auth?.uid)throw new HttpsError('unauthenticated','Sign in first.');
 const token=request.rawRequest?.headers?.authorization?.match(/^Bearer (.+)$/i)?.[1];
 let identity;try{identity=await getAuth().verifyIdToken(token||'',true);}catch{throw new HttpsError('unauthenticated','Sign in again.');}
 if(identity.uid!==request.auth.uid)throw new HttpsError('unauthenticated','Session mismatch.');
 const db=getFirestore('(default)'),profile=(await db.doc(`users/${identity.uid}`).get()).data();
 if(!profile||profile.approved!==true||profile.deletionPending===true||!['resident','crew','vip','admin'].includes(profile.role))throw new HttpsError('permission-denied','An approved account is required.');
 // Projection excludes descriptions, comments, media, names, addresses and contact details.
 const snapshot=await db.collection('work_orders').where('status','!=','Done').select('createdAt','userId','status','storageDraft').limit(2001).get();
 if(snapshot.size>2000)throw new HttpsError('resource-exhausted','Queue lookup needs a larger-scale configuration.');
 return {positions:positionsFor(snapshot.docs.map(d=>({id:d.id,...d.data()})),identity.uid)};
});
