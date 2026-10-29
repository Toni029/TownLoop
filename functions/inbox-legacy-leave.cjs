// Leaving is a per-UID revocation, not a grant of historical membership to anyone.
const {member}=require('./inbox-policy.cjs');
const {hash}=require('./inbox-groups.cjs');
const sources=new Set(['resident_chats','office_chats','maintenance_chats']);
async function leaveLegacy(db,uid,data,now){
 if(!sources.has(data.source)||typeof data.legacyId!=='string'||!data.legacyId||data.legacyId.includes('/')||Buffer.byteLength(data.legacyId)>1500||['.','..'].includes(data.legacyId))throw Error('invalid-argument');
 return db.runTransaction(async tx=>{
  const ref=db.doc(`${data.source}/${data.legacyId}`),snapshot=await tx.get(ref),old=snapshot.data();
  const actor={...(await tx.get(db.doc(`users/${uid}`))).data(),id:uid};
  if(!old||!member(data.source,old,actor,{allowLeft:true}))throw Error('permission-denied');
  if(old.groupConversationId)return {migrated:true}; // Route outside this transaction, reauthorizing there.
  if(old.leftBy?.[uid]===true)return{left:true,unchanged:true};
  if(!Array.isArray(old.messages)||old.leftBy!==undefined&&(!old.leftBy||typeof old.leftBy!=='object'||Array.isArray(old.leftBy)))throw Error('failed-precondition');
  const leftBy={...old.leftBy,[uid]:true},ids=new Set(old.messages.map(m=>m?.id));
  let eventId=`legacy_leave_${hash(`${data.source}/${data.legacyId}/${uid}/${now}`)}`;
  while(ids.has(eventId))eventId+='x';
  const event={id:eventId,type:'leave',isSystem:true,actorId:uid,senderId:'system',senderName:'System',senderRole:'system',body:`${String(actor.name||'Resident').slice(0,100)} left the conversation.`,createdAt:now,time:''};
  tx.update(ref,{leftBy,messages:[...old.messages,event],updatedAt:now,lastMessage:event.body});
  // Only exact private pairs establish that nobody remains. Never infer a final staff member.
  const final=data.source==='resident_chats'&&old.identityVersion===2&&Array.isArray(old.participantIds)&&old.participantIds.length===2&&new Set(old.participantIds).size===2&&old.participantIds.every(id=>typeof id==='string'&&leftBy[id]===true);
  if(final)tx.set(db.doc(`inbox_cleanup_requests/legacy_${hash(`${data.source}/${data.legacyId}`)}`),{kind:'legacy',legacySource:`${data.source}/${data.legacyId}`,status:'awaiting_separate_approval',requestedAt:now,schemaVersion:1});
  return{left:true,legacy:true,cleanupPending:final};
 }).then(result=>result.migrated?require('./inbox-group-legacy.cjs').upgradeLegacy(db,uid,data,now,{leave:true}):result);
}
module.exports={leaveLegacy};
