const {test,before,beforeEach,after}=require('node:test'),assert=require('node:assert/strict');
const {createRequire}=require('node:module'),req=createRequire(require.resolve('../../functions/package.json'));
const {initializeApp,deleteApp}=req('firebase-admin/app'),{getFirestore}=req('firebase-admin/firestore');
const {createStorageCleanup,canonicalPath}=require('../../functions/databaseCleanupStorage.cjs');
const {createDocumentPager,createCleanupService}=require('../../functions/databaseCleanup.cjs');
const project='demo-townloop-cleanup-storage',host=process.env.FIRESTORE_EMULATOR_HOST;
if(!/^127\.0\.0\.1:\d+$/.test(host||''))throw Error('Loopback emulator required');
let app,db,named,media,objects,deletes,ready,failDelete,bucketPolicy,historical,job;
const metadata=(name,collection='work_orders',recordId='a')=>({name,bucket:'cc-livingcommunity-app.firebasestorage.app',generation:'1',metageneration:'1',size:'123',timeCreated:'2026-11-01T00:00:00Z',metadata:{securityVersion:'1',collection,recordId,uploadedBy:'resident'}});
before(()=>{app=initializeApp({projectId:project},'storage-cleanup-test');db=getFirestore(app);named=getFirestore(app,'legacy-test');});
after(()=>deleteApp(app));
beforeEach(async()=>{
 await fetch(`http://${host}/emulator/v1/projects/${project}/databases/(default)/documents`,{method:'DELETE'});
 await fetch(`http://${host}/emulator/v1/projects/${project}/databases/legacy-test/documents`,{method:'DELETE'});
 ready=true;failDelete=false;objects=new Map();deletes=[];bucketPolicy={};historical=[];job={id:'cleanup_synthetic',categories:['workOrders'],operatorUid:'admin',lease:'synthetic-lease',state:'running'};
 const bucket={name:'cc-livingcommunity-app.firebasestorage.app',getMetadata:async()=>[bucketPolicy],getFiles:async({prefix,maxResults,versions,softDeleted})=>{const files=[...objects.keys()].filter(name=>name.startsWith(prefix)).map(name=>({name,metadata:objects.get(name)}));if(versions||softDeleted)files.push(...historical.filter(file=>file.name.startsWith(prefix)));return [files.slice(0,maxResults),files.length>maxResults?{pageToken:'more'}:null];},file:name=>({getMetadata:async()=>{if(!objects.has(name))throw Object.assign(Error('missing'),{code:404});return [objects.get(name)];},delete:async options=>{if(failDelete==='before'){failDelete=false;throw Error('network before commit');}if(!objects.has(name))throw Object.assign(Error('missing'),{code:404});if(options.ifGenerationMatch!==objects.get(name).generation||options.ifMetagenerationMatch!==objects.get(name).metageneration)throw Object.assign(Error('changed'),{code:412});deletes.push(name);objects.delete(name);if(failDelete){failDelete=false;throw Error('response lost after commit');}}})};
 media=createStorageCleanup({db,databases:[db,named],bucket,listPage:source=>createDocumentPager({project,databaseId:source.databaseId,emulatorHost:host}),deploymentReady:async()=>ready,verifyBarrier:async()=>{const c=(await db.doc('database_cleanup_control/active').get()).data();return c?.jobId===job.id&&c.referenceWritesBlocked===true;},trustedAfter:Date.parse('2026-10-25T00:00:00Z')});
 await db.doc('users/admin').set({role:'admin',approved:true});await db.doc('work_orders/a').set({photos:['work_orders/photo.jpg']});
 await db.doc('database_cleanup_jobs/cleanup_synthetic').set(job);
 objects.set('work_orders/photo.jpg',metadata('work_orders/photo.jpg'));
});
const item=()=>({path:'work_orders/a',category:'workOrders',reason:null});
async function lock(){await db.doc('database_cleanup_control/active').set({jobId:job.id,referenceWritesBlocked:true,collections:['work_orders']});}
test('canonical identity removes tokens and refuses private/foreign paths',()=>{
 assert.equal(canonicalPath('https://firebasestorage.googleapis.com/v0/b/cc-livingcommunity-app.firebasestorage.app/o/work_orders%2Fphoto.jpg?alt=media&token=SECRET'),'work_orders/photo.jpg');
 for(const path of ['inbox_groups/private/file.jpg','avatars/a.jpg','gs://foreign/work_orders/a.jpg','work_orders/../private.jpg'])assert.equal(canonicalPath(path),null);
});
test('read-only preview finds exact owned file scope and deletion requires reference barrier',async()=>{
 let result=await media.planRoot(job,item());assert.equal(result.reason,null);assert.equal(result.files.length,1);assert.equal(result.files[0].status,'exclusive');assert.equal(deletes.length,0);
 await assert.rejects(media.removeRoot(job,item(),async()=>{}),/reference_writers_unfenced/);
 await lock();await media.removeRoot(job,item(),async()=>{});assert.deepEqual(deletes,['work_orders/photo.jpg']);
 const scope=await media.summary(job);assert.equal(scope.workOrders.files,1);assert.equal(scope.workOrders.bytes,123);assert.equal(scope.workOrders.remaining,0);
 assert.equal((await media.scope(job)).items[0].status,'deleted');
});
test('other categories, private messages, profiles, reports and nested references hold the owning root',async()=>{
 for(const path of ['marketplace_posts/other','inbox_conversations/private/messages/message','users/neighbor','moderation_reports/evidence']){
  await db.doc(path).set({attachments:[{url:'gs://cc-livingcommunity-app.firebasestorage.app/work_orders/photo.jpg'}]});
  const result=await media.planRoot(job,item());assert.equal(result.reason,'shared_reference');assert.equal(result.files[0].status,'held');await db.doc(path).delete();
 }
 assert.equal(deletes.length,0);
});
test('missing metadata, missing files, legal evidence, unverified newsletter files and foreign references remain held',async()=>{
 objects.get('work_orders/photo.jpg').metadata={};assert.equal((await media.planRoot(job,item())).reason,'metadata_missing');
 objects.clear();assert.equal((await media.planRoot(job,item())).reason,'file_missing');
 objects.set('work_orders/photo.jpg',metadata('work_orders/photo.jpg'));assert.equal((await media.planRoot(job,{...item(),reason:'retention_or_evidence_hold'})).reason,'protected_record');
 await db.doc('newsletters/nov').set({pdfUrl:'newsletters/nov/document.pdf'});objects.set('newsletters/nov/document.pdf',metadata('newsletters/nov/document.pdf','newsletters','nov'));
 assert.equal((await media.planRoot({...job,categories:['newsletters']},{path:'newsletters/nov',category:'newsletters'})).reason,'newsletter_storage_unverified');
});
test('generation replacement and a new shared reference after preview cannot be deleted',async()=>{
 await media.planRoot(job,item());await lock();objects.get('work_orders/photo.jpg').generation='2';
 await assert.rejects(media.removeRoot(job,item(),async()=>{}),/object_changed/);assert.equal(deletes.length,0);
 objects.get('work_orders/photo.jpg').generation='1';await db.doc('users/neighbor').set({avatarUrl:'work_orders/photo.jpg'});
 await assert.rejects(media.removeRoot(job,item(),async()=>{}),/shared_reference/);assert.equal(deletes.length,0);
});
test('lost success response retries use durable intent and never delete a replacement or double count',async()=>{
 await media.planRoot(job,item());await lock();failDelete=true;
 await assert.rejects(media.removeRoot(job,item(),async()=>{}),/response lost/);
 await media.removeRoot(job,item(),async()=>{});await media.removeRoot(job,item(),async()=>{});
 assert.equal(deletes.length,1);assert.equal((await media.summary(job)).workOrders.remaining,0);
});
test('unfenced deployments and orphan/ambiguous files are explicit held scope entries',async()=>{
 ready=false;assert.equal((await media.planRoot(job,item())).reason,'reference_writers_unfenced');ready=true;
 objects.set('work_orders/orphan.jpg',metadata('work_orders/orphan.jpg','work_orders','gone'));
 await media.planRoot(job,item());await media.inventoryOrphans(job);
 const summary=await media.summary(job);assert.equal(summary.workOrders.files,2);assert.equal(summary.workOrders.held,1);
 const page=await media.scope(job);assert.equal(page.items.length,2);assert.equal(page.items.find(f=>f.path.endsWith('orphan.jpg')).reason,'ownership_unverified');
 assert.equal(deletes.length,0);
});
test('Markdown/prose and truthy toMillis maps cannot conceal shared Inbox attachments',async()=>{
 for(const data of [
  {body:'[photo](https://storage.googleapis.com/cc-livingcommunity-app.firebasestorage.app/work_orders/photo.jpg)'},
  {body:'See https://storage.googleapis.com/cc-livingcommunity-app.firebasestorage.app/work_orders/photo.jpg.'},
  {attachments:{toMillis:true,url:'work_orders/photo.jpg'}},
 ]){await db.doc('inbox_conversations/private/messages/c').set(data);assert.equal((await media.planRoot(job,item())).reason,'shared_reference');}
 assert.equal(deletes.length,0);
});
test('object holds, bucket retention, soft deletion and versioning block physical-purge claims',async()=>{
 for(const policy of [{softDeletePolicy:{retentionDurationSeconds:'604800'}},{versioning:{enabled:true}},{retentionPolicy:{retentionPeriod:'86400'}}]){bucketPolicy=policy;assert.equal((await media.planRoot(job,item())).reason,'protected_record');}
 bucketPolicy={};objects.get('work_orders/photo.jpg').temporaryHold=true;assert.equal((await media.planRoot(job,item())).reason,'protected_record');
 assert.equal(deletes.length,0);
});
test('a stale lease cannot create a deletion intent after cancellation/takeover',async()=>{
 await media.planRoot(job,item());await lock();let assertions=0;
 await assert.rejects(media.removeRoot(job,item(),async()=>{if(++assertions===2)await db.doc(`database_cleanup_jobs/${job.id}`).update({lease:'other-worker'});}),/cleanup_claim_lost/);
 assert.equal(deletes.length,0);assert.equal(await media.noInFlight(job),true);
});
test('an unresolved external delete intent must settle before a write barrier may be released',async()=>{
 await media.planRoot(job,item());await lock();failDelete=true;
 await assert.rejects(media.removeRoot(job,item(),async()=>{}),/response lost/);assert.equal(await media.noInFlight(job),false);
 assert.equal(await media.settle(job,async()=>{}),false);assert.equal(await media.noInFlight(job),true);
 assert.equal(await media.settle(job,async()=>{}),true);assert.equal(deletes.length,1);
});
test('the complete cleanup job deletes exclusive Storage and Firestore together, with exact preview and retry counts',async()=>{
 const engine=createCleanupService({db,media,listPage:createDocumentPager({project,emulatorHost:host}),enabled:()=>true,verifySafety:async()=>true,verifyIdentity:async()=>({disabled:false})});
 let view=await engine.operate('admin',{action:'preview',categories:['workOrders'],requestId:'storage-integration-1'});job={...job,id:view.id};
 for(let i=0;view.state==='planning'&&i<100;i++){await engine.tick();view=await engine.operate('admin',{action:'status',jobId:view.id});}
 assert.equal(view.state,'review');assert.equal(view.storageScope.workOrders.exclusive,1);assert.equal((await db.doc('work_orders/a').get()).exists,true);assert.equal(deletes.length,0);
 const request={action:'confirm',jobId:view.id,planHash:view.planHash,confirmation:'DELETE SELECTED DATA'};
 await engine.operate('admin',request);await engine.operate('admin',request);
 for(let i=0;i<100;i++){await engine.tick();view=await engine.operate('admin',{action:'status',jobId:view.id});if(!['queued','running'].includes(view.state))break;}
 assert.equal(view.state,'completed');assert.equal(view.counts.workOrders.deleted,1);assert.equal(view.counts.workOrders.storageDeleted,1);assert.equal(view.storageScope.workOrders.remaining,0);assert.equal(deletes.length,1);
 assert.equal((await db.doc('work_orders/a').get()).exists,false);assert.equal((await db.doc('users/admin').get()).exists,true);
 assert.deepEqual((await db.doc('database_cleanup_control/active').get()).data().collections,[]);
});

