// A cleanup-only capability cannot read profiles, messages or authorize deletion.
const {randomBytes,createHash,timingSafeEqual}=require('node:crypto');
const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {getFirestore}=require('firebase-admin/firestore');
const {getAuth}=require('firebase-admin/auth');
const {jobIdFor}=require('./accountDeletionPolicy.cjs');
const {millis}=require('./accountDeletionRetention.cjs');
const options={region:'us-central1',maxInstances:2,timeoutSeconds:30};
const hash=secret=>createHash('sha256').update(secret).digest('hex');
const validId=id=>typeof id==='string'&&/^[a-f0-9]{32}$/.test(id);
const validSecret=secret=>typeof secret==='string'&&/^[a-f0-9]{64}$/.test(secret);
const matches=(secret,digest)=>validSecret(secret)&&typeof digest==='string'&&/^[a-f0-9]{64}$/.test(digest)&&timingSafeEqual(Buffer.from(hash(secret),'hex'),Buffer.from(digest,'hex'));
exports.registerAccountCleanupDevice=onCall(options,async request=>{
 if(process.env.TOWNLOOP_CLEANUP_PROOF_ENABLED!=='true')throw new HttpsError('failed-precondition','Cleanup proof protocol is not active.');
 if(!request.auth?.uid)throw new HttpsError('unauthenticated','Sign in first.');
 const bearer=request.rawRequest?.headers?.authorization?.match(/^Bearer (.+)$/i)?.[1];
 let identity;try{identity=await getAuth().verifyIdToken(bearer||'',true);}catch{throw new HttpsError('unauthenticated','Sign in again.');}
 if(identity.uid!==request.auth.uid)throw new HttpsError('unauthenticated','Session mismatch.');
 const db=getFirestore('(default)'),user=await getAuth().getUser(identity.uid);
 const profile=(await db.doc(`users/${identity.uid}`).get()).data();
 if(user.disabled||profile?.approved!==true||profile.deletionPending===true)throw new HttpsError('permission-denied','Active approved account required.');
 const now=Date.now(),old=request.data||{};
 if(validId(old.deviceId)&&validSecret(old.secret)) {
  const ref=db.doc(`account_cleanup_devices/${old.deviceId}`);
  return db.runTransaction(async tx=>{
   const [existing,liveProfile,job]=await Promise.all([tx.get(ref),tx.get(db.doc(`users/${identity.uid}`)),tx.get(db.doc(`account_deletion_jobs/${jobIdFor(identity.uid)}`))]);
   if(liveProfile.data()?.approved!==true||liveProfile.data()?.deletionPending||job.data()?.review?.processingAuthorized===true)throw new HttpsError('failed-precondition','Processing has started; registration is closed.');
   const current=existing.data();
   if(current?.uid!==identity.uid||!matches(old.secret,current.secretHash)||current.deletionConfirmed||millis(current.expiresAt)<=now)throw new HttpsError('failed-precondition','Register a new cleanup credential.');
   tx.update(ref,{expiresAt:new Date(now+60*86400000)});return {deviceId:old.deviceId,secret:old.secret,uid:identity.uid,expiresAt:now+60*86400000};
  });
 }
 const deviceId=randomBytes(16).toString('hex'),secret=randomBytes(32).toString('hex');
 await db.runTransaction(async tx=>{
  const [devices,liveProfile,job]=await Promise.all([tx.get(db.collection('account_cleanup_devices').where('uid','==',identity.uid).limit(10)),tx.get(db.doc(`users/${identity.uid}`)),tx.get(db.doc(`account_deletion_jobs/${jobIdFor(identity.uid)}`))]);
  if(liveProfile.data()?.approved!==true||liveProfile.data()?.deletionPending||job.data()?.review?.processingAuthorized===true)throw new HttpsError('failed-precondition','Processing has started; registration is closed.');
  if(devices.size>=10)throw new HttpsError('resource-exhausted','Cleanup device registration needs office review.');
  tx.create(db.doc(`account_cleanup_devices/${deviceId}`),{uid:identity.uid,secretHash:hash(secret),createdAt:new Date(now),expiresAt:new Date(now+60*86400000),validAfter:Date.parse(user.tokensValidAfterTime||'1970-01-01')||0,deletionConfirmed:false});
 });
 return {deviceId,secret,uid:identity.uid,expiresAt:now+60*86400000};
});
exports.checkAccountCleanupProof=onCall(options,async request=>{
 if(process.env.TOWNLOOP_CLEANUP_PROOF_ENABLED!=='true')return {confirmed:false,retry:true};
 const {deviceId,secret}=request.data||{};
 if(!validId(deviceId)||!validSecret(secret))return {confirmed:false,unavailable:true};
 const ref=getFirestore('(default)').doc(`account_cleanup_devices/${deviceId}`),record=(await ref.get()).data(),now=Date.now();
 if(!record||!matches(secret,record.secretHash)||millis(record.expiresAt)<=now)return {confirmed:false,unavailable:true};
 let confirmed=record.deletionConfirmed===true;
 if(!confirmed)try{const user=await getAuth().getUser(record.uid);confirmed=user.disabled===true||(Date.parse(user.tokensValidAfterTime||'1970-01-01')||0)>record.validAfter;}catch(error){if(error.code==='auth/user-not-found')confirmed=true;else throw new HttpsError('unavailable','Try again later.');}
 return confirmed?{confirmed:true,uid:record.uid}:{confirmed:false};
});
async function expireCleanupDevices(db,now=Date.now()) {
 const cursor=db.doc('deletion_policies/cleanup_proof_expiry_cursor'),state=(await cursor.get()).data();
 let query=db.collection('account_cleanup_devices').where('expiresAt','<=',new Date(now)).orderBy('expiresAt').orderBy('__name__');
 if(state?.lastExpiry&&state?.lastId)query=query.startAfter(state.lastExpiry,state.lastId);
 const page=await query.limit(50).get();
 for(const device of page.docs)await db.runTransaction(async tx=>{const snap=await tx.get(device.ref),data=snap.data();if(snap.exists&&validId(device.id)&&Number.isFinite(millis(data.expiresAt))&&millis(data.expiresAt)<=now)tx.delete(device.ref);});
 const last=page.docs.at(-1);await db.runTransaction(async tx=>tx.set(cursor,page.size===50?{lastExpiry:last.data().expiresAt,lastId:last.id}:{lastExpiry:null,lastId:''}));
}
exports.expireCleanupDevices=expireCleanupDevices;
exports.matches=matches;
