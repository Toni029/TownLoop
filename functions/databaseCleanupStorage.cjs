'use strict';
const {createHash,randomUUID}=require('node:crypto');
const {FieldPath}=require('firebase-admin/firestore');
const {trustedMedia}=require('./mediaCleanupPolicy.cjs');
const BUCKET='cc-livingcommunity-app.firebasestorage.app';
const FOLDERS={workOrders:'work_orders',discussion:'feed',marketplace:'marketplace',newsletters:'newsletters'};
const ROOTS={workOrders:['work_orders'],discussion:['discussion_feed','posts'],marketplace:['marketplace_posts','marketItems'],newsletters:['newsletters']};
const hash=value=>createHash('sha256').update(value).digest('hex');
const error=reason=>Object.assign(Error(reason),{cleanupHold:reason});
function canonicalPath(value){
 if(typeof value!=='string')return null;
 try{
  let name=value;
  if(value.startsWith(`gs://${BUCKET}/`))name=value.slice(BUCKET.length+6);
  else if(value.startsWith('https://')){
   const url=new URL(value),prefix=`/v0/b/${BUCKET}/o/`;
   if(url.hostname==='firebasestorage.googleapis.com'&&url.pathname.startsWith(prefix))name=decodeURIComponent(url.pathname.slice(prefix.length));
   else if(url.hostname==='storage.googleapis.com'&&url.pathname.startsWith(`/${BUCKET}/`))name=decodeURIComponent(url.pathname.slice(BUCKET.length+2));
   else return null;
  }
  if(!/^(work_orders|feed|marketplace)\/[^/]+$/.test(name)&&!/^newsletters\/[A-Za-z0-9_-]+\/[^/]+$/.test(name))return null;
  if(/[\u0000-\u0020\\?#]/.test(name)||name.split('/').some(p=>p==='.'||p==='..'))return null;
  return name;
 }catch{return null;}
}
function references(data){
 const paths=new Set(),unknown=new Set();let nodes=0;
 function walk(value,key='',depth=0){
  if(++nodes>20000||depth>20)throw error('inventory_incomplete');
  if(typeof value==='string'){
   const direct=canonicalPath(value);if(direct)paths.add(direct);
   // Include URL references embedded in private message text, not just rendered attachments.
   for(let token of value.match(/(?:https:\/\/|gs:\/\/)[^\s<>"']+|(?:work_orders|feed|marketplace)\/[^\s<>"']+/g)||[]){
    // Markdown/prose punctuation is ambiguous: retain literal AND stripped candidates.
    for(let end=0;end<16;end++){const path=canonicalPath(token);if(path)paths.add(path);if(!/[)\]},.;:!?]$/.test(token))break;token=token.slice(0,-1);if(end===15&&/[)\]},.;:!?]$/.test(token))throw error('inventory_incomplete');}
   }
   if(!direct&&/url|path|photo|image|media|attachment/i.test(key)&&value.trim()&&!/^firestore:|^data:/.test(value))unknown.add(hash(value));
  }else if(Array.isArray(value))for(const child of value)walk(child,key,depth+1);
  else if(value&&typeof value==='object'&&typeof value.toMillis!=='function')for(const [name,child]of Object.entries(value))walk(child,name,depth+1);
 }
 walk(data);return {paths:[...paths],unknown:[...unknown]};
}
/** Generation-bound media cleanup. No URL tokens, resident text or PDF bytes are persisted. */
function createStorageCleanup({db,databases,bucket,listPage,deploymentReady,verifyBarrier,trustedAfter,maxObjects=1000,maxReferenceDocuments=2500}){
 if(bucket.name!==BUCKET||db.databaseId!=='(default)')throw Error('Storage cleanup scope mismatch');
 const files=job=>db.collection('database_cleanup_jobs').doc(job.id).collection('files');
 async function claim(job,row,file){
  const attempt=randomUUID();
  await db.runTransaction(async tx=>{
   const [current,control,record]=await Promise.all([tx.get(db.doc(`database_cleanup_jobs/${job.id}`)),tx.get(db.doc('database_cleanup_control/active')),tx.get(row.ref)]);
   if(!job.lease||current.data()?.lease!==job.lease||current.data()?.finalizing||current.data()?.cancelRequested||!['queued','running'].includes(current.data()?.state)||control.data()?.jobId!==job.id||control.data()?.referenceWritesBlocked!==true)throw Error('cleanup_claim_lost');
   if(record.data()?.generation!==file.generation||record.data()?.metageneration!==file.metageneration||!['exclusive','deleting'].includes(record.data()?.status))throw Error('cleanup_claim_changed');
   tx.update(row.ref,{status:'deleting',attempt,attemptedAt:Date.now()});
  });return attempt;
 }
 async function complete(row,file,attempt=file.attempt){
  await db.runTransaction(async tx=>{const current=await tx.get(row.ref),data=current.data();if(data?.status==='deleting'&&data.generation===file.generation&&data.metageneration===file.metageneration&&data.attempt===attempt)tx.update(row.ref,{status:'deleted',completedAt:Date.now()});});
 }
 async function storageHeld(metadata){
  const [policy]=await bucket.getMetadata();
  return policy.versioning?.enabled===true||Number(policy.softDeletePolicy?.retentionDurationSeconds)>0||Number(policy.retentionPolicy?.retentionPeriod)>0||
   metadata.temporaryHold===true||metadata.eventBasedHold===true||metadata.retention!=null||
   metadata.retentionExpirationTime&&Date.parse(metadata.retentionExpirationTime)>Date.now()||
   ['legalHold','evidenceHold','retentionHold','quarantined'].some(key=>metadata.metadata?.[key]==='true');
 }
 async function list(category){
  const [rows,next]=await bucket.getFiles({prefix:`${FOLDERS[category]}/`,autoPaginate:false,maxResults:maxObjects+1});
  if(next?.pageToken||rows.length>maxObjects)throw error('inventory_incomplete');return rows;
 }
 async function shared(name,ownerRoot){
  let seen=0;const deadline=Date.now()+20000;
  for(const source of databases){
   const pager=listPage(source);const roots=await source.listCollections();
   async function visit(collection){
    let token='';do{
     const page=await pager(collection,token,25);
     for(const path of page.paths){
      if(++seen>maxReferenceDocuments||Date.now()>deadline)throw error('inventory_incomplete');
      if(source===db&&(path===ownerRoot||path.startsWith(ownerRoot+'/')))continue;
      const ref=source.doc(path);
      // Native PDF chunks cannot carry attachment references. Their payload is never fetched.
      const [snapshot]=await source.getAll(ref,...(/^newsletters\/[^/]+\/chunks\/[^/]+$/.test(path)?[{fieldMask:['index','totalChunks']}]:[]));
      if(snapshot.exists&&references(snapshot.data()).paths.includes(name))return true;
      const children=await ref.listCollections();if(children.length>50)throw error('inventory_incomplete');
      for(const child of children)if(await visit(child.path))return true;
     }
     token=page.next;
    }while(token);return false;
   }
   for(const root of roots){
    // These server-only records contain paths/proofs, never resident content or live attachment use.
    if(/^database_cleanup_(jobs|audit|control|fences|policies)$/.test(root.id))continue;
    if(await visit(root.path))return true;
   }
  }return false;
 }
 async function rootRefs(path){
  const found=new Set(),unknown=new Set();let count=0;
  async function visit(path){
   if(++count>1000)throw error('inventory_incomplete');
   const ref=db.doc(path),[snap]=await db.getAll(ref,...(/^newsletters\/[^/]+\/chunks\/[^/]+$/.test(path)?[{fieldMask:['index','totalChunks']}]:[]));
   if(snap.exists){const result=references(snap.data());for(const name of result.paths)found.add(name);for(const id of result.unknown)unknown.add(id);}
   for(const collection of await ref.listCollections()){let token='';do{const page=await listPage(db)(collection.path,token,25);for(const child of page.paths)await visit(child);token=page.next;}while(token);}
  }
  await visit(path);return {paths:[...found],unknown:[...unknown]};
 }
 async function provenance(metadata,path){
  const [collection,recordId]=path.split('/');const cutover=typeof trustedAfter==='function'?await trustedAfter():trustedAfter;if(!Number.isFinite(cutover)||cutover<=0)return false;
  const policy={ownerApproved:true,approvalReference:'database-cleanup-v2',trustedUploadsAfter:{toMillis:()=>cutover},storageRulesSha256:require('./deletionMediaProvenance.json').storageRulesSha256,collections:{[collection]:{action:'delete_linked_media_on_parent_deletion',reason:'Separately confirmed category cleanup'}}};
  return trustedMedia(metadata,{collection,recordId,uid:metadata.metadata?.uploadedBy,databaseId:'(default)'},policy);
 }
 async function inspect(job,item,name,metadata){
  const common={path:name,category:item.category,root:item.path,bytes:Math.max(0,Number(metadata?.size)||0)};
  let reason;
  if(item.reason)reason=item.reason==='active_newsletter_analysis'?'active_analysis':'protected_record';
  else if(!metadata)reason='file_missing';
  else if(await storageHeld(metadata))reason='protected_record';
  else if(item.category==='newsletters')reason='newsletter_storage_unverified'; // Historical newsletter metadata is descriptive, not an enforced ownership capability.
  else if(!metadata.metadata?.securityVersion||!metadata.metadata?.recordId||!metadata.metadata?.collection||!/^[1-9]\d*$/.test(String(metadata.generation))||!/^[1-9]\d*$/.test(String(metadata.metageneration)))reason='metadata_missing';
  else if(metadata.name!==name||metadata.bucket!==BUCKET||!Number.isSafeInteger(Number(metadata.size))||Number(metadata.size)<0)reason='ownership_unverified';
  else if(!name.startsWith(`${FOLDERS[item.category]}/`)||!await provenance(metadata,item.path))reason='ownership_unverified';
  else if(!await deploymentReady())reason='reference_writers_unfenced';
  else if(await shared(name,item.path))reason='shared_reference';
  return {...common,status:reason?(metadata?'held':'missing'):'exclusive',...(reason?{reason}:{}),...(metadata?{generation:String(metadata.generation),metageneration:String(metadata.metageneration)}:{})};
 }
 async function planRoot(job,item){
  if(!ROOTS[item.category]?.includes(item.path.split('/')[0]))return {files:[],reason:null};
  const refs=await rootRefs(item.path),listed=await list(item.category),map=new Map(listed.map(file=>[file.name,file.metadata]));
  const candidates=new Set(refs.paths);
  for(const file of listed)if(file.metadata?.metadata?.collection===item.path.split('/')[0]&&file.metadata?.metadata?.recordId===item.path.split('/')[1])candidates.add(file.name);
  const result=[];let reason=refs.unknown.length?'ownership_unverified':null;
  for(const name of candidates){
   // Out-of-category object references protect their root; never enter a deletion manifest for another category.
   if(!name.startsWith(`${FOLDERS[item.category]}/`)){reason='shared_reference';continue;}
   let record;
   try{record=await inspect(job,item,name,map.get(name));}catch(failure){record={path:name,category:item.category,root:item.path,bytes:Number(map.get(name)?.size)||0,status:'held',reason:failure.cleanupHold||'inventory_incomplete'};}
   result.push(record);if(record.reason)reason=record.reason;
  }
  // A root is all-or-hold. Never detach some files from a protected record while deleting other ones.
  if(reason)for(const record of result){if(record.status==='exclusive'){record.status='held';record.reason=reason;}}
  for(const record of result){const ref=files(job).doc(hash(record.path)),old=await ref.get();if(old.exists&&old.data().root!==record.root){record.status='held';record.reason='shared_reference';reason='shared_reference';}await ref.set(record);}
  return {files:result,reason};
 }
 async function inventoryOrphans(job){
  for(const category of job.categories){
   const current=await list(category),live=new Map(current.map(file=>[file.name,String(file.metadata?.generation)]));
   for(const file of current){
    const path=canonicalPath(file.name);if(!path)throw error('inventory_incomplete');
    const ref=files(job).doc(hash(path));if((await ref.get()).exists)continue;
    await ref.set({path,category,root:'',status:'held',reason:'ownership_unverified',bytes:Number(file.metadata?.size)||0});
   }
   // Include noncurrent and soft-deleted generations in the protected scope, even
   // if versioning/soft delete has since been disabled on the bucket.
   for(const mode of [{versions:true},{softDeleted:true}]){
    const [versions,next]=await bucket.getFiles({prefix:`${FOLDERS[category]}/`,autoPaginate:false,maxResults:maxObjects+1,...mode});
    if(next?.pageToken||versions.length>maxObjects)throw error('inventory_incomplete');
    for(const file of versions){const metadata=file.metadata||{},generation=String(metadata.generation);
     if(mode.softDeleted&&!metadata.softDeleteTime||!mode.softDeleted&&live.get(file.name)===generation)continue;
     const path=canonicalPath(file.name);if(!path||!/^\d+$/.test(generation))throw error('inventory_incomplete');
     await files(job).doc(hash(`${path}\0${generation}\0retained`)).set({path,generation,category,root:'',status:'held',reason:'protected_record',bytes:Number(metadata.size)||0});
    }
   }
  }
 }
 async function all(job){const rows=await files(job).limit(maxObjects+1).get();if(rows.size>maxObjects)throw error('inventory_incomplete');return rows.docs;}
 async function summary(job){
  const result=Object.fromEntries(job.categories.map(category=>[category,{files:0,bytes:0,exclusive:0,held:0,missing:0,remaining:0,reasons:[]}]));
  for(const row of await all(job)){const data=row.data(),value=result[data.category];if(!value)throw error('inventory_incomplete');value.files++;value.bytes+=data.bytes;if(data.status==='exclusive')value.exclusive++;else if(data.status==='missing')value.missing++;else if(data.status==='held')value.held++;if(data.status!=='deleted')value.remaining++;if(data.reason){let reason=value.reasons.find(item=>item.code===data.reason);if(!reason){reason={code:data.reason,count:0};value.reasons.push(reason);}reason.count++;}}
  return result;
 }
 async function digest(job){return hash(JSON.stringify((await all(job)).map(row=>[row.id,row.data()]).sort((a,b)=>a[0].localeCompare(b[0]))));}
 async function holdRoot(job,item,reason){
  const rows=await files(job).where('root','==',item.path).get();
  for(const row of rows.docs)if(row.data().status!=='deleted')await row.ref.update({...(row.data().status==='deleting'?{}:{status:'held'}),reason:/^[a-z_]+$/.test(reason)?reason:'protected_record'});
 }
 async function verifyRemaining(job){
  // Reconcile late uploads and object replacements; a filename is not proof the same generation is gone.
  for(const category of job.categories)for(const file of await list(category)){
   if(canonicalPath(file.name)!==file.name)throw error('inventory_incomplete');
   const ref=files(job).doc(hash(file.name)),old=await ref.get();
   if(!old.exists||old.data().status==='deleted')await ref.set({path:file.name,category,root:old.data()?.root||'',status:'held',reason:old.exists?'object_changed':'ownership_unverified',bytes:Number(file.metadata?.size)||0});
  }
 }
 async function scope(job,cursor){
  if(cursor&&!/^[a-f0-9]{64}$/.test(cursor))throw error('invalid_scope_cursor');
  let query=files(job).orderBy(FieldPath.documentId()).limit(51);if(cursor)query=query.startAfter(cursor);
  const result=await query.get(),rows=result.docs.slice(0,50);
  return {items:rows.map(row=>{const data=row.data();return {path:data.path,category:data.category,status:data.status==='deleting'?'exclusive':data.status,bytes:data.bytes,...(/^[1-9]\d*$/.test(data.generation||'')?{generation:data.generation}:{}),...(data.reason?{reason:data.reason}:{})};}),...(result.size>50?{nextCursor:rows.at(-1).id}:{})};
 }
 async function removeRoot(job,item,assertRoot){
  if(!await verifyBarrier(job)||!await deploymentReady())throw error('reference_writers_unfenced');
  const rows=await files(job).where('root','==',item.path).get();
  let processed=0;
  for(const row of rows.docs){
   const file=row.data();if(file.status==='deleted')continue;
   if(processed++>=1)return false; // bounded, durable work unit; caller must retain parent until true
   if(!['exclusive','deleting'].includes(file.status))throw error(file.reason||'ownership_unverified');
   await assertRoot();if(!await verifyBarrier(job)||!await deploymentReady())throw error('reference_writers_unfenced');
   const object=bucket.file(file.path);let metadata;
   try{[metadata]=await object.getMetadata();}catch(failure){
    if(failure.code===404&&file.status==='deleting'){await complete(row,file);continue;}
    if(failure.code===404)throw error('file_missing');throw failure;
   }
   if(String(metadata.generation)!==file.generation||String(metadata.metageneration)!==file.metageneration||!await provenance(metadata,item.path))throw error('object_changed');
   if(await storageHeld(metadata))throw error('protected_record');
   if(await shared(file.path,item.path))throw error('shared_reference');
   await assertRoot();if(!await verifyBarrier(job))throw error('reference_writers_unfenced');
   const attempt=await claim(job,row,file);
   try{await object.delete({ifGenerationMatch:file.generation,ifMetagenerationMatch:file.metageneration});}
   catch(failure){if(failure.code===412)throw error('object_changed');if(failure.code!==404)throw failure;}
   await complete(row,file,attempt);
  }return true;
 }
 async function settle(job,assertIntent){
  const rows=await files(job).where('status','==','deleting').limit(1).get();if(rows.empty)return true;
  if(!await verifyBarrier(job)||!await deploymentReady())throw error('reference_writers_unfenced');
  const row=rows.docs[0],file=row.data(),object=bucket.file(file.path);let metadata;
  try{[metadata]=await object.getMetadata();}catch(failure){if(failure.code===404){await complete(row,file);return false;}throw failure;}
  // Once generation/metageneration advances, an older conditional request can never match it again.
  if(String(metadata.generation)!==file.generation||String(metadata.metageneration)!==file.metageneration){await row.ref.update({status:'held',reason:'object_changed'});return false;}
  await assertIntent(file);
  if(await storageHeld(metadata)||await shared(file.path,file.root))throw error('in_flight_deletion');
  await object.delete({ifGenerationMatch:file.generation,ifMetagenerationMatch:file.metageneration}).catch(failure=>{if(failure.code!==404)throw failure;});
  await complete(row,file);return false;
 }
 async function noInFlight(job){return (await files(job).where('status','==','deleting').limit(1).get()).empty;}
 return {planRoot,inventoryOrphans,summary,scope,removeRoot,digest,holdRoot,verifyRemaining,settle,noInFlight};
}
module.exports={createStorageCleanup,canonicalPath,references};
