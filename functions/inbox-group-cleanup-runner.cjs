// Prepared Stage B only. Not exported by the live Firebase entry point.
// The grace period, expiring Admin review, exact inventory and exclusive lease are ALL mandatory.
const {randomUUID}=require('node:crypto');
const {approved}=require('./inbox-policy.cjs');
const {hash}=require('./inbox-groups.cjs');
const {validGrace,membershipComplete,addCalendarMonths}=require('./inbox-retention.cjs');
const {planConversationCleanup}=require('./inbox-group-cleanup.cjs');
async function readCleanupInventory(db,tx,cid){
 const [members,media,holds,reports]=await Promise.all([
  tx.get(db.collection('inbox_memberships').where('conversationId','==',cid).limit(51)),
  tx.get(db.collection('inbox_media_references').where('conversationId','==',cid).limit(201)),
  tx.get(db.collection('inbox_retention_holds').where('conversationId','==',cid).limit(101)),
  tx.get(db.collection('moderation_reports').where('collection','==','inbox_conversations').where('id','==',cid).limit(1)),
 ]);
 const digest=rows=>rows.map(s=>[s.ref.path,s.data()]).sort((a,b)=>a[0].localeCompare(b[0]));
 // Read cursors are not ownership and may safely advance without invalidating a review.
 const memberDigest=members.docs.map(s=>[s.ref.path,...['uid','status','epoch','joinedAt','leftAt','reason'].map(k=>s.data()[k]??null)]).sort((a,b)=>a[0].localeCompare(b[0]));
 return{members:members.docs,media:media.docs,holds:holds.docs,reports:reports.docs,
  hash:hash(JSON.stringify([memberDigest,digest(media.docs),digest(holds.docs)])),
  bounded:members.docs.length<51&&media.docs.length<201&&holds.docs.length<101};
}
async function runConversationCleanup(db,storage,cid,{enabled=false,now=Date.now(),clock=()=>Date.now(),maxPages=20}={}){
 if(!enabled)return{state:'disabled'};
 if(typeof cid!=='string'||!/^v3_[a-f0-9]{64}$/.test(cid))throw Error('invalid-argument');
 const root=db.doc(`inbox_conversations/${cid}`),receipt=db.doc(`inbox_cleanup_requests/${cid}`),approvalRef=db.doc(`inbox_cleanup_authorizations/${cid}`),claim=randomUUID();
 if((await root.listCollections()).some(c=>c.id!=='messages'))return{state:'held',reason:'unknown_subcollection'};
 let inventoryHash,sequence,retentionJSON,sourcePath,sourceHash;
 // Metadata only; never download attachments or infer ownership from a folder name.
 if(!storage?.getFiles)return{state:'held',reason:'storage_inventory_required'};
 const [objects,nextPage]=await storage.getFiles({prefix:`inbox_groups/${cid}/`,autoPaginate:false,maxResults:201});
 if(nextPage||objects.length>200)return{state:'held',reason:'storage_inventory_incomplete'};
 async function validate(tx,time,claimRequired){
  const [cSnap,aSnap,previous]=await Promise.all([tx.get(root),tx.get(approvalRef),tx.get(receipt)]);
  const c=cSnap.data(),a=aSnap.data();
  if(!c)return{state:previous.data()?.status==='completed'?'completed':'not-found'};
  if(!['cleanup_pending','archived','cleanup_in_progress'].includes(c.status)||!validGrace(c.retention,time)||c.retention.deleteAfter>time)return{state:'held',reason:'grace_period_or_lifecycle'};
  if(c.retention.reason==='inactivity'&&(!Number.isFinite(c.retention.lastMessageAt)||c.lastMessageAt!==c.retention.lastMessageAt||
   addCalendarMonths(c.retention.lastMessageAt,6)>c.retention.startedAt||!['open','read_only'].includes(c.retention.previousStatus)))return{state:'held',reason:'inactivity_boundary_changed'};
  if(claimRequired&&(c.cleanupClaim!==claim||c.sequence!==sequence||JSON.stringify(c.retention)!==retentionJSON))return{state:'held',reason:'claim_or_activity_changed'};
  if(!a||a.status!=='approved'||!Number.isFinite(a.expiresAt)||a.expiresAt<=time||a.sequence!==c.sequence||a.membershipInventoryComplete!==true||a.mediaReferenceInventoryComplete!==true||a.evidenceReviewComplete!==true)return{state:'held',reason:'reviewed_inventory_required'};
  const reviewer=(await tx.get(db.doc(`users/${a.approvedBy}`))).data();
  if(!approved(reviewer)||reviewer.role!=='admin')return{state:'held',reason:'authorized_reviewer_required'};
  const inv=await readCleanupInventory(db,tx,cid);
  if(!inv.bounded||!membershipComplete(c,inv.members))return{state:'held',reason:'membership_or_inventory_incomplete'};
  if(a.inventoryHash!==inv.hash||claimRequired&&inv.hash!==inventoryHash)return{state:'held',reason:'inventory_changed_review_required'};
  if(inv.reports.length||inv.holds.some(s=>!s.data().basis||!s.data().expiryApproved||!Number.isFinite(s.data().expiresAt)||s.data().expiresAt>time))return{state:'held',reason:'reported_or_retained_evidence'};
  const attachments=inv.media.map(s=>s.data());
  if(objects.some(o=>!attachments.some(f=>f.path===o.name)))return{state:'held',reason:'unresolved_storage_object'};
  const plan=planConversationCleanup({conversation:{...c,status:c.retention.reason==='inactivity'?'archived':'cleanup_pending'},members:inv.members.map(s=>s.data()),messages:[],attachments,now:time});
  if(plan.holds.length)return{state:'held',reason:plan.holds.join(',')};
  for(const f of attachments)if(!f.path?.startsWith(`inbox_groups/${cid}/${f.messageId}/`)||f.path.includes('..')||!f.messageId||!/^\d+$/.test(String(f.storageGeneration)))return{state:'held',reason:'verified_media_metadata_required'};
  for(const record of inv.media){
   const shared=await tx.get(db.collection('inbox_media_references').where('path','==',record.data().path).limit(2));
   if(shared.docs.length!==1||shared.docs[0].ref.path!==record.ref.path)return{state:'held',reason:'shared_media_reference'};
  }
  if(c.legacySource){
   if(!/^(resident_chats|office_chats|maintenance_chats)\/[A-Za-z0-9_-]{1,128}$/.test(c.legacySource)||a.legacySourceApproved!==true)return{state:'held',reason:'legacy_review_required'};
   const source=await tx.get(db.doc(c.legacySource));
   if(source.exists&&(source.data().groupConversationId!==cid||a.legacySourceHash!==hash(JSON.stringify(source.data()))))return{state:'held',reason:'legacy_source_changed'};
   const [reports,legacyHolds]=await Promise.all([
    tx.get(db.collection('moderation_reports').where('collection','==',c.legacySource.split('/')[0]).where('id','==',c.legacySource.split('/')[1]).limit(1)),
    tx.get(db.collection('inbox_retention_holds').where('legacySource','==',c.legacySource).limit(1)),
   ]);
   if(reports.docs.length||legacyHolds.docs.length)return{state:'held',reason:'legacy_reported_evidence'};
   if(claimRequired&&(c.legacySource!==sourcePath||a.legacySourceHash!==sourceHash))return{state:'held',reason:'legacy_source_changed'};
  }
  return{state:'eligible',conversation:c,inventory:inv,attachments};
 }
 const result=await db.runTransaction(async tx=>{
  const v=await validate(tx,now,false);if(v.state!=='eligible')return v;
  const c=v.conversation;if(c.cleanupLeaseUntil>now)return{state:'busy'};
  inventoryHash=v.inventory.hash;sequence=c.sequence;retentionJSON=JSON.stringify(c.retention);sourcePath=c.legacySource;
  if(sourcePath)sourceHash=(await tx.get(approvalRef)).data().legacySourceHash;
  tx.update(root,{status:'cleanup_in_progress',cleanupClaim:claim,cleanupLeaseUntil:now+60000});
  tx.set(receipt,{conversationId:cid,status:'processing',claim,startedAt:now,deleteAfter:c.retention.deleteAfter,expiresAt:now+60*86400000});
  return v;
 });
 if(result.state!=='eligible')return result;
 async function guard(tx){
  const v=await validate(tx,clock(),true);
  if(v.state!=='eligible')throw Error(v.reason||'cleanup_claim_changed');
  return v;
 }
 async function removeQuery(query,{messages=false}={}){
  for(let page=0;page<maxPages;page++){
   const empty=await db.runTransaction(async tx=>{
    await guard(tx);const rows=await tx.get(query.limit(100));
    if(!rows.docs.length)return true;
    if(messages)for(const row of rows.docs){
     const m=row.data();
     // Unknown legacy media is never silently removed with a message document.
     if(m.url||m.photoUrl||m.imageUrl||m.media?.length||m.attachments&&!Array.isArray(m.attachments))throw Error('message_media_review_required');
     if(m.attachments?.some(f=>!f.verified||!result.attachments.some(a=>a.messageId===row.id&&a.path===f.path)))throw Error('message_media_review_required');
    }
    tx.update(root,{cleanupLeaseUntil:clock()+60000});for(const row of rows.docs)tx.delete(row.ref);
    return false;
   });
   if(empty)return;
  }
  throw Error('cleanup_page_limit_resume_required');
 }
 try{
  if(sourcePath&&(await db.doc(sourcePath).listCollections()).length)throw Error('unknown_subcollection');
  for(const item of result.attachments){
   await db.runTransaction(async tx=>{await guard(tx);tx.update(root,{cleanupLeaseUntil:clock()+60000});});
   const file=storage.file(item.path);
   try{
    const [meta]=await file.getMetadata();
    if(String(meta.generation)!==String(item.storageGeneration)||meta.metadata?.conversationId!==cid||meta.metadata?.messageId!==item.messageId||meta.metadata?.verifiedExclusive!=='true')throw Error('media_changed_review_required');
    await file.delete({ifGenerationMatch:item.storageGeneration});
   }catch(e){if(e.code!==404)throw e;}
  }
  await removeQuery(db.collection(`inbox_conversations/${cid}/messages`),{messages:true});
  for(const target of [`inbox_conversations/${cid}`,...(sourcePath?[sourcePath]:[])])for(const name of ['notification_events','notification_reads','notification_deliveries'])await removeQuery(db.collection(name).where('target','==',target));
  if((await root.listCollections()).some(c=>c.id!=='messages')||sourcePath&&(await db.doc(sourcePath).listCollections()).length)throw Error('unknown_subcollection');
  await db.runTransaction(async tx=>{
   const v=await guard(tx);
   const remaining=await tx.get(db.collection(`inbox_conversations/${cid}/messages`).limit(1));
   if(remaining.docs.length)throw Error('cleanup_page_limit_resume_required');
   // <=50 members + <=200 references, below Firestore's atomic write limit.
   for(const m of v.inventory.members)tx.delete(m.ref);
   for(const m of v.inventory.media)tx.delete(m.ref);
   for(const h of v.inventory.holds)tx.delete(h.ref);
   if(sourcePath)tx.delete(db.doc(sourcePath));
   tx.delete(root);tx.delete(approvalRef);
   tx.set(receipt,{status:'completed',completedAt:clock(),expiresAt:clock()+60*86400000});
  });
  return{state:'completed'};
 }catch(error){
  const retry=error.message==='cleanup_page_limit_resume_required'||['unavailable','aborted','deadline-exceeded'].includes(error.code)||[4,10,14,429,500,503].includes(error.code);
  await db.runTransaction(async tx=>{
   const c=(await tx.get(root)).data();if(c?.cleanupClaim!==claim)return;
   tx.update(root,{cleanupLeaseUntil:0});
   tx.update(receipt,{status:retry?'retry_required':'needs_review',errorCode:retry?'retry_required':'inventory_or_evidence_review_required',nextAttemptAt:retry?clock()+3600000:null});
  });
  return{state:retry?'retry_required':'needs_review'};
 }
}
module.exports={runConversationCleanup,readCleanupInventory};
