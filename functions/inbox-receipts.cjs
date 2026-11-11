// Native Inbox only. Acknowledgments are independent of FCM and unread cursors.
const valid=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value);
const fail=code=>{throw Error(code);};
async function acknowledge(db,uid,cid,data,now){
 if(!['delivered','read'].includes(data.kind)||!Array.isArray(data.messageIds)||!data.messageIds.length||data.messageIds.length>50||data.messageIds.some(id=>!valid(id)))fail('invalid-argument');
 const {load,memberAllowed,memberPath,visibilityKey}=require('./inbox-groups.cjs');
 return db.runTransaction(async tx=>{
  const state=await load(tx,db,cid),index=state.conversation.memberIds.indexOf(uid),member=state.members[index];
  if(index<0||!memberAllowed(state.conversation,member,state.profiles[index]))fail('permission-denied');
  if(state.conversation.status==='cleanup_in_progress')fail('failed-precondition');
  const audience=visibilityKey(member),ids=[...new Set(data.messageIds)],rows=await Promise.all(ids.map(id=>tx.get(db.doc(`inbox_conversations/${cid}/messages/${id}`))));
  const updates=[];let delivered=member.deliveredSequence||0,read=member.readSequence||0,readAt=member.readAt||0;
  for(const row of rows){
   if(!row.exists)fail('not-found');const m=row.data();
   if(!m.visibility?.includes(audience))fail('permission-denied');
   if(!Number.isSafeInteger(m.sequence)||m.sequence<1||m.sequence>state.conversation.sequence)fail('failed-precondition');
   if(data.kind==='delivered')delivered=Math.max(delivered,m.sequence);
   if(data.kind==='read'){read=Math.max(read,m.sequence);readAt=Math.max(readAt,m.createdAt||0);}
   if(m.type!=='message'||m.isSystem||m.senderId===uid)continue;
   const receipts={...(m.receipts||{})},old=receipts[audience]||{};
   if(old.readAt||data.kind==='delivered'&&old.deliveredAt)continue;
   receipts[audience]={deliveredAt:old.deliveredAt||now,...(data.kind==='read'?{readAt:Math.max(old.deliveredAt||0,now)}:{})};
   // Immutable audience at send time. New joins do not count; departures cannot
   // turn a partial group receipt into an apparently unanimous receipt.
   const targets=m.visibility.filter(key=>!key.startsWith(m.senderId+':'));
   const receiptState=targets.length&&targets.every(key=>receipts[key]?.readAt)?'read':targets.length&&targets.every(key=>receipts[key]?.deliveredAt)?'delivered':'sent';
   updates.push([row.ref,{receipts,receiptState,receiptVersion:1}]);
  }
  for(const [ref,patch]of updates)tx.update(ref,patch);
  const patch={};if(delivered>(member.deliveredSequence||0))patch.deliveredSequence=delivered;
  if(read>(member.readSequence||0))patch.readSequence=read;if(readAt>(member.readAt||0))patch.readAt=readAt;
  if(Object.keys(patch).length)tx.update(db.doc(memberPath(cid,uid)),patch);
  return {acknowledged:ids,kind:data.kind};
 });
}
module.exports={acknowledge};
