'use strict';
const {test,before,beforeEach,after}=require('node:test');
const assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const req=createRequire(require.resolve('../../functions/package.json'));
const {initializeApp,deleteApp}=req('firebase-admin/app');
const {getFirestore}=req('firebase-admin/firestore');
const {createSocialReferenceFence,assertSocialReferenceWritesAllowed}=require('../../functions/socialMediaLifecycleFence.cjs');
const {scanReferences}=require('../../functions/socialMediaLifecycleEntry.cjs');
const {createDocumentPager}=require('../../functions/databaseCleanup.cjs');
const {BUCKET}=require('../../functions/socialMediaLifecycle.cjs');
const host=process.env.FIRESTORE_EMULATOR_HOST,project='demo-townloop-social-lifecycle';
if(!/^127\.0\.0\.1:\d+$/.test(host||''))throw Error('Explicit loopback emulator required');
let app,db,named,fence,calls,networkFail,ready;
before(()=>{app=initializeApp({projectId:project},'social-lifecycle');db=getFirestore(app);named=getFirestore(app,require('../../functions/accountDeletionScope.cjs').DATABASES[1]);});
after(()=>deleteApp(app));
beforeEach(async()=>{
 for(const id of ['(default)',require('../../functions/accountDeletionScope.cjs').DATABASES[1]])await fetch(`http://${host}/emulator/v1/projects/${project}/databases/${id}/documents`,{method:'DELETE'});
 calls=[];networkFail=false;ready=true;
 const readOnly=new Proxy(named,{get(target,key){if(['runTransaction','batch','bulkWriter'].includes(key))throw Error('Named writes prohibited');return typeof target[key]==='function'?target[key].bind(target):target[key];}});
 fence=createSocialReferenceFence({controlDb:db,databases:[db,readOnly],bucket:{name:BUCKET,file:path=>({delete:async conditions=>{calls.push({path,conditions});if(networkFail)throw Error('network');}})},deploymentReady:async()=>ready});
});
test('readiness is failclosed; fence blocks transactional Admin writes; named database never receives control writes',async()=>{
 ready=false;await assert.rejects(fence.run('job',async()=>{}),/unfenced/);assert.equal((await db.doc('social_media_control/active').get()).exists,false);
 ready=true;await fence.run('job',async check=>{
  assert.equal(await check(),true);
  await assert.rejects(db.runTransaction(async tx=>{await assertSocialReferenceWritesAllowed(tx,db);tx.set(db.doc('private_chats/a'),{text:'blocked'});}),/in_progress/);
  assert.equal((await named.doc('social_media_control/active').get()).exists,false);
 });
 assert.equal((await db.doc('social_media_control/active').get()).data().blocked,false);
});
test('uncertain Storage outcomes persist lock; competing job cannot enter; original exact-generation retry settles',async()=>{
 networkFail=true;
 await assert.rejects(fence.run('job',async(_,remove)=>remove('marketplace/a.jpg',{ifGenerationMatch:'9',ifMetagenerationMatch:'3'})),/in_flight/);
 assert.equal((await db.doc('social_media_control/active').get()).data().blocked,true);
 await assert.rejects(fence.run('other',async()=>{}),/unfenced/);
 networkFail=false;await fence.run('job',async()=>{});
 assert.equal(calls.length,2);assert.deepEqual(calls[0],calls[1]);
 assert.equal((await db.doc('social_media_control/active').get()).data().blocked,false);
});
test('reference inventory includes private message text, named database and missing-parent descendants without deleting chat',async()=>{
 const name='marketplace/a.jpg';await named.doc('private_chats/missing/messages/a').set({text:`Preserve [photo](https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/marketplace%2Fa.jpg?alt=media).`});
 const args={databases:[db,named],listPage:source=>createDocumentPager({project,databaseId:source.databaseId,emulatorHost:host}),name};
 assert.equal((await scanReferences(args)).shared,true);
 assert.equal((await named.doc('private_chats/missing/messages/a').get()).exists,true);
 await assert.rejects(scanReferences({...args,maxDocuments:0}),/inventory_incomplete/);
});
test('unknown media references conservatively report ambiguity',async()=>{
 await db.doc('private_chats/a').set({attachmentUrl:'https://legacy.example/photo'});
 const result=await scanReferences({databases:[db,named],listPage:source=>createDocumentPager({project,databaseId:source.databaseId,emulatorHost:host}),name:'feed/a.jpg'});
 assert.equal(result.ambiguous,true);assert.equal(result.shared,false);
});
test('Firebase adapter queues idempotently, deletes only safe media and reports private-chat retention',async()=>{
 const {createSocialMediaLifecycleHandlers}=require('../../functions/socialMediaLifecycleEntry.cjs');
 const {eventJob}=require('../../functions/socialMediaLifecycle.cjs');
 const {Timestamp}=req('firebase-admin/firestore');
 const provenance=require('../../functions/deletionMediaProvenance.json');
 await db.doc('deletion_policies/media').set({ownerApproved:true,approvalReference:'synthetic',trustedUploadsAfter:Timestamp.fromMillis(1),storageRulesSha256:provenance.storageRulesSha256,collections:{marketplace_posts:{action:'delete_linked_media_on_parent_deletion',reason:'synthetic'}}});
 const metadata={name:'marketplace/a.jpg',bucket:BUCKET,generation:'7',metageneration:'2',timeCreated:new Date(Date.now()-72*3600000).toISOString(),metadata:{securityVersion:'1',collection:'marketplace_posts',recordId:'a',uploadedBy:'seller'}};
 const files=new Map([[metadata.name,metadata]]),deleted=[];
 const object=name=>({name,getMetadata:async()=>{if(!files.has(name))throw Object.assign(Error('missing'),{code:404});return [files.get(name)];},delete:async conditions=>{assert.deepEqual(conditions,{ifGenerationMatch:'7',ifMetagenerationMatch:'2'});deleted.push(name);files.delete(name);}});
 const bucket={name:BUCKET,getMetadata:async()=>[{}],getFiles:async()=>[[...files.keys()].map(object),{}],file:object};
 const service=createSocialMediaLifecycleHandlers({db,databases:[db,named],bucket,listPage:source=>createDocumentPager({project,databaseId:source.databaseId,emulatorHost:host}),enabled:()=>true,queueEnabled:()=>true,deploymentReady:async()=>true});
 const job=eventJob({databaseId:'(default)',collection:'marketplace_posts',recordId:'a',eventId:'synthetic-event',before:{userId:'seller',media:[metadata.name]},after:null});
 await service.queue(job);await service.queue(job);assert.equal((await db.collection('social_media_jobs').get()).size,1);
 await service.tick();assert.deepEqual(deleted,[metadata.name]);assert.equal((await db.doc(`social_media_jobs/${job.id}`).get()).data().status,'complete');
 files.set(metadata.name,metadata);await db.doc('private_chats/preserved').set({text:metadata.name});
 const second={...job,id:'second-synthetic-job'};await service.queue(second);await service.tick();
 const result=(await db.doc(`social_media_jobs/${second.id}`).get()).data();assert.equal(result.status,'retained');assert.equal(result.unresolved[0].reason,'shared_reference');assert.equal(files.size,1);assert.equal((await db.doc('private_chats/preserved').get()).exists,true);
});
test('scoped Firebase adapter persists soft recovery generations across partial failure and verifies expiry via soft-deleted GET',async()=>{
 const {createSocialMediaLifecycleHandlers}=require('../../functions/socialMediaLifecycleEntry.cjs');
 const {eventJob}=require('../../functions/socialMediaLifecycle.cjs');
 const {Timestamp}=req('firebase-admin/firestore'),provenance=require('../../functions/deletionMediaProvenance.json');
 let clock=Date.now(),fail=true;const week=7*86400000;
 await db.doc('deletion_policies/media').set({ownerApproved:true,approvalReference:'synthetic',trustedUploadsAfter:Timestamp.fromMillis(1),storageRulesSha256:provenance.storageRulesSha256,collections:{marketplace_posts:{action:'delete_linked_media_on_parent_deletion',reason:'synthetic'}}});
 const metadata=name=>({name,bucket:BUCKET,generation:name.endsWith('a.jpg')?'70':'71',metageneration:'2',timeCreated:new Date(clock-72*3600000).toISOString(),metadata:{securityVersion:'1',collection:'marketplace_posts',recordId:'a',uploadedBy:'seller'}});
 const live=new Map(['marketplace/a.jpg','marketplace/b.jpg'].map(name=>[name,metadata(name)])),soft=new Map(),softReads=[];
 const missing=()=>Object.assign(Error('missing'),{code:404});
 const file=(name,options={})=>({name,getMetadata:async()=>{const row=live.get(name);if(!row||options.generation&&options.generation!==row.generation)throw missing();return [row];},get:async opts=>{assert.equal(opts.softDeleted,true);assert.ok(options.generation);softReads.push(options.generation);const row=soft.get(name);if(!row||row.generation!==options.generation||clock>=Date.parse(row.hardDeleteTime))throw missing();return [{metadata:row}];},delete:async conditions=>{if(name.endsWith('b.jpg')&&fail)throw Error('synthetic network failure');const row=live.get(name);if(!row)throw missing();assert.equal(conditions.ifGenerationMatch,row.generation);soft.set(name,{...row,softDeleteTime:new Date(clock).toISOString(),hardDeleteTime:new Date(clock+week).toISOString()});live.delete(name);}});
 const bucket={name:BUCKET,getMetadata:async()=>[{softDeletePolicy:{retentionDurationSeconds:'604800'}}],getFiles:async()=>[[...live.keys()].map(name=>file(name)),{}],file};
 const service=createSocialMediaLifecycleHandlers({db,databases:[db,named],bucket,now:()=>clock,listPage:source=>createDocumentPager({project,databaseId:source.databaseId,emulatorHost:host}),enabled:()=>true,queueEnabled:()=>true,deploymentReady:async()=>true});
 const job=eventJob({databaseId:'(default)',collection:'marketplace_posts',recordId:'a',eventId:'soft-event',before:{userId:'seller',media:[...live.keys()]},after:null,now:clock});await service.queue(job);await service.tick();
 let result=(await db.doc(`social_media_jobs/${job.id}`).get()).data();assert.equal(result.status,'retained');assert.equal(result.recovery.length,2);assert.equal(live.size,1);assert.equal((await db.doc('social_media_control/active').get()).data().blocked,true);
 fail=false;clock+=20*60000;await service.tick();result=(await db.doc(`social_media_jobs/${job.id}`).get()).data();assert.equal(result.status,'recovery_pending');assert.equal(live.size,0);assert.ok(result.recovery.every(row=>row.hardDeleteAt>clock));assert.equal((await db.doc('social_media_control/active').get()).data().blocked,false);
 clock+=week+1;await service.tick();result=(await db.doc(`social_media_jobs/${job.id}`).get()).data();assert.equal(result.status,'complete');assert.ok(result.recovery.every(row=>row.status==='verified_expired'));assert.ok(softReads.includes('70')&&softReads.includes('71'));
});
