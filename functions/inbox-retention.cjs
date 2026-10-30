// Default-database Inbox only. No SDK initialization, exports or automatic activation.
const DAY_MS=86400000, GRACE_MS=30*DAY_MS;
function addCalendarMonths(time,months){
 const date=new Date(time),day=date.getUTCDate();date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()+months);
 const end=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();
 date.setUTCDate(Math.min(day,end));return date.getTime();
}
function grace(reason,now,lastMessageAt,previousStatus){
 return {version:1,reason,startedAt:now,deleteAfter:now+GRACE_MS,lastMessageAt,previousStatus};
}
function membershipComplete(c,rows){
 const {memberPath}=require('./inbox-groups.cjs');
 return c?.schemaVersion===3&&['private','office','maintenance'].includes(c.type)&&
  Array.isArray(c.memberIds)&&c.memberIds.length>=2&&c.memberIds.length<=50&&new Set(c.memberIds).size===c.memberIds.length&&
  rows.length===c.memberIds.length&&c.memberIds.every(uid=>{
   const path=memberPath(c.id,uid),r=rows.find(s=>s.ref.path===path),m=r?.data();
   return m?.uid===uid&&m.conversationId===c.id&&['active','left'].includes(m.status)&&
    c.memberRefs?.[uid]===path.split('/')[1];
  });
}
function validGrace(r,now){
 return r?.version===1&&['inactivity','last_member_left'].includes(r.reason)&&
  Number.isFinite(r.startedAt)&&r.startedAt<=now&&Number.isFinite(r.deleteAfter)&&r.deleteAfter===r.startedAt+GRACE_MS;
}
async function assessConversation(db,cid,{now=Date.now()}={}){
 const {writeProjection}=require('./inbox-groups.cjs');
 return db.runTransaction(async tx=>{
  const root=db.doc(`inbox_conversations/${cid}`),c=(await tx.get(root)).data();
  if(!c)return{state:'not-found'};
  if(c.status==='cleanup_in_progress')return{state:'processing'};
  const rows=await tx.get(db.collection('inbox_memberships').where('conversationId','==',cid).limit(51));
  const queue=db.doc(`inbox_cleanup_requests/${cid}`),prior=(await tx.get(queue)).data();
  function review(reason){if(prior?.status!=='needs_review'||prior.reason!==reason)tx.set(queue,{conversationId:cid,status:'needs_review',reason,updatedAt:now});return{state:'needs_review',reason};}
  if(!membershipComplete(c,rows.docs))return review('authoritative_membership_required');
  if(c.legacySource&&!c.legacyVerified)return review('legacy_ownership_review_required');
  if(!['open','read_only','archived','cleanup_pending'].includes(c.status))return review('unsupported_lifecycle');
  if(prior?.status==='needs_review')return{state:'needs_review',reason:prior.reason};
  const newest=await tx.get(db.collection(`inbox_conversations/${cid}/messages`).where('type','==','message').orderBy('createdAt','desc').limit(1));
  const last=newest.docs.length?newest.docs[0].data().createdAt:c.createdAt;
  if(!Number.isFinite(last)||last>now)return review('message_timestamp_review_required');
  const members=c.memberIds.map(uid=>rows.docs.find(s=>s.data().uid===uid).data());
  const profiles=await Promise.all(c.memberIds.map(async id=>({... (await tx.get(db.doc(`users/${id}`))).data(),id})));
  const empty=members.every(m=>m.status==='left');
  let r=c.retention;const originalStatus=c.status;
  if(!empty&&c.status==='cleanup_pending')return review('active_membership_conflict');
  if(empty){
   if(!validGrace(r,now)||r.reason!=='last_member_left')r=grace('last_member_left',now,last,c.status);
   c.status='cleanup_pending';
  }else{
   if(r&&!validGrace(r,now))return review('retention_metadata_review_required');
   if(c.status==='archived'&&(!validGrace(r,now)||r.reason!=='inactivity'))return review('retention_metadata_review_required');
   if(c.status==='archived'&&r.lastMessageAt!==last)return review('activity_changed');
   if(addCalendarMonths(last,6)>now)return{state:'active'};
   if(!r)r=grace('inactivity',now,last,c.status);
   if(r.reason!=='inactivity'||r.lastMessageAt!==last)return review('activity_changed');
   c.status='archived';
  }
  if(originalStatus===c.status&&c.retention&&JSON.stringify(c.retention)===JSON.stringify(r)&&c.lastMessageAt===last&&
   (empty&&c.status==='cleanup_pending'||!empty&&c.status==='archived'))return{state:r.deleteAfter<=now?'due':empty?'grace':'archived',deleteAfter:r.deleteAfter};
  c.retention=r;c.lastMessageAt=last;
  tx.set(root,c);
  writeProjection(tx,db,cid,c,members,profiles,now);
  // Never grants deletion authorization. Existing holds/manifests are checked by the separate runner.
  tx.set(queue,{conversationId:cid,status:prior?.status==='retry_required'?'retry_required':'awaiting_separate_approval',
   ...(prior?.status==='retry_required'?{nextAttemptAt:prior.nextAttemptAt}:{}),reason:r.reason,requestedAt:r.startedAt,deleteAfter:r.deleteAfter,schemaVersion:2});
  return{state:r.deleteAfter<=now?'due':empty?'grace':'archived',deleteAfter:r.deleteAfter};
 });
}
module.exports={GRACE_MS,addCalendarMonths,grace,validGrace,membershipComplete,assessConversation};