test('excessively ambiguous punctuation fails closed instead of hiding a shared reference',async()=>{
 await db.doc('inbox_conversations/private/messages/c').set({body:'[photo](https://storage.googleapis.com/cc-livingcommunity-app.firebasestorage.app/work_orders/photo.jpg'+')'.repeat(17)});
 assert.equal((await media.planRoot(job,item())).reason,'inventory_incomplete');assert.equal(deletes.length,0);
});
test('a shared reference in the named database protects default-database media',async()=>{
 await named.doc('private_messages/legacy').set({image:'work_orders/photo.jpg'});
 assert.equal((await media.planRoot(job,item())).reason,'shared_reference');assert.equal(deletes.length,0);
});
test('a sealed finalization phase prevents a stale worker from claiming any new delete',async()=>{
 await media.planRoot(job,item());await lock();await db.doc(`database_cleanup_jobs/${job.id}`).update({finalizing:true});
 await assert.rejects(media.removeRoot(job,item(),async()=>{}),/cleanup_claim_lost/);assert.equal(deletes.length,0);
});
test('cancellation drains lost-success intent, preserves parent and records exact partial outcome',async()=>{
 const engine=createCleanupService({db,media,listPage:createDocumentPager({project,emulatorHost:host}),enabled:()=>true,verifySafety:async()=>true,verifyIdentity:async()=>({disabled:false})});
 let view=await engine.operate('admin',{action:'preview',categories:['workOrders'],requestId:'storage-cancellation-1'});job={...job,id:view.id};
 for(let i=0;view.state==='planning'&&i<100;i++){await engine.tick();view=await engine.operate('admin',{action:'status',jobId:view.id});}
 await engine.operate('admin',{action:'confirm',jobId:view.id,planHash:view.planHash,confirmation:'DELETE SELECTED DATA'});failDelete=true;
 await engine.tick();view=await engine.operate('admin',{action:'status',jobId:view.id});assert.equal(view.state,'paused');
 await engine.operate('admin',{action:'cancel',jobId:view.id});
 for(let i=0;i<5;i++){await engine.tick();view=await engine.operate('admin',{action:'status',jobId:view.id});if(view.state==='cancelled')break;}
 assert.equal(view.state,'cancelled');assert.equal(view.counts.workOrders.storageDeleted,1);assert.equal(view.counts.workOrders.deleted,0);
 assert.equal((await db.doc('work_orders/a').get()).exists,true);assert.equal(deletes.length,1);
 assert.equal((await db.doc('database_cleanup_control/active').get()).data().jobId,null);
 assert.equal((await db.doc(`database_cleanup_jobs/${job.id}`).get()).data().finalizing,true);
});

