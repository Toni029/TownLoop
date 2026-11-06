'use strict';
// Default-database only. No production activation is implied by importing this module.
const {createHash,randomUUID}=require('node:crypto');
const {FieldPath}=require('firebase-admin/firestore');
const CATEGORIES=Object.freeze({workOrders:['work_orders'],discussion:['discussion_feed','posts'],marketplace:['marketplace_posts','marketItems'],newsletters:['newsletters','community_events','community_highlights','newsletter_analysis_jobs']});
const PHRASE='DELETE SELECTED DATA';
const TERMINAL=new Set(['completed','completed_with_holds','cancelled']);
const hash=value=>createHash('sha256').update(value).digest('hex');
const version=doc=>doc.exists?`${doc.updateTime.seconds}:${doc.updateTime.nanoseconds}`:null;
// PDF data is deliberately excluded: planning neither decodes nor copies PDF chunks.
const FIELDS=['role','approved','deletionPending','legalHold','evidenceHold','retentionHold','hold','holds','retention','retainUntil','retentionUntil','deleteAfter','evidence','reported','reportId','reportIds','isAiExtracted','newsletterId','id','state','status','leaseUntil','retentionVersion','completedAt','retentionDueAt','retentionExpiresAt','photoUrl','photos','media','mediaUrl','itemMediaUrl','imageUrl','attachmentUrl','attachments','fileUrl','pdfUrl','pageImages','url','storagePath','comments','messages'];
const zero=()=>({records:0,documents:0,deleted:0,held:0,failed:0,remaining:0,storageDeleted:0,storageHeld:0});
class CleanupError extends Error{constructor(code,message){super(message);this.code=code;}}
const fail=(code,message)=>{throw new CleanupError(code,message);};
function protectedRecord(data,now){
 if(['legalHold','evidenceHold','retentionHold','hold','reported'].some(key=>data[key]!=null&&data[key]!==false))return true;
 if(data.holds&&Object.keys(data.holds).length||data.evidence||data.reportId||data.reportIds?.length)return true;
 if(data.retention&&data.retention!==false)return true; // Unknown retention policies fail closed.
 if(data.retentionVersion!=null){const completed=data.completedAt?.toMillis?.();if(data.retentionVersion!==1||data.status!=='Done'||!Number.isFinite(completed)||completed+30*86400000>now)return true;}
 for(const key of ['retainUntil','retentionUntil','deleteAfter','retentionDueAt','retentionExpiresAt'])if(data[key]){
  const date=data[key].toMillis?.()??new Date(data[key]).getTime();if(!Number.isFinite(date)||date>now)return true;
 }
 return false;
}
function mediaReferences(data){
 const found=new Set();let visited=0;
 function walk(value,key='',depth=0){
  if(++visited>10000||depth>20)throw Error('media_inventory_bound');
  if(typeof value==='string'&&value.trim()&&!/^firestore:[A-Za-z0-9_-]+$/.test(value)&&!/^data:/.test(value)&&/url|path|photo|image|media|attachment/i.test(key))found.add(hash(value));
  else if(Array.isArray(value))for(const child of value)walk(child,key,depth+1);
  else if(value&&typeof value==='object'&&!value.toMillis)for(const [name,child]of Object.entries(value))walk(child,name,depth+1);
 }
 walk(data);return [...found];
}
/** Bounded REST pagination includes missing parents with live descendants. Never list all IDs in memory. */
function createDocumentPager({project,emulatorHost,getAccessToken}){
 if(emulatorHost&&!/^127\.0\.0\.1:\d+$/.test(emulatorHost))throw Error('Loopback emulator required');
 return async function listPage(collection,pageToken='',pageSize=1){
  if(collection.split('/').some(part=>!part||part==='.'||part==='..'))throw Error('Invalid inventory path');
  const origin=emulatorHost?`http://${emulatorHost}`:'https://firestore.googleapis.com';
  const url=new URL(`${origin}/v1/projects/${project}/databases/(default)/documents/${collection.split('/').map(encodeURIComponent).join('/')}`);
  url.searchParams.set('showMissing','true');url.searchParams.set('pageSize',String(pageSize));
  url.searchParams.set('mask.fieldPaths','_cleanupNamesOnly');if(pageToken)url.searchParams.set('pageToken',pageToken);
  const headers=emulatorHost?{Authorization:"Bearer owner"}:{Authorization:`Bearer ${await getAccessToken()}`};
  const response=await fetch(url,{headers,signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error(`inventory_transport_${response.status}`);
  const result=await response.json();return {paths:(result.documents||[]).map(doc=>doc.name.split('/documents/')[1]),next:result.nextPageToken||''};
 };
}
function createCleanupService({db,listPage,enabled=()=>false,verifySafety,verifyIdentity,now=Date.now,beforeDelete=async()=>{},onError=()=>{}}){
 if(db.databaseId!=='(default)')throw Error('Database Cleanup requires the default database.');
 const control=db.doc('database_cleanup_control/active');
 const jobRef=id=>db.doc(`database_cleanup_jobs/${id}`);
 const audit=id=>db.doc(`database_cleanup_audit/${id}`);
 function publicJob(job){return {id:job.id,state:job.state,categories:job.categories,counts:job.counts,...(job.planHash?{planHash:job.planHash}:{}),confirmationPhrase:PHRASE,enabled:enabled(),completeInventory:job.completeInventory,...(job.message?{message:job.message}:{})};}
 async function authorized(uid){
  if(!uid)fail('unauthenticated','Sign in with an approved Admin account.');
  const [profile,revoked,identity]=await Promise.all([db.doc(`users/${uid}`).get(),db.doc(`account_access_revocations/${uid}`).get(),verifyIdentity(uid)]);
  const data=profile.data();if(identity.disabled||revoked.exists||data?.role!=='admin'||data.approved!==true||data.deletionPending===true)fail('permission-denied','A currently approved Admin account is required.');
 }
 async function safety(){if(!enabled())fail('failed-precondition','Database Cleanup execution is disabled pending an approved backend and rules rollout.');if(await verifySafety()!==true)fail('failed-precondition','Cleanup safety configuration does not match the deployed rules. Nothing further was deleted.');}
 function validateId(id){if(typeof id!=='string'||!/^cleanup_[a-f0-9]{40}$/.test(id))fail('invalid-argument','Invalid cleanup job.');}
 async function operate(uid,input){
  await authorized(uid);if(!input||typeof input!=='object')fail('invalid-argument','Invalid cleanup request.');
  if(input.action==='preview'){
   const categories=Object.keys(CATEGORIES).filter(key=>input.categories?.includes(key));
   if(!Array.isArray(input.categories)||!categories.length||categories.length!==input.categories.length||typeof input.requestId!=='string'||!/^[A-Za-z0-9_-]{8,120}$/.test(input.requestId))fail('invalid-argument','Select valid categories before requesting an inventory.');
   const id=`cleanup_${hash(JSON.stringify([uid,input.requestId,categories])).slice(0,40)}`,ref=jobRef(id);
   const job=await db.runTransaction(async tx=>{
    const [old,lock]=await Promise.all([tx.get(ref),tx.get(control)]);
    if(old.exists)return old.data();
    if(lock.data()?.jobId) {
     const active=await tx.get(jobRef(lock.data().jobId));const current=active.data();
     if(current&&!TERMINAL.has(current.state)&&!(current.state==='review'&&current.expiresAt<now())){
      if(JSON.stringify(current.categories)!==JSON.stringify(categories))fail('failed-precondition',`Another cleanup is active for ${current.categories.join(', ')}. Select those same categories to reopen it, then cancel or resume it.`);
      return current;
     }
    }
    const job={id,operatorUid:uid,initiatedBy:uid,state:'planning',categories,scan:categories.flatMap(category=>CATEGORIES[category].map(collection=>({category,collection}))),scanIndex:0,pageToken:'',counts:Object.fromEntries(categories.map(key=>[key,zero()])),completeInventory:true,createdAt:now(),updatedAt:now(),expiresAt:now()+30*60000,leaseUntil:0,digest:hash(id),message:'Preparing exact record and nested-document counts. No resident data is changed.'};
    tx.create(ref,job);tx.set(control,{jobId:id,operatorUid:uid,collections:[],phase:'planning'});return job;
   });return publicJob(job);
  }
  validateId(input.jobId);const ref=jobRef(input.jobId);
  if(input.action==='status'){
   const job=(await ref.get()).data();if(!job)fail('not-found','This cleanup job is not available.');return publicJob(job);
  }
  if(!['confirm','resume','cancel'].includes(input.action))fail('invalid-argument','Unknown cleanup action.');
  if(input.action!=='cancel')await safety();
  return publicJob(await db.runTransaction(async tx=>{
   const [snap,lock]=await Promise.all([tx.get(ref),tx.get(control)]);const job=snap.data();
   if(!job)fail('not-found','This cleanup job is not available.');
   if(TERMINAL.has(job.state))return job;
   if(lock.data()?.jobId!==job.id)fail('failed-precondition','This preview is no longer active. Create a new inventory.');
   if(input.action==='confirm'){
    if(input.confirmation!==PHRASE)fail('invalid-argument','Enter the exact confirmation phrase.');
    if(input.planHash!==job.planHash||!job.completeInventory||job.expiresAt<now())fail('failed-precondition','The preview has changed or expired. Prepare a new inventory.');
    if(['queued','running','paused'].includes(job.state))return job;
    if(job.state!=='review')fail('failed-precondition','Wait for the complete inventory preview.');
    job.operatorUid=uid;job.state='queued';job.confirmedAt=now();job.message='Confirmed selected categories only. Preparing bounded deletion.';
    tx.set(control,{jobId:job.id,operatorUid:uid,collections:job.scan.map(item=>item.collection),phase:'running'});
    tx.set(audit(job.id),{operatorUid:uid,confirmedAt:job.confirmedAt,categories:job.categories,outcome:'queued',counts:job.counts});
   }else if(input.action==='resume'){
    if(!['paused','failed'].includes(job.state))return job;
    job.operatorUid=uid;job.state=job.confirmedAt?'queued':'planning';job.message='Retrying from the last confirmed checkpoint.';job.leaseUntil=0;
   }else{
    // A currently leased batch must reach its transaction boundary before cancellation.
    job.cancelRequested=true;job.operatorUid=uid;if(['paused','failed','review'].includes(job.state))job.state=job.confirmedAt?'queued':'planning';job.message='Cancellation requested. Existing per-record safety fences will remain.';
   }
   job.updatedAt=now();tx.set(ref,job);return job;
  }));
 }
 async function tree(path){
  const documents=[];const media=new Set();let hold=false;let names=0;
  async function visit(path,depth){
   if(depth>8||++names>1000)throw Error('nested_inventory_bound');
   const ref=db.doc(path);const [snap]=await db.getAll(ref,{fieldMask:FIELDS});
   if(snap.exists){const data=snap.data();documents.push({path,version:version(snap)});hold=hold||protectedRecord(data,now());for(const key of mediaReferences(data))media.add(key);}
   const collections=await ref.listCollections();if(collections.length>50)throw Error('nested_inventory_bound');
   for(const collection of collections){let token='';do{const page=await listPage(collection.path,token,25);for(const child of page.paths)await visit(child,depth+1);token=page.next;}while(token);}
  }
  await visit(path,0);documents.sort((a,b)=>b.path.split('/').length-a.path.split('/').length||a.path.localeCompare(b.path));
  return {documents,media:[...media],hold};
 }
 async function hasActiveAnalysis(){
  const rows=await db.collection('newsletter_analysis_jobs').where('state','in',['queued','running','retrying']).limit(1).get();return !rows.empty;
 }
 async function classification(path,category){
  const [collection,id]=path.split('/'),[snap]=await db.getAll(db.doc(path),{fieldMask:FIELDS}),data=snap.data()||{};
  const reports=await db.collection('moderation_reports').where('collection','==',collection).where('id','==',id).limit(1).get();
  if(!reports.empty)return {reason:'reported_evidence'};
  if(category==='newsletters'){
   if(['community_events','community_highlights'].includes(collection)){
    if(data.isAiExtracted!==true)return {skip:true};
    if(typeof data.newsletterId!=='string'||!data.newsletterId||data.newsletterId.includes('/'))return {reason:'newsletter_attribution_unverified'};
    const linked=await db.doc(`newsletters/${data.newsletterId}`).get();
    // During execution the confirmed manifest is the ownership proof, not an already removed edition.
    if(!linked.exists)return {reason:'newsletter_attribution_unverified'};
   }
   if(collection==='newsletter_analysis_jobs'&&(!data.newsletterId||typeof data.newsletterId!=='string'))return {reason:'newsletter_attribution_unverified'};
   if(await hasActiveAnalysis())return {reason:'active_newsletter_analysis'};
  }
  return {};
 }
 async function lease(){
  return db.runTransaction(async tx=>{
   const lock=await tx.get(control);if(!lock.data()?.jobId)return null;
   const ref=jobRef(lock.data().jobId),snap=await tx.get(ref),job=snap.data();
   if(!job||!['planning','queued','running'].includes(job.state)||job.leaseUntil>now())return null;
   job.lease=randomUUID();job.leaseUntil=now()+120000;tx.set(ref,job);return job;
  });
 }
 async function checkpoint(job,update,extra=()=>{}){
  return db.runTransaction(async tx=>{
   const [current,lock]=await Promise.all([tx.get(jobRef(job.id)),tx.get(control)]),latest=current.data();
   if(latest?.lease!==job.lease||lock.data()?.jobId!==job.id)throw Error('cleanup_lease_lost');
   Object.assign(latest,update,{updatedAt:now(),leaseUntil:0});extra(tx,latest);tx.set(jobRef(job.id),latest);return latest;
  });
 }
 async function plan(job){
  if(job.scanIndex>=job.scan.length){
   if(!job.dependenciesChecked)return propagateNewsletterHolds(job);
   return checkpoint(job,{state:'review',planHash:hash(JSON.stringify([job.id,job.categories,job.counts,job.digest])),message:'Inventory ready. Protected records and unverified/shared files will remain.'});
  }
  const scope=job.scan[job.scanIndex],page=await listPage(scope.collection,job.pageToken),path=page.paths[0];
  if(!path)return checkpoint(job,{scanIndex:job.scanIndex+1,pageToken:''});
  const itemRef=jobRef(job.id).collection('items').doc(hash(path));
  const kind=await classification(path,scope.category);
  const advance={scanIndex:page.next?job.scanIndex:job.scanIndex+1,pageToken:page.next||''};
  if(kind.skip)return checkpoint(job,advance);
  const inventory=await tree(path),reason=kind.reason||(inventory.hold?'retention_or_evidence_hold':inventory.media.length?'storage_exclusivity_unverified':null);
  const [root]=await db.getAll(db.doc(path),{fieldMask:['newsletterId','id']});
  const newsletterId=scope.category==='newsletters'?(scope.collection==='newsletters'?(root.id==='current'?root.data()?.id:root.id):root.data()?.newsletterId):null;
  const item={path,category:scope.category,newsletterId:typeof newsletterId==='string'?newsletterId:null,documents:inventory.documents,storageHeld:inventory.media.length,reason,state:reason?'held':'pending',cursor:0};
  if(Buffer.byteLength(JSON.stringify(item))>650000)throw Error('nested_inventory_bound');
  const counts=structuredClone(job.counts),count=counts[scope.category];count.records++;count.documents+=inventory.documents.length;count.remaining+=inventory.documents.length;
  if(reason){count.held++;count.storageHeld+=inventory.media.length;}
  return checkpoint(job,{...advance,counts,digest:hash(job.digest+JSON.stringify(item))},tx=>{tx.create(itemRef,item);if(reason&&item.newsletterId)tx.set(jobRef(job.id).collection('edition_holds').doc(hash(item.newsletterId)),{reason});});
 }
 async function propagateNewsletterHolds(job){
  let query=jobRef(job.id).collection('items').orderBy(FieldPath.documentId()).limit(1);
  if(job.dependencyCursor)query=query.startAfter(job.dependencyCursor);
  const rows=await query.get();if(rows.empty)return checkpoint(job,{dependenciesChecked:true});
  const row=rows.docs[0],item=row.data();
  const blocked=item.newsletterId&&(await jobRef(job.id).collection('edition_holds').doc(hash(item.newsletterId)).get()).exists;
  if(item.state==='pending'&&blocked){const counts=structuredClone(job.counts);counts[item.category].held++;return checkpoint(job,{dependencyCursor:row.id,counts},tx=>tx.update(row.ref,{state:'held',reason:'protected_newsletter_dependency'}));}
  return checkpoint(job,{dependencyCursor:row.id});
 }
 async function protectChanged(job,itemRef,item,reason){
  const counts=structuredClone(job.counts);counts[item.category].held++;counts[item.category].storageHeld+=item.storageHeld||0;
  return checkpoint(job,{counts,message:'Some selected records were protected or changed after preview and have been retained.'},tx=>tx.update(itemRef,{state:'held',reason}));
 }
 async function remove(job){
  const partial=await jobRef(job.id).collection('items').where('state','==','deleting').limit(1).get();
  const rows=partial.empty?await jobRef(job.id).collection('items').where('state','==','pending').orderBy(FieldPath.documentId()).limit(1).get():partial;
  if(rows.empty)return finalize(job);
  const row=rows.docs[0],item=row.data(),[collection,id]=item.path.split('/');job.currentCategory=item.category;job.currentPath=item.path;
  if(!CATEGORIES[item.category]?.includes(collection)||item.path.split('/').length!==2)throw Error('manifest_scope_invalid');
  if(item.state==='pending'){
   const current=await tree(item.path),kind=await classification(item.path,item.category);
   // Newsletter-linked data can refer to a deleted edition only if it was proven in this exact confirmed plan.
   const [currentRoot]=await db.getAll(db.doc(item.path),{fieldMask:['newsletterId','isAiExtracted']});
   const knownLink=item.newsletterId&&currentRoot.data()?.newsletterId===item.newsletterId&&currentRoot.data()?.isAiExtracted===true;
   const reason=kind.reason==='newsletter_attribution_unverified'&&knownLink&&['community_events','community_highlights'].includes(collection)?null:kind.reason;
   if(reason||current.hold||current.media.length||JSON.stringify(current.documents)!==JSON.stringify(item.documents))return protectChanged(job,row.ref,item,reason||'record_changed_after_preview');
   await db.runTransaction(async tx=>{
    const [snap,lock,profile,revoked,analyses]=await Promise.all([tx.get(jobRef(job.id)),tx.get(control),tx.get(db.doc(`users/${job.operatorUid}`)),tx.get(db.doc(`account_access_revocations/${job.operatorUid}`)),item.category==='newsletters'?tx.get(db.collection('newsletter_analysis_jobs').where('state','in',['queued','running','retrying']).limit(1)):Promise.resolve(null)]);
    if(snap.data()?.lease!==job.lease||lock.data()?.jobId!==job.id||profile.data()?.role!=='admin'||!profile.data()?.approved||revoked.exists)throw Error('cleanup_authorization_changed');
    if(analyses&&!analyses.empty)throw Error('cleanup_active_analysis');
    tx.set(db.doc(`database_cleanup_fences/${collection}/records/${id}`),{jobId:job.id,createdAt:now()});
    // Derived news shares its edition's fence, keeping a large atomic publish
    // within Firestore's rules-read budget and preventing old AI results returning.
    if(['community_events','community_highlights'].includes(collection)&&item.newsletterId)tx.set(db.doc(`database_cleanup_fences/newsletters/records/${item.newsletterId}`),{jobId:job.id,createdAt:now()});
    if(collection==='newsletters'&&id!=='current')tx.set(db.doc(`newsletter_draft_cleanup/${id}`),{state:'purging',reason:'admin_database_cleanup',jobId:job.id,createdAt:new Date(now())});
    tx.update(row.ref,{state:'deleting'});
   });
   item.state='deleting';
  }
  await beforeDelete(item.path);
  const batch=item.documents.slice(item.cursor,item.cursor+100);
  const expected=new Map(item.documents.map(record=>[record.path,record.version]));
  const readPaths=new Set(batch.map(record=>record.path));
  // A new hold/version change on an ancestor must protect descendants before
  // their first batch, not only when the parent itself reaches the delete cursor.
  for(const record of batch){const parts=record.path.split('/');for(let end=2;end<parts.length;end+=2)readPaths.add(parts.slice(0,end).join('/'));}
  readPaths.add(item.path);
  // Each batch commits deletions and its progress atomically, with version preconditions.
  await db.runTransaction(async tx=>{
   const [current,lock,manifest,profile,revoked,reports,docs,analyses]=await Promise.all([tx.get(jobRef(job.id)),tx.get(control),tx.get(row.ref),tx.get(db.doc(`users/${job.operatorUid}`)),tx.get(db.doc(`account_access_revocations/${job.operatorUid}`)),tx.get(db.collection('moderation_reports').where('collection','==',collection).where('id','==',id).limit(1)),tx.getAll(...[...readPaths].map(path=>db.doc(path)),{fieldMask:FIELDS}),item.category==='newsletters'?tx.get(db.collection('newsletter_analysis_jobs').where('state','in',['queued','running','retrying']).limit(1)):Promise.resolve(null)]);
   const latest=current.data();
   if(latest?.lease!==job.lease||lock.data()?.jobId!==job.id||!lock.data()?.collections?.includes(collection)||manifest.data()?.cursor!==item.cursor)throw Error('cleanup_checkpoint_changed');
   if(profile.data()?.role!=='admin'||profile.data()?.approved!==true||profile.data()?.deletionPending||revoked.exists)throw Error('cleanup_authorization_changed');
   if(latest.cancelRequested)throw Error('cleanup_cancel_requested');
   if(!reports.empty)throw Error('cleanup_reported_evidence');
   if(analyses&&!analyses.empty)throw Error('cleanup_active_analysis');
   if(docs.some(doc=>doc.exists&&protectedRecord(doc.data(),now())))throw Error('cleanup_retention_changed');
   for(const doc of docs)if(version(doc)!==(expected.get(doc.ref.path)??null))throw Error('cleanup_record_changed');
   const snapshots=new Map(docs.map(doc=>[doc.ref.path,doc]));
   let deleted=0;
   for(let i=0;i<batch.length;i++){
    const doc=snapshots.get(batch[i].path);
    if(doc.exists){tx.delete(doc.ref);deleted++;}
   }
   const cursor=item.cursor+batch.length,done=cursor===item.documents.length;
   latest.counts[item.category].deleted+=deleted;latest.counts[item.category].remaining=Math.max(0,latest.counts[item.category].remaining-deleted);
   latest.state='running';latest.leaseUntil=0;latest.updatedAt=now();
   tx.update(row.ref,{cursor,state:done?'deleted':'deleting'});tx.set(jobRef(job.id),latest);
   if(done&&collection==='newsletters'){
    if(id==='current')tx.set(db.doc('database_cleanup_fences/newsletters/records/current'),{jobId:job.id,descendantsOnly:true,createdAt:now()});
    else tx.set(db.doc(`newsletter_draft_cleanup/${id}`),{state:'purged',reason:'admin_database_cleanup',jobId:job.id,completedAt:new Date(now())},{merge:true});
   }
  });
 }
 async function finalize(job){
  // Final inventory is also checkpointed: no unbounded end-of-job collection scan.
  const counts=structuredClone(job.counts);
  if(job.verifyIndex===undefined){for(const category of job.categories)counts[category].remaining=0;return checkpoint(job,{verifyIndex:0,verifyPageToken:'',counts});}
  if(job.verifyIndex<job.scan.length){
   const scope=job.scan[job.verifyIndex],page=await listPage(scope.collection,job.verifyPageToken);
   for(const path of page.paths){const kind=await classification(path,scope.category);if(kind.skip)continue;const current=await tree(path);counts[scope.category].remaining+=current.documents.length;}
   return checkpoint(job,{counts,verifyIndex:page.next?job.verifyIndex:job.verifyIndex+1,verifyPageToken:page.next||''});
  }
  const held=Object.values(counts).some(count=>count.remaining||count.held||count.storageHeld),state=held?'completed_with_holds':'completed';
  return checkpoint(job,{state,counts,completedAt:now(),message:held?'Cleanup finished with retained records or files. No claim of a complete purge is made. Inspect the server-only manifest for hold categories.':'All confirmed category records were removed; unrelated data was preserved.'},(tx,latest)=>{
   tx.set(control,{jobId:null,collections:[],phase:state});tx.set(audit(job.id),{operatorUid:latest.operatorUid,initiatedBy:latest.initiatedBy,categories:latest.categories,confirmedAt:latest.confirmedAt,completedAt:latest.completedAt,outcome:state,counts:latest.counts});
  });
 }
 async function tick(){
  let job=await lease();if(!job)return false;
  try{
   await authorized(job.operatorUid);
   if(job.cancelRequested){
    // Retain partial-root fences and release the broader collection lock without further destruction.
    await checkpoint(job,{state:'cancelled',message:'Cleanup cancelled. Partial records remain fenced for review; already deleted data cannot be restored.'},(tx,latest)=>{
     tx.set(control,{jobId:null,collections:[],phase:'cancelled'});
     if(job.categories.includes('newsletters')&&job.confirmedAt)tx.set(db.doc('database_cleanup_fences/newsletters/records/current'),{jobId:job.id,descendantsOnly:true,createdAt:now()},{merge:true});
     if(job.confirmedAt)tx.set(audit(job.id),{operatorUid:latest.operatorUid,initiatedBy:latest.initiatedBy,categories:latest.categories,outcome:'cancelled',counts:latest.counts,completedAt:now()});
    });return true;
   }
   if(job.confirmedAt)await safety();
   if(job.state==='planning')await plan(job);else await remove(job);
  }catch(error){
   onError(error);
   if(['cleanup_record_changed','cleanup_reported_evidence','cleanup_retention_changed','cleanup_active_analysis'].includes(error.message)){
    const active=await jobRef(job.id).collection('items').where('path','==',job.currentPath).limit(1).get();
    if(!active.empty){await protectChanged(job,active.docs[0].ref,active.docs[0].data(),error.message);return true;}
   }
   const counts=structuredClone(job.counts);if(job.confirmedAt)counts[job.currentCategory||job.categories[0]].failed++;
   const code=error instanceof CleanupError?error.code:String(error.message||'').startsWith('nested_inventory')?'inventory_bound':'operation_failed';
   // Safe fixed-category errors only: never return resident content or raw transport responses.
   const cancelling=(await jobRef(job.id).get()).data()?.cancelRequested===true;
   await checkpoint(job,{state:cancelling?'queued':'paused',counts,completeInventory:code==='inventory_bound'?false:job.completeInventory,message:`Cleanup paused (${code}). Some data may remain. Refresh status before resuming.`}).catch(()=>{});
  }
  return true;
 }
 return {operate,tick};
}
module.exports={createCleanupService,createDocumentPager,CATEGORIES,PHRASE,protectedRecord,mediaReferences};
