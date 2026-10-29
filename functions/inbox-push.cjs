// Trusted backend only. No message content is persisted in delivery records or payloads.
const {createHash}=require('node:crypto');
const {collections,approved,member,appendedMessage,recipients}=require('./inbox-policy.cjs');
const {contentEvent,channelFor,preferences,id,recent}=require('./notification-events.cjs');
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
   preferences:preferences(data.preferences),inboxGroupProtocol:data.inboxGroupProtocol===3?3:0,authTime,updatedAt:new Date(now),expiresAt:new Date(now+days)});
 });
 return {registered:!data.remove,protocolVersion:2,discussionReplies:process.env.DISCUSSION_REPLIES_ENABLED==='true'};
}
async function removeInvalidDevice(db,ref,uid,cap){await db.runTransaction(async tx=>{const d=(await tx.get(ref)).data();if(d?.uid===uid&&d.capability===cap)tx.delete(ref);});}
const activeIdentity=async(identity,uid,device)=>{
 try{const user=await identity(uid);return !user.disabled&&(!device||device.authTime*1000>=Date.parse(user.tokensValidAfterTime||'1970-01-01'));}catch{return false;}
};
async function blocked(db,a,b,tx){const get=r=>tx?tx.get(r):r.get();return (await Promise.all([get(db.doc(`user_blocks/${a}/targets/${b}`)),get(db.doc(`user_blocks/${b}/targets/${a}`))])).some(s=>s.exists);}
const prefCategory=category=>channelFor(category);
const noticeKey=(descriptor,uid)=>hash(`${descriptor.collection}/${descriptor.documentId}/${descriptor.eventId}/${uid}`);
const targetKey=d=>`${d.collection}/${d.documentId}`;
const readKey=(uid,target)=>hash(`${uid}/${target}`);
async function notificationCounts(db,uid,now=Date.now()){
 const result={};
 for(const category of ['inbox','marketplace','discussion','workorders']){
  const aggregate=await db.collection('notification_events').where('uid','==',uid).where('category','==',category)
   .where('seen','==',false).where('expiresAt','>',new Date(now)).count().get();
  result[category]=aggregate.data().count;
 }
 return result;
}
async function sendEvent(db,d,{now,identity,transport,verify,recipientAllowed=()=>true,deviceAllowed=()=>true,trace=()=>{}}){
 if(!await activeIdentity(identity,d.senderId)){trace('sender_identity_inactive');return;}
 if(!d.recipientIds.length)trace('no_recipients');
 for(const uid of [...new Set(d.recipientIds)].filter(v=>id(v)&&v!==d.senderId)){
  if(!recipientAllowed(uid)){trace('recipient_excluded');continue;}
  if(await blocked(db,d.senderId,uid)){trace('blocked');continue;}
  const devices=await db.collection('notification_devices').where('uid','==',uid).get();
  if(!devices.docs.length)trace('no_registered_devices');
  for(const device of devices.docs){
   const notice=db.doc(`notification_events/${noticeKey(d,uid)}`);
   const claim=db.doc(`notification_deliveries/${hash(`${notice.id}/${device.id}`)}`);
   const current=await db.runTransaction(async tx=>{
    const [sent,dev,event,profile,read]=await Promise.all([tx.get(claim),tx.get(device.ref),tx.get(notice),tx.get(db.doc(`users/${uid}`)),tx.get(db.doc(`notification_reads/${readKey(uid,targetKey(d))}`))]);
    const token=dev.data();
    if(d.collection!=='inbox_conversations'&&millis(read.data()?.until)>=d.eventTime||sent.exists||event.data()?.seen===true||!token||!deviceAllowed(token)||token.uid!==uid||token.enabled!==true||
     preferences(token.preferences)[prefCategory(d.category)]!==true||!validToken(token.token)||millis(token.expiresAt)<=now||
     !approved(profile.data())||!await verify(tx,uid)||await blocked(db,d.senderId,uid,tx))return null;
    if(!event.exists)tx.create(notice,{...(d.collection==='inbox_conversations'?{sequence:d.sequence}:{}),uid,category:prefCategory(d.category),target:targetKey(d),senderId:d.senderId,destination:{category:d.category,conversationId:d.documentId,...(d.commentId?{commentId:d.commentId}:{})},seen:false,createdAt:new Date(d.eventTime),expiresAt:new Date(d.eventTime+days)});
    tx.create(claim,{...(d.collection==='inbox_conversations'?{target:targetKey(d),noticeId:notice.id}:{}),kind:'inbox',state:'sending',createdAt:new Date(now),expiresAt:new Date(now+days),deviceId:device.id,uid,capability:token.capability});return token;
   });
   if(!current){trace('device_or_recipient_ineligible');continue;}
   const latest=(await device.ref.get()).data(),latestRead=(await db.doc(`notification_reads/${readKey(uid,targetKey(d))}`).get()).data();
   if(d.collection!=='inbox_conversations'&&millis(latestRead?.until)>=d.eventTime||!latest||!deviceAllowed(latest)||latest.uid!==uid||latest.capability!==current.capability||latest.enabled!==true||preferences(latest.preferences)[prefCategory(d.category)]!==true||
    !await activeIdentity(identity,uid,current)||await blocked(db,d.senderId,uid)||
    d.collection==='inbox_conversations'&&!await db.runTransaction(tx=>verify(tx,uid))){
    await claim.update({state:'suppressed'});trace('authorization_changed');continue;
   }
   try{
    const counts=await notificationCounts(db,uid,now);
    const badge=Object.entries(counts).reduce((sum,[category,count])=>sum+(preferences(latest.preferences)[category]?count:0),0);
    const result=(await transport('send',{to:current.token,title:'TownLoop',body:d.body,
     sound:'default',channelId:channelFor(d.category),badge,ttl:3600,data:{type:'notice',category:d.category,noticeId:notice.id,deviceBinding:hash(`${current.capability}/${uid}`)}})).data;
    await claim.update({state:result?.status==='ok'?'accepted':'rejected',ticketId:result?.id||'',error:safeCode(result?.details?.error),checkedAt:new Date(now)});
    trace(result?.status==='ok'?'transport_accepted':'transport_rejected');
    if(result?.details?.error==='DeviceNotRegistered')await removeInvalidDevice(db,device.ref,uid,current.capability);
   }catch{await claim.update({state:'unknown',checkedAt:new Date(now)});trace('transport_unknown');}
   // Ambiguous transport outcomes are never blindly resent.
  }
 }
}
async function deliver(db,event,collection,{now=Date.now(),identity,transport,recipientAllowed,deviceAllowed,trace=()=>{}}={}){
 const after=event.data?.after.data();
 if(!id(event.authId)){trace('principal_missing');return;}
 if(!after||['system','unauthenticated','service_account'].includes(event.authType)||!collections[collection]||!recent(event,now)){trace('event_ineligible');return;}
 const sender={...(await db.doc(`users/${event.authId}`).get()).data(),id:event.authId};
 if(!member(collection,after,sender)){trace('sender_not_authorized');return;}
 const message=appendedMessage(event.data.before.data(),after,sender);if(!message){trace('not_new_message');return;}
 const profiles=new Map(),add=s=>{if(s.exists)profiles.set(s.id,{...s.data(),id:s.id});};
 if(['resident_chats','marketplace_chats'].includes(collection)){
  for(const uid of (after.participantIds||[]).slice(0,2))if(id(uid))add(await db.doc(`users/${uid}`).get());
 }else{
  (await db.collection('users').where('role','in',collection==='office_chats'?['admin','vip']:['crew']).get()).docs.forEach(add);
  if(id(after.residentId))add(await db.doc(`users/${after.residentId}`).get());
 }
 const descriptor={category:collections[collection],collection,documentId:event.params.chatId,eventId:message.id,eventTime:Date.parse(event.time),senderId:sender.id,
  recipientIds:recipients(collection,after,[...profiles.values()],sender.id).map(p=>p.id),body:collection==='marketplace_chats'?'You have a new Marketplace message.':'You have a new Inbox message.'};
 await sendEvent(db,descriptor,{now,identity,transport,recipientAllowed,deviceAllowed,trace,verify:async(tx,uid)=>{
  const [chat,recipient,currentSender]=await Promise.all([tx.get(db.doc(`${collection}/${descriptor.documentId}`)),tx.get(db.doc(`users/${uid}`)),tx.get(db.doc(`users/${sender.id}`))]);
  const data=chat.data();if(!data)return false;
  if(Number.isInteger(data.readBy?.[uid])&&data.readBy[uid]>=after.messages.length)return false;
  if(collection==='marketplace_chats'&&data[uid===data.sellerId?'unreadForSeller':'unreadForBuyer']===false)return false;
  return chat.exists&&member(collection,chat.data(),{...recipient.data(),id:uid})&&member(collection,chat.data(),{...currentSender.data(),id:sender.id});
 }});
}
async function deliverContent(db,event,collection,{now=Date.now(),identity,transport,recipientAllowed,deviceAllowed,trace=()=>{}}={}){
 if(!id(event.authId)){trace('principal_missing');return;}
 const sender={...(await db.doc(`users/${event.authId}`).get()).data(),id:event.authId};
 const descriptor=contentEvent(event,collection,sender,now);if(!descriptor){trace('not_eligible_content_transition');return;}descriptor.eventTime=Date.parse(event.time);
 await sendEvent(db,descriptor,{now,identity,transport,recipientAllowed,deviceAllowed,trace,verify:async(tx,uid)=>{
  const [record,currentSender]=await Promise.all([tx.get(db.doc(`${collection}/${descriptor.documentId}`)),tx.get(db.doc(`users/${sender.id}`))]);
  const live=record.data();if(!live||!approved(currentSender.data()))return false;
  if(collection==='work_orders')return live.userId===uid&&live.status==='Done';
  return live.storageDraft===false&&live.userId===event.data.after.data().userId&&live.comments?.some(c=>c.id===descriptor.commentId&&c.authorId===sender.id)&&
   (live.userId===uid||live.comments.some(c=>String(c.id)===event.data.after.data().comments.at(-1).replyToCommentId&&c.authorId===uid));
 }});
}
async function groupAccess(db,uid,conversation,profile){
 const {memberAllowed,memberPath}=require('./inbox-groups.cjs');
 const m=(await db.doc(memberPath(conversation.id,uid)).get()).data();
 return memberAllowed(conversation,m,profile);
}
async function notificationState(db,uid,data,{now=Date.now()}={}){
 if(!id(uid))error('unauthenticated');if(!approved((await db.doc(`users/${uid}`).get()).data()))error('permission-denied');
 if(data?.resolve){
  if(typeof data.resolve!=='string'||!/^[a-f0-9]{64}$/.test(data.resolve))error('invalid-argument');
  const notice=(await db.doc(`notification_events/${data.resolve}`).get()).data();
  if(!notice||notice.uid!==uid||millis(notice.expiresAt)<=now)error('permission-denied');
  const target=notice.destination;
  let collection={friend:'resident_chats',office:'office_chats',maintenance:'maintenance_chats',marketplace:'marketplace_chats',discussion:'discussion_feed',workorders:'work_orders'}[target?.category];
  if(/^v3_[a-f0-9]{64}$/.test(target?.conversationId||'')&&['friend','office','maintenance'].includes(target.category))collection='inbox_conversations';
  if(!collection||!id(target.conversationId))error('permission-denied');
  const profile=(await db.doc(`users/${uid}`).get()).data(),record=(await db.doc(`${collection}/${target.conversationId}`).get()).data();
  if(record?.groupConversationId){
   const c=(await db.doc(`inbox_conversations/${record.groupConversationId}`).get()).data();
   if(!c||!await groupAccess(db,uid,c,profile))error('permission-denied');
   target.conversationId=c.id;target.category=c.type==='private'?'friend':c.type;
  }
  const allowed=record&&(collection==='inbox_conversations'?await groupAccess(db,uid,record,profile):collections[collection]?member(collection,record,{...profile,id:uid}):collection==='work_orders'?record.userId===uid||['admin','vip','crew'].includes(profile.role):record.storageDraft===false);
  if(!allowed||id(notice.senderId)&&await blocked(db,notice.senderId,uid))error('permission-denied');
  return {protocolVersion:2,target};
 }
 let ackPending=false;
 if(data?.ack){
  const {category,conversationId}=data.ack;
  let collection={friend:'resident_chats',office:'office_chats',maintenance:'maintenance_chats',marketplace:'marketplace_chats',discussion:'discussion_feed',workorders:'work_orders'}[category];
  if(/^v3_[a-f0-9]{64}$/.test(conversationId||'')&&['friend','office','maintenance'].includes(category))collection='inbox_conversations';
  if(!collection||!id(conversationId))error('invalid-argument');
  const ref=db.doc(`${collection}/${conversationId}`),profile=(await db.doc(`users/${uid}`).get()).data(),record=await ref.get();
  if(record.exists){const allowed=collection==='inbox_conversations'?await groupAccess(db,uid,record.data(),profile):collections[collection]?member(collection,record.data(),{...profile,id:uid}):collection==='work_orders'?record.data().userId===uid||['admin','vip','crew'].includes(profile.role):record.data().storageDraft===false;if(!allowed)error('permission-denied');}
  // Missing/deleted targets can be dismissed; only this account's receipts are touched.
  const requested=Number(data.ack.readAt);
  let groupReadSequence=null;
  let until=Number.isFinite(requested)&&requested>0?Math.min(requested,now):now;
  if(collection==='inbox_conversations'){const {memberPath}=require('./inbox-groups.cjs');const m=(await db.doc(memberPath(conversationId,uid)).get()).data();until=Math.min(until,m?.readAt||0);groupReadSequence=m?.readSequence||0;}
  const readRef=db.doc(`notification_reads/${readKey(uid,`${collection}/${conversationId}`)}`);
  await db.runTransaction(async tx=>{const previous=(await tx.get(readRef)).data();tx.set(readRef,{uid,target:`${collection}/${conversationId}`,until:new Date(Math.max(until,millis(previous?.until)||0)),expiresAt:new Date(now+days)});});
  const base=db.collection('notification_events').where('uid','==',uid).where('target','==',`${collection}/${conversationId}`).where('seen','==',false);
  const query=(groupReadSequence===null?base.where('createdAt','<=',new Date(until)):base.where('sequence','<=',groupReadSequence)).limit(100);
  const notices=await query.get();
  await Promise.all(notices.docs.map(notice=>notice.ref.update({seen:true,seenAt:new Date(now)})));
  ackPending=notices.docs.length===100;
 }
 return {protocolVersion:2,ackPending,counts:await notificationCounts(db,uid,now)};
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
module.exports={registerDevice,deliver,deliverContent,notificationState,checkReceipts,sendEvent};
