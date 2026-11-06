const {test,before,beforeEach,after}=require('node:test');
const assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const req=createRequire(require.resolve('../../functions/package.json'));
const {initializeApp,deleteApp}=req('firebase-admin/app');
const {getFirestore}=req('firebase-admin/firestore');
const {createCleanupService,createDocumentPager}=require('../../functions/databaseCleanup.cjs');
const project='demo-townloop-cleanup-engine';
const host=process.env.FIRESTORE_EMULATOR_HOST;
if(!/^127\.0\.0\.1:\d+$/.test(host||''))throw Error('Loopback emulator required');
let app,db,service;let failOnce=false;let enabled=true;let onDelete=async()=>{};let pins=true;
before(()=>{app=initializeApp({projectId:project},'cleanup-engine');db=getFirestore(app);});
after(()=>deleteApp(app));
beforeEach(async()=>{
 await fetch(`http://${host}/emulator/v1/projects/${project}/databases/(default)/documents`,{method:'DELETE'});
 enabled=true;failOnce=false;onDelete=async()=>{};pins=true;
 await db.doc('users/admin').set({role:'admin',approved:true});
 service=createCleanupService({db,listPage:createDocumentPager({project,emulatorHost:host}),enabled:()=>enabled,
  verifySafety:async()=>pins,verifyIdentity:async uid=>({disabled:uid==='disabled'}),
  beforeDelete:async path=>{if(failOnce){failOnce=false;throw Error('injected transfer failure');}await onDelete(path);}});
});
async function review(categories=['workOrders'],requestId='request-0000001'){
 let job=await service.operate('admin',{action:'preview',categories,requestId});
 for(let i=0;job.state==='planning'&&i<100;i++){await service.tick();job=await service.operate('admin',{action:'status',jobId:job.id});}
 assert.equal(job.state,'review');return job;
}
async function confirm(job){return service.operate('admin',{action:'confirm',jobId:job.id,planHash:job.planHash,confirmation:'DELETE SELECTED DATA'});}
async function finish(job){for(let i=0;i<100;i++){await service.tick();job=await service.operate('admin',{action:'status',jobId:job.id});if(!['planning','queued','running'].includes(job.state))return job;}throw Error('Job did not finish');}
test('only approved canonical Admin can preview, with disabled/revoked accounts denied',async()=>{
 for(const [uid,role,approved] of [['vip','vip',true],['crew','crew',true],['resident','resident',true],['pending','admin',false],['disabled','admin',true]]){
  await db.doc(`users/${uid}`).set({role,approved});
  await assert.rejects(service.operate(uid,{action:'preview',categories:['workOrders'],requestId:'request-0000001'}),/approved Admin/);
 }
 await db.doc('account_access_revocations/admin').set({revoked:true});
 await assert.rejects(review(),/approved Admin/);
});
test('preview is read-only; typed confirmation binds categories/counts; nested selected records really delete',async()=>{
 await db.doc('work_orders/a').set({title:'synthetic'});
 await db.doc('work_orders/a/replies/x').set({text:'synthetic'});
 await db.doc('discussion_feed/b').set({title:'preserve'});
 await db.doc('resident_chats/private').set({messages:['preserve']});
 let job=await review();assert.equal(job.counts.workOrders.documents,2);
 assert.equal((await db.doc('work_orders/a').get()).exists,true);
 await assert.rejects(service.operate('admin',{action:'confirm',jobId:job.id,planHash:'wrong',confirmation:'DELETE SELECTED DATA'}),/preview/);
 await assert.rejects(service.operate('admin',{action:'confirm',jobId:job.id,planHash:job.planHash,confirmation:'delete'}),/confirmation/);
 await confirm(job);job=await finish(job);assert.equal(job.state,'completed');assert.equal(job.counts.workOrders.deleted,2);
 assert.equal((await db.doc('work_orders/a').get()).exists,false);
 assert.equal((await db.doc('work_orders/a/replies/x').get()).exists,false);
 assert.equal((await db.doc('discussion_feed/b').get()).exists,true);
 assert.equal((await db.doc('resident_chats/private').get()).exists,true);
 assert.equal((await db.doc('database_cleanup_fences/work_orders/records/a').get()).exists,true);
});
test('reports, legal holds and unproven/shared attachments are retained and counted honestly',async()=>{
 await db.doc('work_orders/reported').set({});
 await db.doc('moderation_reports/r').set({collection:'work_orders',id:'reported'});
 await db.doc('work_orders/legal').set({legalHold:true});
 await db.doc('work_orders/photo').set({photos:['work_orders/shared.jpg']});
 await db.doc('work_orders/good').set({});
 let job=await review();assert.equal(job.counts.workOrders.held,3);assert.equal(job.counts.workOrders.storageHeld,1);
 await confirm(job);job=await finish(job);assert.equal(job.state,'completed_with_holds');assert.equal(job.counts.workOrders.remaining,3);
 assert.equal((await db.doc('work_orders/photo').get()).exists,true);
});
test('idempotent requests, lease exclusion, transient failure and resume do not double count',async()=>{
 await db.doc('work_orders/a').set({});await db.doc('work_orders/a/replies/a').set({});
 const job=await review();assert.equal((await service.operate('admin',{action:'preview',categories:['workOrders'],requestId:'request-0000001'})).id,job.id);
 await confirm(job);await confirm(job);failOnce=true;
 let result=await finish(job);assert.equal(result.state,'paused');assert.equal(result.counts.workOrders.failed,1);
 await service.operate('admin',{action:'resume',jobId:job.id});
 await Promise.all([service.tick(),service.tick()]);result=await finish(job);
 assert.equal(result.state,'completed');assert.equal(result.counts.workOrders.deleted,2);
});
test('newsletter chunks/derived records delete; manual news, recurrence and published replacements are preserved',async()=>{
 await db.doc('newsletters/nov').set({uploadState:'published',pdfUrl:'firestore:nov',fileUrl:'firestore:nov'});
 await db.doc('newsletters/nov/chunks/0').set({data:'unchanged PDF bytes'});
 await db.doc('newsletters/current').set({id:'nov'});
 await db.doc('community_events/event').set({newsletterId:'nov',isAiExtracted:true});
 await db.doc('community_highlights/story').set({newsletterId:'nov',isAiExtracted:true});
 await db.doc('community_events/manual').set({isAiExtracted:false});
 await db.doc('community_events/ambiguous').set({isAiExtracted:true});
 await db.doc('home_activities/wii').set({recurrence:'weekly'});
 let job=await review(['newsletters']);await confirm(job);job=await finish(job);
 assert.equal(job.state,'completed_with_holds');assert.equal((await db.doc('newsletters/nov/chunks/0').get()).exists,false);
 for(const path of ['community_events/manual','community_events/ambiguous','home_activities/wii'])assert.equal((await db.doc(path).get()).exists,true);
 assert.equal((await db.doc('community_events/event').get()).exists,false);
 assert.equal((await db.doc('newsletter_draft_cleanup/nov').get()).data().state,'purged');
 assert.equal((await db.doc('database_cleanup_fences/newsletters/records/current').get()).data().descendantsOnly,true);
});
test('active Gemini work, changed previews, new records and revoked operators cannot be silently purged',async()=>{
 await db.doc('newsletters/nov').set({});await db.doc('newsletters/current').set({id:'nov'});
 await db.doc('newsletter_analysis_jobs/active').set({newsletterId:'nov',state:'running'});
 let job=await review(['newsletters']);assert.equal(job.counts.newsletters.held,3);await confirm(job);job=await finish(job);assert.equal(job.state,'completed_with_holds');
 await db.doc('work_orders/a').set({});let next=await review(['workOrders'],'request-0000002');
 await db.doc('work_orders/a').update({changed:true});await db.doc('work_orders/new').set({});
 await confirm(next);next=await finish(next);assert.equal(next.state,'completed_with_holds');assert.equal(next.counts.workOrders.remaining,2);
 next=await review(['discussion'],'request-0000003');await confirm(next);
 await db.doc('users/admin').update({role:'resident'});await service.tick();
 assert.equal((await db.doc(`database_cleanup_jobs/${next.id}`).get()).data().state,'paused');
});
test('destructive gate and safety pins fail closed; cancellation releases only the selected lock',async()=>{
 await db.doc('work_orders/a').set({});const job=await review();enabled=false;
 await assert.rejects(confirm(job),/disabled/);enabled=true;
 await confirm(job);await service.operate('admin',{action:'cancel',jobId:job.id});await service.tick();
 assert.equal((await db.doc('work_orders/a').get()).exists,true);
 assert.deepEqual((await db.doc('database_cleanup_control/active').get()).data().collections,[]);
});
test('reports arriving at the deletion boundary preserve evidence transactionally',async()=>{
 await db.doc('discussion_feed/post').set({});await db.doc('discussion_feed/post/comments/c').set({});
 let job=await review(['discussion']);await confirm(job);
 onDelete=async()=>{await db.doc('moderation_reports/new').set({collection:'discussion_feed',id:'post'});};
 job=await finish(job);assert.equal(job.state,'completed_with_holds');assert.equal(job.counts.discussion.deleted,0);
 assert.equal((await db.doc('discussion_feed/post/comments/c').get()).exists,true);
});
test('retention and nested evidence preserve the whole root, including related newsletter PDF',async()=>{
 await db.doc('work_orders/recent').set({status:'Done',retentionVersion:1,completedAt:new Date()});
 await db.doc('work_orders/childhold').set({});await db.doc('work_orders/childhold/replies/r').set({evidenceHold:true});
 let job=await review();assert.equal(job.counts.workOrders.held,2);await confirm(job);await finish(job);
 await db.doc('newsletters/nov').set({});await db.doc('newsletters/current').set({id:'nov'});
 await db.doc('newsletters/nov/chunks/0').set({data:'keep exact synthetic bytes'});
 await db.doc('community_events/event').set({newsletterId:'nov',isAiExtracted:true});
 await db.doc('moderation_reports/event').set({collection:'community_events',id:'event'});
 job=await review(['newsletters'],'request-0000002');assert.equal(job.counts.newsletters.held,3);await confirm(job);job=await finish(job);
 assert.equal((await db.doc('newsletters/nov/chunks/0').get()).exists,true);
 assert.equal(job.counts.newsletters.deleted,0);
});
test('partial batches resume exactly once and safe cancellation releases locks with fences retained',async()=>{
 await db.doc('work_orders/large').set({});
 const batch=db.batch();for(let i=0;i<105;i++)batch.set(db.doc(`work_orders/large/replies/${i}`),{text:'synthetic'});await batch.commit();
 let job=await review();assert.equal(job.counts.workOrders.documents,106);await confirm(job);await service.tick();
 job=await service.operate('admin',{action:'status',jobId:job.id});assert.equal(job.counts.workOrders.deleted,100);
 failOnce=true;job=await finish(job);assert.equal(job.state,'paused');
 await service.operate('admin',{action:'cancel',jobId:job.id});await service.tick();
 assert.equal((await db.doc(`database_cleanup_jobs/${job.id}`).get()).data().state,'cancelled');
 assert.deepEqual((await db.doc('database_cleanup_control/active').get()).data().collections,[]);
 assert.equal((await db.doc('database_cleanup_fences/work_orders/records/large').get()).exists,true);
 // A new explicitly confirmed job can finish the fenced remainder, without resetting IDs elsewhere.
 job=await review(['workOrders'],'request-0000002');assert.equal(job.counts.workOrders.documents,6);await confirm(job);job=await finish(job);assert.equal(job.state,'completed');
});
test('a changed partial root becomes a hold instead of endless retry; another Admin can cancel after role revocation',async()=>{
 await db.doc('work_orders/root').set({});let job=await review();await confirm(job);failOnce=true;await service.tick();
 await db.doc('work_orders/root').update({legalHold:true});await service.operate('admin',{action:'resume',jobId:job.id});job=await finish(job);assert.equal(job.state,'completed_with_holds');
 await db.doc('work_orders/other').set({});job=await review(['workOrders'],'request-0000002');await confirm(job);
 await db.doc('users/admin').update({role:'resident'});await service.tick();
 await db.doc('users/backup').set({role:'admin',approved:true});
 await service.operate('backup',{action:'cancel',jobId:job.id});await service.tick();
 assert.deepEqual((await db.doc('database_cleanup_control/active').get()).data().collections,[]);
});
test('missing parents are inventoried; all four categories stay independent; safety drift cannot delete',async()=>{
 await db.doc('work_orders/orphan/replies/r').set({});await db.doc('posts/old').set({});await db.doc('marketItems/old').set({});
 await db.doc('newsletters/draft/chunks/0').set({data:'synthetic PDF'});
 let job=await review(['workOrders','discussion','marketplace','newsletters']);assert.equal(job.counts.workOrders.documents,1);assert.equal(job.counts.newsletters.documents,1);
 pins=false;await assert.rejects(confirm(job),/safety configuration/);pins=true;await confirm(job);job=await finish(job);assert.equal(job.state,'completed');
 assert.equal(job.counts.discussion.deleted,1);assert.equal(job.counts.marketplace.deleted,1);
 assert.equal((await db.doc('users/admin').get()).exists,true);
});
test('a new hold on the root protects the first child batch, before the parent is reached',async()=>{
 await db.doc('work_orders/parent').set({});const batch=db.batch();
 for(let i=0;i<105;i++)batch.set(db.doc(`work_orders/parent/replies/${i}`),{});await batch.commit();
 let job=await review();await confirm(job);onDelete=()=>db.doc('work_orders/parent').update({legalHold:true});
 job=await finish(job);assert.equal(job.state,'completed_with_holds');assert.equal(job.counts.workOrders.deleted,0);
 assert.equal((await db.collection('work_orders/parent/replies').get()).size,105);
});
test('81 synthetic PDF chunks delete without another transfer or touching manual news',async()=>{
 await db.doc('newsletters/nov').set({pdfUrl:'firestore:nov',fileUrl:'firestore:nov'});
 const batch=db.batch();for(let i=0;i<81;i++)batch.set(db.doc(`newsletters/nov/chunks/${i}`),{index:i,data:'synthetic unmodified bytes'});await batch.commit();
 let job=await review(['newsletters']);assert.equal(job.counts.newsletters.documents,82);
 assert.equal((await db.doc('newsletters/nov/chunks/0').get()).data().data,'synthetic unmodified bytes');
 await confirm(job);job=await finish(job);assert.equal(job.state,'completed');assert.equal(job.counts.newsletters.deleted,82);
});
