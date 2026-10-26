// Trusted backend only. No message content is persisted in delivery records or payloads.
const {createHash}=require('node:crypto');
const {collections,approved,member,appendedMessage,recipients}=require('./inbox-policy.cjs');
const hash=value=>createHash('sha256').update(value).digest('hex');
const validToken=token=>typeof token==='string'&&token.length<256&&/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/.test(token);
const days=60*86400000;
const error=code=>{throw Error(code);};
const millis=value=>value?.toMillis?.()??+new Date(value||0);
const capability=data=>hash(`${data.installationId}/${data.secret}`);
async function registerDevice(db,uid,data,{now=Date.now(),authTime=now/1000}={}){
 if(!/^[a-f0-9-]{32,64}$/i.test(data.installationId||'')||!/^[-a-zA-Z0-9]{64,128}$/.test(data.secret||''))error('invalid-argument');
 if(!validToken(data.token))error('invalid-argument');
 const oldTokens=data.previousTokens??(data.previousToken?[data.previousToken]:[]);
 if(!Array.isArray(oldTokens)||oldTokens.length>20||oldTokens.some(t=>!validToken(t)))error('invalid-argument');
 const previousRefs=[...new Set(oldTokens)].filter(t=>t!==data.token).map(t=>db.doc(`notification_devices/${hash(t)}`));
 const ref=db.doc(`notification_devices/${hash(data.token)}`),key=capability(data);
 await db.runTransaction(async tx=>{
  const [existing,profile,...previous]=await Promise.all([tx.get(ref),uid?tx.get(db.doc(`users/${uid}`)):null,...previousRefs.map(r=>tx.get(r))]);
  const old=existing.data();
  if(data.remove){if(old&&old.capability!==key)error('permission-denied');if(old)tx.delete(ref);for(const snap of previous)if(snap.data()?.capability===key)tx.delete(snap.ref);return;}
  if(!uid)error('unauthenticated');if(!approved(profile?.data()))error('permission-denied');
  if(!['android','ios'].includes(data.platform))error('invalid-argument');
  // A token alone cannot transfer a device to another account. Account switching
  // requires the same installation's protected capability; legacy same-owner upgrade is safe.
  if(old&&old.uid!==uid&&old.capability!==key)error('permission-denied');
  for(const snap of previous)if(snap.data()?.uid===uid&&snap.data().capability===key)tx.delete(snap.ref);
  tx.set(ref,{uid,token:data.token,platform:data.platform,capability:key,enabled:data.enabled!==false,
   authTime,updatedAt:new Date(now),expiresAt:new Date(now+days)});
 });
 return {registered:!data.remove};
}
async function removeInvalidDevice(db,ref,uid,cap){await db.runTransaction(async tx=>{const d=(await tx.get(ref)).data();if(d?.uid===uid&&d.capability===cap)tx.delete(ref);});}
const activeIdentity=async(identity,uid,device)=>{
 try{const user=await identity(uid);return !user.disabled&&(!device||device.authTime*1000>=Date.parse(user.tokensValidAfterTime||'1970-01-01'));}catch{return false;}
};
async function blocked(db,a,b,tx){const get=r=>tx?tx.get(r):r.get();return (await Promise.all([get(db.doc(`user_blocks/${a}/targets/${b}`)),get(db.doc(`user_blocks/${b}/targets/${a}`))])).some(s=>s.exists);}
async function deliver(db,event,collection,{now=Date.now(),identity,transport}={}){
 const after=event.data?.after.data();
 if(!after||!event.authId||['system','unauthenticated','service_account'].includes(event.authType)||!collections[collection])return;
 // Never notify from delayed backfills/replays beyond the push's useful lifetime.
 if(!Number.isFinite(Date.parse(event.time))||now-Date.parse(event.time)>3600000)return;
 const sender={...(await db.doc(`users/${event.authId}`).get()).data(),id:event.authId};
 if(!member(collection,after,sender)||!await activeIdentity(identity,sender.id))return;
 const message=appendedMessage(event.data.before.data(),after,sender);if(!message)return;
 const profiles=new Map(),add=s=>{if(s.exists)profiles.set(s.id,{...s.data(),id:s.id});};
 if(['resident_chats','marketplace_chats'].includes(collection)){
  for(const uid of (after.participantIds||[]).slice(0,2))if(typeof uid==='string'&&uid&&!uid.includes('/'))add(await db.doc(`users/${uid}`).get());
 }else{
  (await db.collection('users').where('role','in',collection==='office_chats'?['admin','vip']:['crew']).get()).docs.forEach(add);
  if(typeof after.residentId==='string'&&after.residentId&&!after.residentId.includes('/'))add(await db.doc(`users/${after.residentId}`).get());
 }
 for(const recipient of recipients(collection,after,[...profiles.values()],sender.id)){
  if(await blocked(db,sender.id,recipient.id))continue;
  const devices=await db.collection('notification_devices').where('uid','==',recipient.id).get();
  for(const device of devices.docs){
   const claim=db.doc(`notification_deliveries/${hash(`${collection}/${event.params.chatId}/${message.id}/${recipient.id}/${device.id}`)}`);
   const current=await db.runTransaction(async tx=>{
    const [sent,dev,profile,liveChat,liveSender]=await Promise.all([tx.get(claim),tx.get(device.ref),tx.get(db.doc(`users/${recipient.id}`)),tx.get(db.doc(`${collection}/${event.params.chatId}`)),tx.get(db.doc(`users/${sender.id}`))]);
    const d=dev.data(),chat=liveChat.data();
    if(sent.exists||!chat||!d||d.uid!==recipient.id||d.enabled!==true||!validToken(d.token)||millis(d.expiresAt)<=now||
     !member(collection,chat,{...profile.data(),id:recipient.id})||!member(collection,chat,{...liveSender.data(),id:sender.id})||await blocked(db,sender.id,recipient.id,tx))return null;
    tx.create(claim,{kind:'inbox',state:'sending',createdAt:new Date(now),expiresAt:new Date(now+days),deviceId:device.id,uid:recipient.id,capability:d.capability});return d;
   });
   if(!current)continue;
   // Identity revocation and preference/ownership changes are rechecked before transport.
   const latest=(await device.ref.get()).data();
   if(!latest||latest.uid!==recipient.id||latest.capability!==current.capability||latest.enabled!==true||!await activeIdentity(identity,recipient.id,current)||await blocked(db,sender.id,recipient.id)){
    await claim.update({state:'suppressed'});continue;
   }
   try{
    const result=(await transport('send',{to:current.token,title:'TownLoop',body:'You have a new Inbox message.',
     sound:'default',channelId:'inbox',ttl:3600,data:{type:'inbox',category:collections[collection],conversationId:event.params.chatId,deviceBinding:hash(`${current.capability}/${recipient.id}`)}})).data;
    await claim.update({state:result?.status==='ok'?'accepted':'rejected',ticketId:result?.id||'',error:safeCode(result?.details?.error),checkedAt:new Date(now)});
    if(result?.details?.error==='DeviceNotRegistered')await removeInvalidDevice(db,device.ref,recipient.id,current.capability);
   }catch{await claim.update({state:'unknown',checkedAt:new Date(now)});}
   // Ambiguous send failures are deliberately not resent: Expo cannot guarantee exactly-once delivery.
  }
 }
}
function safeCode(code){return ['DeviceNotRegistered','MessageTooBig','MessageRateExceeded','MismatchSenderId','InvalidCredentials'].includes(code)?code:'';}
async function checkReceipts(db,{now=Date.now(),transport}={}){
 const pending=await db.collection('notification_deliveries').where('state','==','accepted').limit(100).get();
 const docs=pending.docs.filter(d=>d.data().kind==='inbox'&&d.data().ticketId);if(!docs.length)return;
 const receipts=(await transport('getReceipts',{ids:docs.map(d=>d.data().ticketId)})).data||{};
 for(const doc of docs){const d=doc.data(),r=receipts[d.ticketId];if(!r&&now-millis(d.createdAt)<86400000)continue;
  await doc.ref.update({state:r?.status==='ok'?'delivered':r?'rejected':'receipt-expired',error:safeCode(r?.details?.error),checkedAt:new Date(now)});
  if(r?.details?.error==='DeviceNotRegistered')await removeInvalidDevice(db,db.doc(`notification_devices/${d.deviceId}`),d.uid,d.capability);
 }
}
module.exports={registerDevice,deliver,checkReceipts};
