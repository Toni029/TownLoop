// Stage B preparation ONLY. Not imported/exported by any deployable entry point.
// Both an explicit code-level activation and an expiring, reviewed server manifest
// are required. No scheduler, recursive delete, or token revocation exists here.
const {randomUUID}=require('node:crypto');
const {approved}=require('./inbox-policy.cjs');
const {planConversationCleanup}=require('./inbox-group-cleanup.cjs');
async function runConversationCleanup(db,storage,cid,{enabled=false,now=Date.now()}={}){
 if(!enabled)return{state:'disabled'};
 if(typeof cid!=='string'||!/^v3_[a-f0-9]{64}$/.test(cid))throw Error('invalid-argument');
 const root=db.doc(`inbox_conversations/${cid}`),receipt=db.doc(`inbox_cleanup_requests/${cid}`),approvalRef=db.doc(`inbox_cleanup_authorizations/${cid}`);
 const claim=randomUUID();
 const result=await db.runTransaction(async tx=>{
  const [cSnap,aSnap,previous]=await Promise.all([tx.get(root),tx.get(approvalRef),tx.get(receipt)]);
  const c=cSnap.data(),approval=aSnap.data();
  if(!c)return{state:previous.data()?.status==='completed'?'completed':'not-found'};
  if(!['cleanup_pending','cleanup_in_progress'].includes(c.status))return{state:'held',reason:'conversation_active'};
  if(!approval||approval.status!=='approved'||!Number.isFinite(approval.expiresAt)||approval.expiresAt<=now||approval.sequence!==c.sequence||
    approval.membershipInventoryComplete!==true||approval.mediaReferenceInventoryComplete!==true||approval.evidenceReviewComplete!==true)return{state:'held',reason:'reviewed_inventory_required'};
  const reviewer=(await tx.get(db.doc(`users/${approval.approvedBy}`))).data();
  if(!approved(reviewer)||reviewer.role!=='admin')return{state:'held',reason:'authorized_reviewer_required'};
  const members=await tx.get(db.collection('inbox_memberships').where('conversationId','==',cid));
  if(members.docs.some(s=>s.data().status==='active')||members.docs.length!==c.memberIds.length)return{state:'held',reason:'membership_incomplete'};
  const holds=await tx.get(db.collection('inbox_retention_holds').where('conversationId','==',cid));
  if(holds.docs.some(s=>!s.data().expiryApproved||!Number.isFinite(s.data().expiresAt)||s.data().expiresAt>now))return{state:'held',reason:'reported_or_retained_evidence'};
  const inventory=await tx.get(db.collection('inbox_media_references').where('conversationId','==',cid));
  const attachments=inventory.docs.map(s=>s.data());
  const plan=planConversationCleanup({conversation:{...c,status:'cleanup_pending'},members:members.docs.map(s=>s.data()),messages:[],attachments,now});
  if(plan.holds.length)return{state:'held',reason:plan.holds.join(',')};
  for(const file of attachments)if(!file.path?.startsWith(`inbox_groups/${cid}/`)||file.path.includes('..')||!file.messageId||!file.storageGeneration)return{state:'held',reason:'verified_media_metadata_required'};
  // Existing record archives are removed only with a separately verified source hash.
  let source;
  if(c.legacySource){
   if(!/^(resident_chats|office_chats|maintenance_chats)\/[A-Za-z0-9_-]{1,128}$/.test(c.legacySource)||approval.legacySourceApproved!==true)return{state:'held',reason:'legacy_review_required'};
   source=await tx.get(db.doc(c.legacySource));
   const {hash}=require('./inbox-groups.cjs');
   if(source.exists&&(source.data().groupConversationId!==cid||approval.legacySourceHash!==hash(JSON.stringify(source.data()))))return{state:'held',reason:'legacy_source_changed'};
  }
  if(c.cleanupLeaseUntil>now)return{state:'busy'};
  tx.update(root,{status:'cleanup_in_progress',cleanupClaim:claim,cleanupLeaseUntil:now+60000});
  tx.set(receipt,{conversationId:cid,status:'processing',claim,startedAt:now,expiresAt:now+60*86400000});
  return{state:'claimed',conversation:c,attachments};
 });
 if(result.state!=='claimed')return result;
 async function guard(){
  await db.runTransaction(async tx=>{
   const [c,a]=await Promise.all([tx.get(root),tx.get(approvalRef)]);
   if(c.data()?.cleanupClaim!==claim||a.data()?.status!=='approved'||!Number.isFinite(a.data().expiresAt)||a.data().expiresAt<=Date.now())throw Error('cleanup_approval_or_claim_changed');
   tx.update(root,{cleanupLeaseUntil:Date.now()+60000});
  });
 }
 async function removeQuery(query){
  for(let page=0;page<100;page++){
   const rows=await query.limit(100).get();if(!rows.docs.length)return;
   await guard();await Promise.all(rows.docs.map(s=>s.ref.delete()));
  }
  throw Error('cleanup_page_limit_resume_required');
 }
 try{
  for(const item of result.attachments){
   await guard();const file=storage.file(item.path);
   try{
    const [meta]=await file.getMetadata();
    if(meta.generation!==String(item.storageGeneration)||meta.metadata?.conversationId!==cid||meta.metadata?.messageId!==item.messageId||meta.metadata?.verifiedExclusive!=='true')throw Error('media_changed_review_required');
    await file.delete({ifGenerationMatch:item.storageGeneration});
   }catch(e){if(e.code!==404)throw e;}
  }
  await removeQuery(db.collection(`inbox_conversations/${cid}/messages`));
  for(const target of [`inbox_conversations/${cid}`,...(result.conversation.legacySource?[result.conversation.legacySource]:[])]){
   for(const name of ['notification_events','notification_reads','notification_deliveries'])await removeQuery(db.collection(name).where('target','==',target));
  }
  await removeQuery(db.collection('inbox_media_references').where('conversationId','==',cid));
  // The archive stays fenced until it is removed; no ordinary client can change it.
  if(result.conversation.legacySource){await guard();await db.doc(result.conversation.legacySource).delete();}
  await db.runTransaction(async tx=>{
   const c=(await tx.get(root)).data();if(c?.cleanupClaim!==claim)throw Error('cleanup_claim_changed');
   const members=await tx.get(db.collection('inbox_memberships').where('conversationId','==',cid));
   if(members.docs.some(s=>s.data().status==='active'))throw Error('cleanup_claim_changed');
   for(const member of members.docs)tx.delete(member.ref);
   tx.delete(root);tx.delete(approvalRef);tx.set(receipt,{status:'completed',completedAt:Date.now(),expiresAt:Date.now()+60*86400000});
  });
  return{state:'completed'};
 }catch(error){
  // Leave a resumable, content-free failure state. No personal data/URLs in receipts.
  await receipt.update({status:'retry_or_review_required',errorCode:['media_changed_review_required','cleanup_approval_or_claim_changed','cleanup_page_limit_resume_required'].includes(error.message)?error.message:'cleanup_failed'});
  throw error;
 }
}
module.exports={runConversationCleanup};