test('noncurrent and soft-deleted generations remain counted even when bucket policies are disabled',async()=>{
 historical.push({name:'work_orders/photo.jpg',metadata:{...metadata('work_orders/photo.jpg'),generation:'9'}},{name:'work_orders/older.jpg',metadata:{...metadata('work_orders/older.jpg'),generation:'8',softDeleteTime:'2026-11-01T00:00:00Z'}});
 await media.planRoot(job,item());await media.inventoryOrphans(job);
 const scope=await media.summary(job);assert.equal(scope.workOrders.files,3);assert.equal(scope.workOrders.held,2);
 assert.equal((await media.scope(job)).items.filter(file=>file.reason==='protected_record').length,2);assert.equal(deletes.length,0);
});
test('a descendant hold blocks intent redrive and keeps the write barrier safely closed',async()=>{
 await db.doc('work_orders/a/comments/evidence').set({text:'synthetic'});
 const engine=createCleanupService({db,media,listPage:createDocumentPager({project,emulatorHost:host}),enabled:()=>true,verifySafety:async()=>true,verifyIdentity:async()=>({disabled:false})});
 let view=await engine.operate('admin',{action:'preview',categories:['workOrders'],requestId:'storage-held-intent-1'});job={...job,id:view.id};
 for(let i=0;view.state==='planning'&&i<100;i++){await engine.tick();view=await engine.operate('admin',{action:'status',jobId:view.id});}
 await engine.operate('admin',{action:'confirm',jobId:view.id,planHash:view.planHash,confirmation:'DELETE SELECTED DATA'});failDelete='before';await engine.tick();
 assert.equal(await media.noInFlight(job),false);await db.doc('work_orders/a/comments/evidence').update({legalHold:true});
 await engine.operate('admin',{action:'cancel',jobId:view.id});await engine.tick();view=await engine.operate('admin',{action:'status',jobId:view.id});
 assert.equal(view.state,'paused');assert.equal(deletes.length,0);assert.equal((await db.doc('database_cleanup_control/active').get()).data().referenceWritesBlocked,true);
});
