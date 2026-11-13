'use strict';
// Factory only: index.cjs deliberately does not import this file. No live activation on import.
const {randomUUID}=require('node:crypto');
const {onDocumentWritten}=require('firebase-functions/v2/firestore');
const {onSchedule}=require('firebase-functions/v2/scheduler');
const {BUCKET,FOLDERS,eventJob,orphanJob,runJob}=require('./socialMediaLifecycle.cjs');
const {references}=require('./databaseCleanupStorage.cjs');
const {createSocialReferenceFence}=require('./socialMediaLifecycleFence.cjs');
const {DATABASES}=require('./accountDeletionScope.cjs');
const INTERNAL=new Set(['social_media_jobs','social_media_control','social_media_deletion_attempts','media_cleanup_jobs','media_cleanup_cursors','media_deletion_tombstones','database_cleanup_jobs','database_cleanup_audit','database_cleanup_control','database_cleanup_fences','database_cleanup_policies','deletion_policies']);
/** Fully bounded, read-only references inventory across both databases, including missing parents. */
async function scanReferences({databases,listPage,name,maxDocuments=2500,deadline=Date.now()+20000}){
 let seen=0,ambiguous=false;
 for(const source of databases){
  const pager=listPage(source);
  async function visit(path){
   let token='';do{const page=await pager(path,token,25);
    for(const document of page.paths){
     if(++seen>maxDocuments||Date.now()>deadline)throw Error('inventory_incomplete');
     const ref=source.doc(document),snapshot=await ref.get();
     if(snapshot.exists){const result=references(snapshot.data());if(result.paths.includes(name))return true;if(result.unknown.length)ambiguous=true;}
     const children=await ref.listCollections();if(children.length>50)throw Error('inventory_incomplete');
     for(const child of children)if(await visit(child.path))return true;
    }token=page.next;
   }while(token);return false;
  }
  const roots=await source.listCollections();if(roots.length>100)throw Error('inventory_incomplete');
  for(const root of roots)if(!INTERNAL.has(root.id)&&await visit(root.path))return {shared:true,ambiguous};
 }
 return {shared:false,ambiguous};
}
function createSocialMediaLifecycleHandlers({db,databases,bucket,listPage,deploymentReady=async()=>false,enabled=()=>false,now=Date.now,serviceAccount}){
 if(db.databaseId!=='(default)'||bucket.name!==BUCKET||databases.length!==DATABASES.length||!DATABASES.every(id=>databases.some(source=>source.databaseId===id)))throw Error('Social lifecycle scope mismatch');
 const jobs=db.collection('social_media_jobs'),fence=createSocialReferenceFence({controlDb:db,databases,bucket,deploymentReady,now});
 async function queue(job){if(!job)return;const ref=jobs.doc(job.id);await db.runTransaction(async tx=>{if(!(await tx.get(ref)).exists)tx.create(ref,{...job,nextAttemptAt:job.notBefore,attempts:0});});}
 async function listOwned(job){
  const paths=[];let token='',pages=0;
  do{const [files,next]=await bucket.getFiles({prefix:`${FOLDERS[job.collection]}/`,autoPaginate:false,maxResults:100,...(token?{pageToken:token}:{})});
   for(const file of files){const [metadata]=await file.getMetadata();if(metadata.metadata?.collection===job.collection&&metadata.metadata?.recordId===job.recordId)paths.push(file.name);}
   if(paths.length>200)throw Error('inventory_incomplete');token=next?.pageToken||'';
   // Prevent unrelated files in a large folder from consuming an unbounded invocation.
   if(token&&++pages>20)throw Error('inventory_incomplete');
  }while(token);return paths;
 }
 async function tick(){
  if(!enabled())return;
  const pending=await jobs.where('nextAttemptAt','<=',now()).orderBy('nextAttemptAt').limit(5).get();
  for(const row of pending.docs){
   const lease=randomUUID(),job=await db.runTransaction(async tx=>{
    const snapshot=await tx.get(row.ref),data=snapshot.data();if(!data||data.status==='complete'||data.leaseUntil>now())return null;
    tx.update(row.ref,{lease,leaseUntil:now()+300000});return {...data,id:row.id};
   });if(!job)continue;
   const assertLease=async()=>{const data=(await row.ref.get()).data();if(data?.lease!==lease||data.leaseUntil<now()+30000)throw Error('cleanup_lease_lost');};
   let remove;
   const outcome=await runJob(job,{now,assertLease,hasEvidence:async()=>{const reports=await db.collection('moderation_reports').where('collection','==',job.collection).where('id','==',job.recordId).limit(1).get();return !reports.empty;},readParent:async()=>{const snapshot=await db.doc(`${job.collection}/${job.recordId}`).get();return snapshot.exists?snapshot.data():null;},listOwned,
    readPolicy:async()=>(await db.doc('deletion_policies/media').get()).data(),readBucket:async()=>(await bucket.getMetadata())[0],
    readRecovery:async()=>(await row.ref.get()).data()?.recovery||[],
    persistRecovery:async record=>db.runTransaction(async tx=>{const snapshot=await tx.get(row.ref),data=snapshot.data();if(data?.lease!==lease||data.leaseUntil<now()+30000)throw Error('cleanup_lease_lost');const recovery=(data.recovery||[]).filter(item=>item.path!==record.path||item.generation!==record.generation);recovery.push(record);if(recovery.length>200)throw Error('inventory_incomplete');tx.update(row.ref,{recovery});}),
    readSoftDeleted:async(name,generation)=>{try{const [file]=await bucket.file(name,{generation}).get({softDeleted:true});return file.metadata;}catch(error){if(error.code===404)return null;throw error;}},
    readGeneration:async(name,generation)=>{try{return (await bucket.file(name,{generation}).getMetadata())[0];}catch(error){if(error.code===404)return null;throw error;}},
    readObject:async name=>{try{return (await bucket.file(name).getMetadata())[0];}catch(error){if(error.code===404)return null;throw error;}},
    scanReferences:name=>scanReferences({databases,listPage,name}),
    withReferenceFence:body=>fence.run(job.id,async(assertFrozen,conditionalDelete)=>{remove=conditionalDelete;return body(assertFrozen);}),deleteObject:(...args)=>remove(...args)});
   await db.runTransaction(async tx=>{const snapshot=await tx.get(row.ref);if(snapshot.data()?.lease!==lease)return;
    const attempts=(snapshot.data()?.attempts||0)+1,deletedPaths=[...new Set([...(snapshot.data()?.deletedPaths||[]),...outcome.deletedPaths])],missingPaths=[...new Set([...(snapshot.data()?.missingPaths||[]),...outcome.missingPaths])].filter(path=>!deletedPaths.includes(path));tx.update(row.ref,{...outcome,deletedPaths,missingPaths,deleted:deletedPaths.length,missing:missingPaths.length,attempts,lastAttemptAt:now(),lease:null,leaseUntil:0,nextAttemptAt:outcome.status==='complete'?Number.MAX_SAFE_INTEGER:Math.max(job.notBefore,now()+Math.min(86400000,900000*2**Math.min(attempts-1,7)))});
   });
  }
 }
 async function inventoryOrphans(){
  if(!enabled())return;
  // Resumable per-folder cursor; young/unqualified objects cannot starve later pages.
  for(const folder of Object.values(FOLDERS)){
   const cursor=db.doc(`social_media_control/orphans_${folder}`),state=(await cursor.get()).data();
   const [files,next]=await bucket.getFiles({prefix:`${folder}/`,autoPaginate:false,maxResults:100,...(state?.pageToken?{pageToken:state.pageToken}:{})});
   let unclassified=0;
   for(const file of files){let metadata;try{[metadata]=await file.getMetadata();}catch(error){if(error.code===404)continue;throw error;}const job=orphanJob(metadata,db.databaseId,now());if(job)await queue(job);else unclassified++;}
   await cursor.set({pageToken:next?.pageToken||'',updatedAt:now(),unclassifiedOnPage:unclassified,inventoryStatus:unclassified?'retained_unclassified':'page_scanned'});
  }
 }
 const options={region:'us-central1',maxInstances:1,timeoutSeconds:300,...(serviceAccount?{serviceAccount}:{})};
 const handlers={};
 for(const collection of Object.keys(FOLDERS))handlers[`queueSocialMedia_${collection}`]=onDocumentWritten({...options,database:'(default)',document:`${collection}/{recordId}`,retry:true},async event=>{
  if(!enabled())return;await queue(eventJob({databaseId:db.databaseId,collection,recordId:event.params.recordId,eventId:event.id,before:event.data?.before.exists?event.data.before.data():null,after:event.data?.after.exists?event.data.after.data():null,now:now()}));
 });
 handlers.resumeSocialMediaCleanup=onSchedule({...options,schedule:'every 15 minutes',timeZone:'Etc/UTC'},tick);
 handlers.inventorySocialMediaOrphans=onSchedule({...options,schedule:'every 60 minutes',timeZone:'Etc/UTC'},inventoryOrphans);
 return {handlers,queue,tick,inventoryOrphans};
}
module.exports={createSocialMediaLifecycleHandlers,scanReferences};
