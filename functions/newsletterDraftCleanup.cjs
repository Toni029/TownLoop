'use strict';
const AGE_MS=24*60*60*1000;
const eligibleId=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(id)&&id!=='current';
const millis=t=>t?.toMillis?.()||0;
function manifestEligible(id,d){
 return eligibleId(id)&&['uploading','uploaded','purging'].includes(d?.uploadState)&&d.id===id&&typeof d.uploadedBy==='string'&&d.uploadedBy.length>0&&d.hasFirestoreBlob===true&&
 d.pdfUrl===`firestore:${id}`&&d.fileUrl===`firestore:${id}`&&(!d.pageImages||Array.isArray(d.pageImages)&&d.pageImages.length===0)&&
 Number.isInteger(d.totalChunks)&&d.totalChunks===Math.ceil(d.sourceBytes/(480*1024))&&d.totalChunks>0&&d.totalChunks<=200&&Number.isSafeInteger(d.sourceBytes)&&d.sourceBytes>0&&d.sourceBytes<=64*1048576&&d.totalSize===27+Math.ceil(d.sourceBytes/3)*4;
}
function references(id,row){return row.id==='current'&&row.data()?.id===id||row.id!==id&&(row.data()?.id===id||row.data()?.pdfUrl===`firestore:${id}`||row.data()?.fileUrl===`firestore:${id}`);}
function failure(message){return Object.assign(Error(message),{code:'failed-precondition'});}
/** Default database only. Persistent non-PDF fence prevents late clients recreating purged chunks. */
async function purgeDraft(db,id,{reason='abandoned',actor,now=Date.now(),enabled=false}={}){
 if(!enabled)throw failure('Newsletter draft cleanup is not activated. Nothing was removed.');
 if(!eligibleId(id))throw failure('Invalid unpublished newsletter upload.');
 const ref=db.collection('newsletters').doc(id),fence=db.collection('newsletter_draft_cleanup').doc(id);
 const scopes=await ref.listCollections();
 if(scopes.some(c=>c.id!=='chunks'))throw failure('This upload has additional records that need review before cleanup.');
 const claimed=await db.runTransaction(async tx=>{
  const [draft,job,roots,chunks]=await Promise.all([tx.get(ref),tx.get(fence),tx.get(db.collection('newsletters').select('id','pdfUrl','fileUrl','uploadState').limit(501)),tx.get(ref.collection('chunks').select('index','totalChunks','totalSize').limit(201))]);
  if(actor){const [profile,revoked]=await Promise.all([tx.get(db.collection('users').doc(actor)),tx.get(db.collection('account_access_revocations').doc(actor))]);const p=profile.data();if(revoked.exists||p?.approved!==true||p.deletionPending===true||!['admin','vip'].includes(p.role))throw Object.assign(Error('Only approved Admin/VIP accounts can discard newsletter uploads.'),{code:'permission-denied'});}
  if(roots.size>500)throw failure('Newsletter inventory requires review before cleanup.');
  if(roots.docs.some(row=>references(id,row))||draft.data()?.uploadState==='published')throw failure('Published or referenced newsletters cannot be discarded.');
  if(job.data()?.state==='purged')return 'done';
  if(!draft.exists||!manifestEligible(id,draft.data()))throw failure('This historical upload needs verified unpublished metadata before cleanup.');
  const d=draft.data();
  if(chunks.size>200||chunks.docs.some(c=>{const v=c.data();return !Number.isInteger(v.index)||String(v.index)!==c.id||v.index<0||v.index>=d.totalChunks||v.totalChunks!==d.totalChunks||v.totalSize!==d.totalSize;}))throw failure('Unexpected PDF chunk metadata; cleanup stopped.');
  // updateTime is assigned by Firestore, never a client-supplied clock.
  const latest=Math.max(millis(draft.updateTime),...chunks.docs.map(c=>millis(c.updateTime)));
  if(reason!=='discarded'&&d.uploadState!=='purging'&&(!latest||now-latest<AGE_MS))return false;
  if(d.uploadState==='purging'&&job.data()?.state!=='purging')throw failure('Cleanup fence is missing.');
  if(d.uploadState!=='purging'){
   tx.set(fence,{state:'purging',reason,startedAt:new Date(now)});
   tx.update(ref,{uploadState:'purging'});
  }
  return true;
 });
 if(claimed==='done')return {purged:true};
 if(!claimed)return {purged:false};
 // Only the established chunk namespace belongs to this upload. Never recurse
 // into arbitrary subcollections or touch Storage paths inferred from URLs.
 for(let batch=0;batch<3;batch++){
  const done=await db.runTransaction(async tx=>{
   const [job,roots,chunks,analyses]=await Promise.all([tx.get(fence),tx.get(db.collection('newsletters').select('id','pdfUrl','fileUrl','uploadState').limit(501)),tx.get(ref.collection('chunks').select().limit(100)),tx.get(db.collection('newsletter_analysis_jobs').where('newsletterId','==',id).select('newsletterId').limit(101))]);
   if(job.data()?.state==='purged')return true;
   if(job.data()?.state!=='purging'||roots.size>500||analyses.size>100||roots.docs.some(row=>references(id,row)))throw failure('Cleanup eligibility changed. Nothing further was removed.');
   for(const chunk of chunks.docs)tx.delete(chunk.ref);
   if(chunks.size<100){for(const analysis of analyses.docs)tx.delete(analysis.ref);tx.delete(ref);tx.update(fence,{state:'purged',completedAt:new Date(now)});return true;}
   return false;
  });
  if(done)return {purged:true};
 }
 return {purged:false,pending:true};
}
async function sweepDrafts(db,{enabled=false,now=Date.now(),limit=25}={}){
 if(!enabled)return {disabled:true};
 const rows=await db.collection('newsletters').where('uploadState','in',['uploading','uploaded','purging']).get();
 let purged=0,pending=0,excluded=0;
 const candidates=rows.docs.filter(r=>r.data().uploadState==='purging'||millis(r.updateTime)&&now-millis(r.updateTime)>=AGE_MS);
 excluded=candidates.filter(r=>!manifestEligible(r.id,r.data())).length;
 for(const row of candidates.filter(r=>manifestEligible(r.id,r.data())).sort((a,b)=>millis(a.updateTime)-millis(b.updateTime)).slice(0,Math.min(limit,25))){
  try{const result=await purgeDraft(db,row.id,{enabled,now});if(result.purged)purged++;if(result.pending)pending++;}
  catch(error){if(error.code==='failed-precondition')excluded++;else throw error;}
 }
 return {purged,pending,excluded};
}
module.exports={AGE_MS,manifestEligible,purgeDraft,sweepDrafts};
