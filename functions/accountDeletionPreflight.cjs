const {createHash}=require('node:crypto');
const {DATABASES}=require('./accountDeletionScope.cjs');
const {TARGETS,inventoryReferencesUid,legacyPathReferencesUid}=require('./accountDeletionInventory.cjs');
const {referencesUid}=require('./accountDeletionPolicy.cjs');
const retention=require('./accountDeletionRetention.cjs');
const lifecycle=require('./accountDeletionLifecycle.cjs');
const {objectHashes}=require('./deletionMediaReferences.cjs');
const {trustedMedia,FOLDERS}=require('./mediaCleanupPolicy.cjs');
const provenance=require('./deletionMediaProvenance.json');
const hash=value=>createHash('sha256').update(value).digest('hex');
// Google sign-in portraits are provider-owned; deleting their copied URL needs no bucket action.
function providerAvatar(value){try{const url=new URL(value);return url.protocol==='https:'&&(url.hostname==='googleusercontent.com'||url.hostname.endsWith('.googleusercontent.com'));}catch{return false;}}
const CONTROL=['users','resident_directory','notification_devices','safety_limits','user_blocks','account_access_revocations','account_deletion_jobs','account_deletion_scopes','account_cleanup_devices','deletion_policies','media_cleanup_jobs','media_deletion_tombstones','media_cleanup_cursors','work_order_numbers','counters','storage_web_authorization','notification_state','deletion_review_deliveries','notification_rollouts','inbox_cleanup_requests','inbox_group_commands','inbox_legacy_leaves'];
// Server-owned operational metadata added by cleanup and Inbox routing. These
// contain no resident content; any actual UID reference still requires disposition.
const SERVER_METADATA=new Set(['database_cleanup_audit','database_cleanup_control','database_cleanup_fences','database_cleanup_jobs','database_cleanup_policies','inbox_conversation_routes','security_controls']);
async function inspectServerMetadata(db,collection,uid){
 let count=0,referenced=false;
 async function visit(path,depth=0){
  if(depth>8)throw Error('inventory_bound');let cursor;
  for(;;){let q=db.collection(path).orderBy('__name__').limit(100);if(cursor)q=q.startAfter(cursor);const page=await q.get();
   for(const doc of page.docs){if(++count>2500)throw Error('inventory_bound');if(doc.id.includes(uid)||JSON.stringify(doc.data()).includes(uid))referenced=true;for(const child of await db.doc(doc.ref.path).listCollections())await visit(child.path||doc.ref.path+'/'+child.id,depth+1);}
   if(page.size<100)break;cursor=page.docs.at(-1).id;
  }
 }
 await visit(collection);return referenced;
}
// Executed after access revocation/token drain and BEFORE any record destruction.
// Private values remain in memory; receipts contain hashes/metadata, never content or URLs.
async function preflightDeletion(job,{dbFor,bucket,mediaPolicy,now=Date.now()}) {
 const holds=[],required=new Map(),references=new Map(),scopes=[];
 const known=new Set([...TARGETS.filter(t=>!t.group).map(t=>t.collection),...CONTROL,...SERVER_METADATA]);
 for(const databaseId of DATABASES){
  const db=dbFor(databaseId),profileRef=db.doc(`users/${job.uid}`),profile=(await profileRef.get()).data();
  if(profile&&['id','uid','userId','authorId'].some(k=>profile[k]!=null&&profile[k]!==job.uid))holds.push({databaseId,reason:'profile_identity_conflict'});
  if((await profileRef.listCollections()).length)holds.push({databaseId,reason:'private_subcollection_adapter_required'});
  for(const key of ['avatarUrl','avatar_url'])if(typeof profile?.[key]==='string'&&/^https?:/.test(profile[key])&&!providerAvatar(profile[key]))holds.push({databaseId,reason:'avatar_object_ownership_adapter_required'});
  for(const c of await db.listCollections()){
   if(!known.has(c.id))holds.push({databaseId,reason:'unclassified_collection_metadata',collection:c.id});
   else if(SERVER_METADATA.has(c.id)&&await inspectServerMetadata(db,c.id,job.uid))holds.push({databaseId,reason:'administrative_reference_requires_disposition',collection:c.id});
  }
  // Authorization-related media links only; never fetch another profile's private fields.
  let profileCursor;
  for(let page=0;;page++){
   if(page>=100)throw Error('inventory_bound');let q=db.collection('users').select('avatarUrl','avatar_url').orderBy('__name__').limit(100);if(profileCursor)q=q.startAfter(profileCursor);const profiles=await q.get();
   for(const doc of profiles.docs)for(const h of objectHashes(doc.data())){const refs=references.get(h)||new Set();refs.add(`${databaseId}/${doc.ref.path}`);references.set(h,refs);}
   if(profiles.size<100)break;profileCursor=profiles.docs.at(-1).id;
  }
  let count=0;
  for(const target of TARGETS){let cursor;
   for(let page=0;;page++){
    if(page>=100)throw Error('inventory_bound');let q=(target.group?db.collectionGroup(target.group):db.collection(target.collection)).orderBy('__name__').limit(100);if(cursor)q=q.startAfter(cursor);
    const rows=await q.get();
    for(const doc of rows.docs){const path=doc.ref.path;if(target.group&&!/^inbox_conversations\/[^/]+\/messages\/[^/]+$/.test(path))continue;
     count++;const data=doc.data(),hashes=objectHashes(data),recordKey=`${databaseId}/${path}`;
     for(const h of hashes){const refs=references.get(h)||new Set();refs.add(recordKey);references.set(h,refs);}
     if(!inventoryReferencesUid(path,data,job.uid))continue;
     const plan=retention.plan(target.collection,data,job.uid),issue={databaseId,recordHash:hash(path)};
     if(legacyPathReferencesUid(path,job.uid))holds.push({...issue,reason:'legacy_identity_in_record_path'});
     if(plan.action==='review'){holds.push({...issue,reason:plan.reason});continue;}
     const after=['replace','replace_audit'].includes(plan.action)?plan.data:{...data,...plan.patch};
     if(!['delete_parent','delete_record'].includes(plan.action)&&referencesUid(after,job.uid))holds.push({...issue,reason:'unresolved_identity_fields'});
     const reports=await db.collection('moderation_reports').where('collection','==',target.collection).where('id','==',doc.id).limit(1).get();
     if(!reports.empty)holds.push({...issue,reason:'reported_evidence_requires_disposition'});
     if(['delete_parent','delete_record'].includes(plan.action)&&(await db.doc(path).listCollections()).length)holds.push({...issue,reason:'record_subcollection_adapter_required'});
     const removed=['replace','delete_parent','delete_record'].includes(plan.action)?hashes:hashes.filter(h=>!objectHashes(after).includes(h));
     for(const h of removed){if(!FOLDERS[target.collection]){holds.push({...issue,reason:'attachment_cleanup_adapter_required'});continue;}required.set(h,{collection:target.collection,recordId:doc.id,uid:job.uid,databaseId,recordKey,accountDeletionJobId:job.id,expiresAt:new Date(lifecycle.executionDates(job).retentionDueAt)});}
    }
    if(rows.size<100)break;cursor=target.group?rows.docs.at(-1).ref.path:rows.docs.at(-1).id;
   }
  }
  scopes.push({databaseId,scanned:count});
 }
 const manifest=[],seen=new Set();let pageToken;
 do{const [files,next]=await bucket.getFiles({autoPaginate:false,maxResults:100,...(pageToken?{pageToken}:{})});
  for(const file of files){let metadata;try{metadata=file.metadata?.generation?file.metadata:(await file.getMetadata())[0];}catch(error){if(error.code===404)continue;throw error;}
   const h=hash(metadata.name),parent=required.get(h),custom=metadata.metadata||{};
   if(!parent&&custom.uploadedBy!==job.uid&&custom.ownerUid!==job.uid)continue;
   if(!parent||custom.uploadedBy!==job.uid||!trustedMedia(metadata,parent,mediaPolicy)||!metadata.metageneration||references.get(h)?.size!==1||!references.get(h)?.has(parent.recordKey)||provenance.quarantinedObjectHashes.includes(h)){
    holds.push({reason:'media_provenance_or_shared_reference_review',objectHash:h});continue;
   }
   seen.add(h);manifest.push({objectHash:h,name:metadata.name,generation:metadata.generation,metageneration:metadata.metageneration,databaseId:parent.databaseId,collection:parent.collection,recordId:parent.recordId});
  }pageToken=next?.pageToken;
 }while(pageToken);
 // An already absent object requires no deletion and is explicitly recorded.
 for(const [h,parent]of required)if(!seen.has(h)&&!holds.some(x=>x.objectHash===h))manifest.push({objectHash:h,alreadyAbsent:true,databaseId:parent.databaseId,collection:parent.collection,recordId:parent.recordId});
 if(manifest.length>100||holds.length>100)throw Error('preflight_receipt_bound');
 return {version:1,uid:job.uid,jobId:job.id,...(lifecycle.isNewJob(job)?{requestId:job.requestId}:{}),checkedAt:new Date(now),scopes,manifest,holds};
}
module.exports={preflightDeletion,inspectServerMetadata};
