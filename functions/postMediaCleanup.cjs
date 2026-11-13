// Only user-deleted canonical posts. Reuses media_cleanup_jobs; no schedules or account operations.
const {createHash,randomUUID}=require('node:crypto');
const {references,canonicalPath}=require('./databaseCleanupStorage.cjs');
const {trustedMedia}=require('./mediaCleanupPolicy.cjs');
const {protectedRecord}=require('./databaseCleanup.cjs');
const FOLDERS=Object.freeze({marketplace_posts:'marketplace',discussion_feed:'feed'});
const hash=value=>createHash('sha256').update(value).digest('hex');
function deletedPostJob(collection,recordId,before,eventId){
 if(!FOLDERS[collection]||typeof recordId!=='string'||!recordId||recordId.includes('/')||!before)return null;
 const uid=before.userId??before.authorId;
 const refs=references(Object.fromEntries(['media','photos','photoUrl','videoUrl','imageUrl','images','attachments','comments'].filter(k=>before[k]!=null).map(k=>[k,before[k]])));
 return{kind:'post_delete_v1',collection,recordId,uid:typeof uid==='string'?uid:'',databaseId:'(default)',eventHash:hash(eventId),paths:refs.paths,unknownReferences:refs.unknown.length,
 hold:protectedRecord(before,Date.now())?'protected_record':typeof uid!=='string'||!uid||uid.includes('/')||before.userId!=null&&before.authorId!=null&&before.userId!==before.authorId?'ownership_unverified':refs.paths.length>100?'inventory_incomplete':null};
}
// Exhaustive bounded, read-only scan. Never edits chats or other records; unknown references fail closed.
async function sharedReferenceState(name,{databases,listPage,maxDocuments=2500}){
 let seen=0,ambiguous=false;const deadline=Date.now()+20000;
 for(const db of databases){
  const pager=listPage(db);
  async function visit(collection){let token='';do{const page=await pager(collection,token,25);for(const path of page.paths){if(++seen>maxDocuments||Date.now()>deadline)throw Error('reference_inventory_incomplete');const ref=db.doc(path),snap=await ref.get();if(snap.exists){const refs=references(snap.data());if(refs.paths.includes(name))return true;ambiguous=ambiguous||refs.unknown.length>0;}const children=await ref.listCollections();if(children.length>50)throw Error('reference_inventory_incomplete');for(const child of children)if(await visit(child.path))return true;}token=page.next;}while(token);return false;}
  const roots=await db.listCollections();if(roots.length>100)throw Error('reference_inventory_incomplete');
  for(const root of roots){if(['media_cleanup_jobs','media_deletion_tombstones','media_cleanup_cursors','deletion_policies','database_cleanup_jobs','database_cleanup_control','database_cleanup_fences','database_cleanup_audit','database_cleanup_policies'].includes(root.id))continue;if(await visit(root.path))return{shared:true,ambiguous};}
 }return{shared:false,ambiguous};
}
async function processDeletedPost(job,deps){
 const outcome={status:'held',deleted:[],retained:[],retry:[]};
 const hold=(path,reason)=>outcome.retained.push({path,reason});
 if(job.kind!=='post_delete_v1'||job.databaseId!=='(default)'||!FOLDERS[job.collection]){hold('','invalid_scope');return outcome;}
 if(job.hold){hold('',job.hold);return outcome;}
 if(job.unknownReferences){hold('','unknown_media_reference');return outcome;}
 if(await deps.parentExists(job)){hold('','parent_restored');return outcome;}
 if(await deps.hasEvidence(job)){hold('','moderation_evidence');return outcome;}
 const paths=new Set(job.paths||[]);
 for(const path of await deps.linkedObjects(job)){paths.add(path);if(paths.size>100){hold('','inventory_incomplete');return outcome;}}
 for(const path of paths){
  try{
   if(canonicalPath(path)!==path||!path.startsWith(FOLDERS[job.collection]+'/')){hold(path,'ownership_unverified');continue;}
   const metadata=await deps.metadata(path),prior=deps.previousIntent?await deps.previousIntent(path):null;
   if(prior?.status==='active_removed'){if(!metadata){outcome.deleted.push(path);continue;}hold(path,'object_or_reference_changed');continue;}
   if(!metadata){hold(path,'missing_object_or_recovery_unknown');continue;}
   const custom=metadata.metadata||{};
   if(custom.uploadedBy!==job.uid||custom.collection!==job.collection||custom.recordId!==job.recordId||!metadata.metageneration||!trustedMedia(metadata,job,await deps.policy())){hold(path,'ownership_unverified');continue;}
   if(metadata.temporaryHold||metadata.eventBasedHold||metadata.retention||metadata.retentionExpirationTime&&Date.parse(metadata.retentionExpirationTime)>Date.now()||['legalHold','evidenceHold','retentionHold','quarantined'].some(k=>custom[k]==='true')){hold(path,'storage_hold');continue;}
   // No production writer protection is supplied until separately reviewed; do not buy a scan that cannot authorize deletion.
   if(!deps.withReferenceProtection){hold(path,'concurrent_reference_protection_required');continue;}
   const shared=await deps.referenceState(path);
   if(shared.shared||shared.ambiguous){hold(path,shared.shared?'shared_reference':'ambiguous_reference');continue;}
   // A point-in-time scan alone is not a race-safe exclusivity guarantee. Never pretend otherwise.
   await deps.withReferenceProtection(job,path,async()=>{
    if(await deps.parentExists(job)||await deps.hasEvidence(job))throw Error('protection_changed');
    const again=await deps.referenceState(path);if(again.shared||again.ambiguous)throw Error('protection_changed');
    await deps.persistIntent(path,{generation:String(metadata.generation),metageneration:String(metadata.metageneration)});
    await deps.remove(path,{ifGenerationMatch:String(metadata.generation),ifMetagenerationMatch:String(metadata.metageneration)});
    await deps.markRemoved(path);outcome.deleted.push(path);
   });
  }catch(error){if(error.code===412||error.message==='protection_changed')hold(path,'object_or_reference_changed');else outcome.retry.push({path,reason:'storage_or_inventory_retry'});}
 }
 // Active deletion is distinct from the bucket's seven-day recovery retention.
 outcome.status=outcome.retry.length?'queued':outcome.retained.length?'held':outcome.deleted.length?'active_removed_recovery_pending':'complete';return outcome;
}
async function handleDeletedPost(db,bucket,job,{referenceState,withReferenceProtection}={}){
 const id=hash('post-delete:'+job.collection+':'+job.recordId+':'+job.eventHash),ref=db.doc('media_cleanup_jobs/'+id);
 const lease=randomUUID();
 const acquired=await db.runTransaction(async tx=>{const data=(await tx.get(ref)).data();if(data?.leaseUntil>Date.now())return false;if(data)tx.update(ref,{lease,leaseUntil:Date.now()+360000});else tx.create(ref,{...job,status:'queued',lastAttemptAt:new Date(),intents:{},lease,leaseUntil:Date.now()+360000});return true;});
 if(!acquired)throw Error('post_media_retry_required');
 const assertLease=data=>{if(data?.lease!==lease||data.leaseUntil<Date.now())throw Error('post_media_lease_lost');};
 try {
 // No arbitrary request can select a UID/file. Only a trusted Firestore delete-event snapshot enters here.
 const outcome=await processDeletedPost(job,{
  parentExists:async()=> (await db.doc(job.collection+'/'+job.recordId).get()).exists,
  hasEvidence:async()=> !(await db.collection('moderation_reports').where('collection','==',job.collection).where('id','==',job.recordId).limit(1).get()).empty,
  linkedObjects:async()=>{let token='',paths=[];for(let page=0;page<20;page++){const [files,next]=await bucket.getFiles({prefix:FOLDERS[job.collection]+'/',autoPaginate:false,maxResults:100,...(token?{pageToken:token}:{})});for(const file of files){const m=file.metadata||{};if(m.metadata?.collection===job.collection&&m.metadata?.recordId===job.recordId)paths.push(file.name);}if(!next?.pageToken)return paths;token=next.pageToken;}throw Error('reference_inventory_incomplete');},
  metadata:async path=>{try{return(await bucket.file(path).getMetadata())[0];}catch(e){if(e.code===404)return null;throw e;}},
  policy:async()=> (await db.doc('deletion_policies/media').get()).data(),
  previousIntent:async path=>(await ref.get()).data()?.intents?.[hash(path)],
  referenceState:referenceState||(async()=>({shared:false,ambiguous:true})),withReferenceProtection,
  persistIntent:async(path,proof)=>db.runTransaction(async tx=>{const data=(await tx.get(ref)).data();assertLease(data);if(data.intents?.[hash(path)]?.status==='active_removed')return;tx.update(ref,{intents:{...data.intents,[hash(path)]:{path,...proof,status:'deleting'}}});}),
  remove:(path,options)=>bucket.file(path).delete(options),
  markRemoved:async path=>db.runTransaction(async tx=>{const data=(await tx.get(ref)).data(),key=hash(path);assertLease(data);tx.update(ref,{intents:{...data.intents,[key]:{...data.intents[key],status:'active_removed'}}});})
 });
 await db.runTransaction(async tx=>{const current=(await tx.get(ref)).data();assertLease(current);tx.update(ref,{...outcome,lastAttemptAt:new Date()});});if(outcome.retry.length)throw Error('post_media_retry_required');return outcome;
 } finally {await db.runTransaction(async tx=>{if((await tx.get(ref)).data()?.lease===lease)tx.update(ref,{lease:null,leaseUntil:0});});}
}
module.exports={FOLDERS,deletedPostJob,processDeletedPost,sharedReferenceState,handleDeletedPost};
