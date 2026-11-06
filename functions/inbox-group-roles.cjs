const { assertReferenceWritesAllowed } = require('./referenceWriteBarrier.cjs');
const { memberPath, hash, memberAllowed } = require('./inbox-groups.cjs');
const { approved } = require('./inbox-policy.cjs');
const {grace}=require('./inbox-retention.cjs');
// Trusted role-change event; no client chooses the loss timestamp or target UID.
async function revokeChangedMemberships(db, uid, before, after, changedAt) {
  const eligible=(p,type)=>approved(p)&&(type==='office'?['admin','vip'].includes(p.role):p.role==='crew');
  const affected=['office','maintenance'].filter(type=>eligible(before,type)&&!eligible(after,type));
  const accountRevoked=approved(before)&&!approved(after);
  if(!affected.length&&!accountRevoked)return;
  const list=await db.collection('inbox_memberships').where('uid','==',uid).where('status','==','active').get();
  if(list.docs.length>500)throw Error('membership_revocation_page_required');
  for(const source of list.docs)await db.runTransaction(async tx=>{
  await assertReferenceWritesAllowed(tx, db);
    const m=(await tx.get(source.ref)).data();
    if(!m||m.status!=='active'||m.joinedAt>changedAt||!accountRevoked&&(!affected.includes(m.type)||m.residentId===uid))return;
    const root=db.doc(`inbox_conversations/${m.conversationId}`),c=(await tx.get(root)).data();if(!c||c.status==='cleanup_in_progress')return;
    const members=await Promise.all(c.memberIds.map(id=>tx.get(db.doc(memberPath(c.id,id)))));
    const profiles=await Promise.all(c.memberIds.map(id=>tx.get(db.doc(`users/${id}`))));
    const remaining=members.map(s=>s.data()).filter((member,i)=>member.uid!==uid&&memberAllowed(c,member,profiles[i].data()));
    const sequence=c.sequence+1,id=`revoke_${hash(`${uid}/${m.epoch}`)}`;
    tx.create(db.doc(`inbox_conversations/${c.id}/messages/${id}`),{id,type:'leave',isSystem:true,actorId:uid,senderId:'system',senderName:'System',senderRole:'system',senderAvatar:'',body:`${String(before.name||'Resident').slice(0,100)} left the conversation.`,createdAt:changedAt,sequence,visibility:remaining.map(m=>`${m.uid}:${m.epoch}`),notify:false});
    tx.update(source.ref,{status:'left',reason:'role_revoked',leftAt:changedAt});
    const status=!remaining.length?'cleanup_pending':c.status==='archived'?'archived':c.type==='private'?'read_only':'open';
    const retention=!remaining.length?grace('last_member_left',changedAt,c.lastMessageAt??null,c.status):c.status==='archived'&&c.type==='private'?{...c.retention,previousStatus:'read_only'}:c.retention||null;
    tx.update(root,{sequence,status,retention,updatedAt:changedAt});
    for(const member of remaining)tx.update(db.doc(memberPath(c.id,member.uid)),{sequence,lastVisibleSequence:sequence,activeCount:remaining.length,conversationStatus:status,updatedAt:changedAt,
      archived:status==='archived',deleteAfter:retention?.deleteAfter||null,retentionReason:retention?.reason||null,inactivityResumable:status==='archived'&&retention?.previousStatus==='open'});
    // Queueing does not activate a worker or grant deletion authorization.
    if(!remaining.length)tx.set(db.doc(`inbox_cleanup_requests/${c.id}`),{conversationId:c.id,status:'awaiting_separate_approval',requestedAt:changedAt,deleteAfter:retention.deleteAfter,reason:'last_member_left',schemaVersion:2});
  });
}
module.exports={revokeChangedMemberships};
