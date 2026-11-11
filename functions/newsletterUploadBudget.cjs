'use strict';
const { createHash } = require('node:crypto');
const { budget } = require('./abuseLimits.cjs');
const { ms } = require('./abusePolicy.cjs');
const { approved } = require('./inbox-policy.cjs');
const { assertReferenceWritesAllowed } = require('./referenceWriteBarrier.cjs');
const CHUNK_BYTES = 480 * 1024, PREFIX_LENGTH = 'data:application/pdf;base64,'.length;
const TTL_MS = 24 * 60 * 60 * 1000;
const fail = code => { throw Error(code); };
const reservationId = (uid, id) => createHash('sha256').update(JSON.stringify([uid, id])).digest('hex');
function inputData(data) {
 const {newsletterId,bytes,totalChunks,totalSize}=data||{};
 if(typeof newsletterId!=='string'||newsletterId==='current'||!/^[A-Za-z0-9_-]{1,100}$/.test(newsletterId)||!Number.isSafeInteger(bytes)||bytes<=0||bytes>64*1024*1024||
    totalChunks!==Math.ceil(bytes/CHUNK_BYTES)||totalSize!==PREFIX_LENGTH+Math.ceil(bytes/3)*4)fail('invalid-argument');
 return {newsletterId,bytes,totalChunks,totalSize};
}
const same=(ticket,input)=>['newsletterId','bytes','totalChunks','totalSize'].every(key=>ticket[key]===input[key]);
async function issue(db,uid,data,{now=Date.now()}={}) {
 if(typeof uid!=='string'||!uid||uid.includes('/')||uid.length>128)fail('unauthenticated');
 const input=inputData(data);if(!Number.isSafeInteger(now))fail('invalid-argument');
 const id=reservationId(uid,input.newsletterId),quotaRef=db.doc(`safety_limits/${uid}`);
 return db.runTransaction(async tx=>{
  await assertReferenceWritesAllowed(tx,db);
  const [user,edition,quota,revocation]=await Promise.all([tx.get(db.doc(`users/${uid}`)),tx.get(db.doc(`newsletters/${input.newsletterId}`)),tx.get(quotaRef),tx.get(db.doc(`account_access_revocations/${uid}`))]);
  const profile=user.data(),parent=edition.data();
  if(revocation.exists||!approved(profile)||!['admin','vip'].includes(profile.role))fail('permission-denied');
  if(parent?.uploadedBy&&parent.uploadedBy!==uid)fail('permission-denied');
  if(parent?.uploadState==='published'||parent?.isRemoved===true)fail('failed-precondition');
  if(parent?.id&&parent.id!==input.newsletterId)fail('failed-precondition');
  for(const [field,value]of [['sourceBytes',input.bytes],['totalChunks',input.totalChunks],['totalSize',input.totalSize]])if(parent?.[field]!==undefined&&parent[field]!==value)fail('failed-precondition');
  const old=quota.data()||{},tickets=old.pdfUploads||{},existing=tickets[id];
  if(existing&&ms(existing.expiresAt)>now){
   if(existing.uid!==uid||!same(existing,input)||existing.status!=='issued'||parent?.uploadBudgetId&&parent.uploadBudgetId!==id)fail('failed-precondition');
   return {reservationId:id,expiresAt:ms(existing.expiresAt)};
  }
  if(parent?.uploadState==='uploaded')fail('failed-precondition');
  if(parent?.uploadBudgetId&&parent.uploadBudgetId!==id)fail('failed-precondition');
  const apply=await budget(tx,db,uid,'pdf',id,now,input.bytes),expiresAt=now+TTL_MS;
  const retained=Object.fromEntries(Object.entries(tickets).filter(([,ticket])=>ms(ticket.expiresAt)>now));
  retained[id]={...input,uid,status:'issued',issuedAt:new Date(now),expiresAt:new Date(expiresAt)};
  apply();tx.update(quotaRef,{pdfUploads:retained});
  return {reservationId:id,expiresAt};
 });
}
async function issueAuthenticated(db,identity,request,options) {
 const uid=request?.auth?.uid,claims=request?.auth?.token;
 if(typeof uid!=='string'||!claims||claims.firebase?.sign_in_provider==='anonymous'||!Number.isFinite(claims.auth_time)||claims.auth_time<=0)fail('unauthenticated');
 const user=await identity(uid),validAfter=Date.parse(user?.tokensValidAfterTime||'1970-01-01');
 if(!user||user.uid!==uid||user.disabled||!Number.isFinite(validAfter)||claims.auth_time*1000<validAfter)fail('unauthenticated');
 return issue(db,uid,request.data,options);
}
module.exports={issue,issueAuthenticated,reservationId,TTL_MS,CHUNK_BYTES,PREFIX_LENGTH};
