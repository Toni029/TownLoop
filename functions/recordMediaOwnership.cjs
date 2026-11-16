// Exact per-record attachment authorization using the existing upload callable and immutable Storage metadata.
const {canonicalPath,references}=require('./databaseCleanupStorage.cjs');
const {trustedMedia}=require('./mediaCleanupPolicy.cjs');
const {getApp}=require('firebase-admin/app');
const {createHash}=require('node:crypto');
const {budget}=require('./abuseLimits.cjs');
const {assertReferenceWritesAllowed}=require('./referenceWriteBarrier.cjs');
const BUCKET='cc-livingcommunity-app.firebasestorage.app';
const COLLECTIONS=['marketplace_posts','discussion_feed','work_orders'];
const fail=(code)=>{throw Object.assign(Error(code),{code});};
async function authorizeReferences(db,bucket,uid,input){
 const {collection,recordId}=input||{};
 if(db.databaseId!=='(default)'||bucket.name!==BUCKET||!COLLECTIONS.includes(collection)||typeof recordId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(recordId))fail('invalid-argument');
 const order=collection==='work_orders',media=input.media??[],photos=input.photos??[],photo=input.photo??'';
 if(!Array.isArray(media)||!Array.isArray(photos)||media.length>100||photos.length>100||typeof photo!=='string'||photos.some(x=>typeof x!=='string')||media.some(x=>!x||!['image','video'].includes(x.type)||typeof x.url!=='string'||Object.keys(x).some(k=>!['type','url','name'].includes(k))))fail('invalid-argument');
 if(order&&media.length||!order&&(photos.length||photo))fail('invalid-argument');
 const desired={media:media.map(m=>({type:m.type,url:m.url,...(typeof m.name==='string'?{name:m.name}:{})})),mediaUrl:media[0]?.url||'',photos:[...photos],photoUrl:photos[0]||'',commentPhoto:photo};
 const urls=[...new Set(order?[...photos,photo].filter(Boolean):media.map(m=>m.url))];if(urls.some(x=>x.length>4000))fail('invalid-argument');
 const ref=db.doc(collection+'/'+recordId);
 const first=await db.runTransaction(async tx=>{await assertReferenceWritesAllowed(tx,db);const [p,u,r]=await Promise.all([tx.get(ref),tx.get(db.doc('users/'+uid)),tx.get(db.doc('account_access_revocations/'+uid))]);const profile=u.data(),parent=p.data();if(!p.exists||r.exists||profile?.approved!==true||profile.deletionPending||!['resident','crew','admin','vip'].includes(profile.role))fail('permission-denied');const own=(parent.userId??parent.authorId)===uid,staff=['admin','vip','crew'].includes(profile.role);if(order?!(own||staff&&parent.storageDraft===false):!(own||['admin','vip'].includes(profile.role)))fail('permission-denied');const apply=await budget(tx,db,uid,'expensiveRead','media:'+collection+':'+recordId,Date.now());apply();return p;});
 const parent=first.data(),owner=parent.userId??parent.authorId;const policy=(await db.doc('deletion_policies/media').get()).data();
 const existing=references(Object.fromEntries(['media','mediaUrl','photos','photoUrl','comments'].filter(k=>parent[k]!=null).map(k=>[k,parent[k]]))).paths;
 for(const url of urls){const path=canonicalPath(url);if(!path)fail('invalid-argument');let metadata;try{[metadata]=await bucket.file(path).getMetadata();}catch{fail('failed-precondition');}
  // Existing legacy associations may be retained in THIS record only, never imported into another.
  if(existing.includes(path))continue;
  if(metadata.name!==path||metadata.metadata?.collection!==collection||metadata.metadata?.recordId!==recordId||!metadata.metageneration||!trustedMedia(metadata,{collection,recordId,uid:order?metadata.metadata?.uploadedBy:owner,databaseId:'(default)'},policy)||(!order&&metadata.metadata.uploadedBy!==owner))fail('permission-denied');
 }
 if(JSON.stringify(desired).length>128*1024)fail('invalid-argument');
 await db.runTransaction(async tx=>{await assertReferenceWritesAllowed(tx,db);const control=db.doc('safety_limits/'+uid);const [p,u,r,t,c]=await Promise.all([tx.get(ref),tx.get(db.doc('users/'+uid)),tx.get(db.doc('account_access_revocations/'+uid)),tx.get(db.doc('media_deletion_tombstones/'+collection+'/records/'+recordId)),tx.get(control)]);const profile=u.data(),data=p.data();if(!p.exists||t.exists||r.exists||profile?.approved!==true||profile.deletionPending||!['resident','crew','admin','vip'].includes(profile.role))fail('permission-denied');
  if(first.updateTime?.isEqual&&!first.updateTime.isEqual(p.updateTime))fail('failed-precondition');
  const owns=(data.userId??data.authorId)===uid,staff=['admin','vip','crew'].includes(profile.role);
  if(order?!(owns||staff&&data.storageDraft===false):!(owns||['admin','vip'].includes(profile.role)))fail('permission-denied');
  const at=Date.now(),tickets=Object.fromEntries(Object.entries(c.data()?.recordMediaAuthorizations||{}).filter(([,v])=>v.expiresAt?.toMillis?.()>at).slice(-3));
  tickets[collection+':'+recordId]={collection,recordId,ownerUid:data.userId??data.authorId??'',desired,expiresAt:new Date(at+15*60000)};
  if(c.exists)tx.update(control,{recordMediaAuthorizations:tickets});else tx.set(control,{recordMediaAuthorizations:tickets});
 });return{authorized:true};
}
async function authorizeAuthenticated(db,bucket,identity,request){const uid=request.auth?.uid,claims=request.auth?.token;if(!uid||claims?.firebase?.sign_in_provider==='anonymous'||(!Number.isFinite(claims?.auth_time)||claims.auth_time<=0||claims.auth_time*1000>Date.now()+30000))fail('unauthenticated');const user=await identity(uid);if(!user||user.disabled||user.uid!==uid||claims.auth_time*1000<Date.parse(user.tokensValidAfterTime||'1970-01-01'))fail('unauthenticated');return authorizeReferences(db,bucket,uid,request.data);}
async function verifyOwnershipRules(){
 const app=getApp(),token=await app.options.credential.getAccessToken();const read=async name=>{const r=await fetch('https://firebaserules.googleapis.com/v1/'+name,{headers:{Authorization:'Bearer '+token.access_token},signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('ownership_rules_unavailable');return r.json();};const storageRelease=await read('projects/cc-livingcommunity-app/releases/firebase.storage/'+BUCKET),storageRules=await read(storageRelease.rulesetName);const policy=(await require('firebase-admin/firestore').getFirestore().doc('deletion_policies/media').get()).data();if(storageRules.source?.files?.length!==1||createHash('sha256').update(storageRules.source.files[0].content).digest('hex')!==require('./deletionMediaProvenance.json').storageRulesSha256||policy?.trustedUploadsAfter?.toMillis?.()!==Date.parse(storageRelease.updateTime))throw Error('ownership_storage_rules_changed');const release=await read('projects/cc-livingcommunity-app/releases/cloud.firestore'),rules=await read(release.rulesetName);if(rules.source?.files?.length!==1)throw Error('ownership_rules_unavailable');if(createHash('sha256').update(rules.source.files[0].content).digest('hex')!==require('./recordMediaRulesPin.json').sha256)throw Error('ownership_rules_not_active');
}
module.exports={authorizeReferences,authorizeAuthenticated,verifyOwnershipRules,BUCKET};
