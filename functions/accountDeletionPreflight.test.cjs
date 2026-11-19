const test=require('node:test'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const {memoryFirestore}=require('./testSupport/memoryFirestore.cjs');
const {DATABASES}=require('./accountDeletionScope.cjs');
const {preflightDeletion}=require('./accountDeletionPreflight.cjs');
const {processAccountMedia}=require('./accountDeletionMedia.cjs');
const provenance=require('./deletionMediaProvenance.json');
const sha=s=>createHash('sha256').update(s).digest('hex');
function fixture(){
 const path='marketplace/fixture.jpg',metadata={name:path,generation:'1',metageneration:'1',timeCreated:'2026-10-29T12:00:00Z',metadata:{securityVersion:'1',uploadedBy:'alice',collection:'marketplace_posts',recordId:'listing'}};
 const stores=DATABASES.map(()=>memoryFirestore());stores[0].records.set('marketplace_posts/listing',{userId:'alice',photos:[{url:path}]});
 for(const store of stores){const original=store.db.doc;const subs=prefix=>[...new Set([...store.records.keys()].filter(p=>p.startsWith(prefix)).map(p=>p.slice(prefix.length).split('/')).filter(p=>p.length>1).map(p=>p[0]))].map(id=>({id}));store.db.doc=p=>({...original(p),listCollections:async()=>subs(p+'/')});store.db.listCollections=async()=>subs('');}
 const dbFor=id=>stores[DATABASES.indexOf(id)].db,files=new Map([[path,metadata]]),deleted=[];
 const file=name=>({getMetadata:async()=>{if(!files.has(name)){const e=Error('gone');e.code=404;throw e;}return [files.get(name)];},delete:async guards=>{const m=files.get(name);assert.equal(guards.ifGenerationMatch,m.generation);assert.equal(guards.ifMetagenerationMatch,m.metageneration);deleted.push(name);files.delete(name);}});
 const bucket={file,getFiles:async()=>[[...files.keys()].map(name=>file(name)),null]};
 const mediaPolicy={ownerApproved:true,approvalReference:'fixture-approved',trustedUploadsAfter:{toMillis:()=>Date.parse('2026-10-23T12:00:00Z')},storageRulesSha256:provenance.storageRulesSha256,collections:{marketplace_posts:{action:'delete_linked_media_on_parent_deletion',reason:'approved fixture'}}};
 const job={id:'job',uid:'alice',createdAt:new Date('2026-10-28T12:00:00Z'),review:{decision:'approved',processingAuthorized:true}};
 return {path,metadata,stores,dbFor,files,deleted,bucket,mediaPolicy,job,options:{dbFor,bucket,mediaPolicy}};
}
test('preflight verifies both scopes and exact exclusive native photo provenance without storing content',async()=>{const h=fixture(),proof=await preflightDeletion(h.job,h.options);assert.equal(proof.scopes.length,2);assert.deepEqual(proof.holds,[]);assert.equal(proof.manifest[0].objectHash,sha(h.path));assert(!JSON.stringify(proof).includes('photos'));});
test('shared photo, conflicting uploader, unsupported private subcollection and unknown schema stop erasure',async()=>{for(const mode of ['shared','owner','private','unknown']){const h=fixture();if(mode==='shared')h.stores[1].records.set('posts/other',{userId:'bob',photoUrl:h.path});if(mode==='owner')h.metadata.metadata.uploadedBy='bob';if(mode==='private')h.stores[0].records.set('users/alice/unknown/record',{secret:'fixture'});if(mode==='unknown')h.stores[0].records.set('unknown/record',{uid:'alice'});const proof=await preflightDeletion(h.job,h.options);assert(proof.holds.length,mode);assert.equal(h.deleted.length,0);}});
test('account media deletion is exact, generation guarded, retryable and excludes unrelated jobs',async()=>{const h=fixture();h.job.preflight=await preflightDeletion(h.job,h.options);h.stores[0].records.delete('marketplace_posts/listing');h.stores[0].records.set('media_cleanup_jobs/a',{accountDeletionJobId:'job',uid:'alice',databaseId:DATABASES[0],collection:'marketplace_posts',recordId:'listing',objectHashes:[sha(h.path)],status:'queued'});h.stores[0].records.set('media_cleanup_jobs/unrelated',{accountDeletionJobId:'other',status:'queued'});await processAccountMedia(h.stores[0].db,h.job,h.options);await processAccountMedia(h.stores[0].db,h.job,h.options);assert.deepEqual(h.deleted,[h.path]);assert.equal(h.stores[0].records.get('media_cleanup_jobs/a').status,'complete');assert.equal(h.stores[0].records.get('media_cleanup_jobs/unrelated').status,'queued');});
test('object replacement or a newly shared reference blocks destruction and completion',async()=>{for(const mode of ['replacement','reference']){const h=fixture();h.job.preflight=await preflightDeletion(h.job,h.options);h.stores[0].records.delete('marketplace_posts/listing');h.stores[0].records.set('media_cleanup_jobs/a',{accountDeletionJobId:'job',uid:'alice',databaseId:DATABASES[0],collection:'marketplace_posts',recordId:'listing',objectHashes:[sha(h.path)],status:'queued'});if(mode==='replacement')h.metadata.generation='2';else h.stores[1].records.set('posts/other',{userId:'bob',photoUrl:h.path});await assert.rejects(processAccountMedia(h.stores[0].db,h.job,h.options));assert.equal(h.deleted.length,0);assert.equal(h.stores[0].records.get('media_cleanup_jobs/a').status,'queued');}});
test('a forged scope or quarantined manifest can never delete a file',async()=>{for(const mode of ['scope','quarantine']){const h=fixture();h.job.preflight=await preflightDeletion(h.job,h.options);h.stores[0].records.delete('marketplace_posts/listing');const job={accountDeletionJobId:'job',uid:'alice',databaseId:mode==='scope'?DATABASES[1]:DATABASES[0],collection:'marketplace_posts',recordId:'listing',objectHashes:[sha(h.path)],status:'queued'};h.stores[0].records.set('media_cleanup_jobs/a',job);if(mode==='quarantine'){h.job.preflight.manifest[0].objectHash=provenance.quarantinedObjectHashes[0];job.objectHashes=[provenance.quarantinedObjectHashes[0]];}await assert.rejects(processAccountMedia(h.stores[0].db,h.job,h.options));assert.equal(h.deleted.length,0);}});
test('an upload finishing after parent cleanup is removed using the original request-bound ownership receipt',async()=>{
 const h=fixture(),{reconcileLateAccountMedia}=require('./accountDeletionLateMedia.cjs');h.job.preflight=await preflightDeletion(h.job,h.options);h.stores[0].records.delete('marketplace_posts/listing');
 h.stores[0].records.set('media_cleanup_jobs/a',{accountDeletionJobId:'job',uid:'alice',databaseId:DATABASES[0],collection:'marketplace_posts',recordId:'listing',objectHashes:[sha(h.path)],status:'complete'});
 h.metadata.generation='2';const ref=h.stores[0].db.doc('account_deletion_jobs/job');await ref.create(h.job);
 await reconcileLateAccountMedia(h.stores[0].db,ref,h.job,h.options);assert.deepEqual(h.deleted,[h.path]);assert.equal((await ref.get()).data().preflight.manifest[0].generation,'2');
 await reconcileLateAccountMedia(h.stores[0].db,ref,(await ref.get()).data(),h.options);assert.equal(h.deleted.length,1);
});
test('late media without a verified deleted-parent receipt or with shared references is preserved for review',async()=>{for(const mode of ['unknown','shared']){
 const h=fixture(),{reconcileLateAccountMedia}=require('./accountDeletionLateMedia.cjs');h.job.preflight=await preflightDeletion(h.job,h.options);h.stores[0].records.delete('marketplace_posts/listing');
 if(mode==='shared'){h.stores[0].records.set('media_cleanup_jobs/a',{accountDeletionJobId:'job',uid:'alice',databaseId:DATABASES[0],collection:'marketplace_posts',recordId:'listing',objectHashes:[sha(h.path)],status:'complete'});h.stores[1].records.set('posts/other',{userId:'bob',mediaUrl:h.path});}
 const ref=h.stores[0].db.doc('account_deletion_jobs/job');await ref.create(h.job);await assert.rejects(reconcileLateAccountMedia(h.stores[0].db,ref,h.job,h.options));assert.equal(h.deleted.length,0);
}});
test('cleanup and late-upload reconciliation paginate beyond 100 completed parents',async()=>{for(const mode of ['ordinary','late']){
 const h=fixture();h.job.preflight=await preflightDeletion(h.job,h.options);h.stores[0].records.delete('marketplace_posts/listing');
 for(let n=0;n<100;n++)h.stores[0].records.set(`media_cleanup_jobs/${String(n).padStart(3,'0')}`,{accountDeletionJobId:'job',uid:'alice',databaseId:DATABASES[0],collection:'marketplace_posts',recordId:`empty${n}`,objectHashes:[],status:mode==='late'?'complete':'queued'});
 h.stores[0].records.set('media_cleanup_jobs/zzz',{accountDeletionJobId:'job',uid:'alice',databaseId:DATABASES[0],collection:'marketplace_posts',recordId:'listing',objectHashes:[sha(h.path)],status:mode==='late'?'complete':'queued'});
 if(mode==='ordinary')await processAccountMedia(h.stores[0].db,h.job,h.options);else {h.metadata.generation='2';const ref=h.stores[0].db.doc('account_deletion_jobs/job');await ref.create(h.job);await require('./accountDeletionLateMedia.cjs').reconcileLateAccountMedia(h.stores[0].db,ref,h.job,h.options);}
 assert.equal(h.stores[0].records.get('media_cleanup_jobs/zzz').status,'complete');assert.deepEqual(h.deleted,[h.path],mode);assert.equal([...h.stores[0].records.values()].filter(d=>d.accountDeletionJobId==='job'&&d.status==='complete').length,101);
}});

test('current server-only cleanup/routing/config metadata does not block unrelated residents; self references still hold',async()=>{const h=fixture();for(const db of h.stores){for(const collection of ['database_cleanup_audit','database_cleanup_control','database_cleanup_fences','database_cleanup_jobs','database_cleanup_policies','inbox_conversation_routes','security_controls'])db.records.set(collection+'/fixture',{operatorUid:'other-admin',reference:'opaque'});}assert.equal((await preflightDeletion(h.job,h.options)).holds.length,0);h.stores[0].records.set('database_cleanup_audit/relevant',{operatorUid:'alice',outcome:'retained audit'});const held=await preflightDeletion(h.job,h.options);assert(held.holds.some(x=>x.reason==='administrative_reference_requires_disposition'));assert.equal(h.deleted.length,0);});
test('external provider avatars do not require deletion of provider-owned objects; bucket avatars still require proof',async()=>{
 for(const avatar of ['https://lh3.googleusercontent.com/a/provider-avatar','https://firebasestorage.googleapis.com/v0/b/cc-livingcommunity-app.firebasestorage.app/o/feed%2Ffixture.jpg?alt=media']){
  const h=fixture();h.stores[0].records.set('users/alice',{uid:'alice',avatarUrl:avatar});const proof=await preflightDeletion(h.job,h.options);
  assert.equal(proof.holds.some(h=>h.reason==='avatar_object_ownership_adapter_required'),avatar.includes('firebasestorage'));
 }
});
test('receipt-only Inbox references and sender-only notifications participate in preflight without blanket holds',async()=>{
 const h=fixture();h.stores[0].records.set('inbox_conversations/c/messages/m',{senderId:'bob',visibility:['bob:1'],receipts:{'alice:2':{readAt:2}},receiptState:'sent'});
 h.stores[0].records.set('notification_events/n',{uid:'bob',senderId:'alice',target:'posts/p',seen:false});
 assert.deepEqual((await preflightDeletion(h.job,h.options)).holds,[]);
});
test('new timeout authorization permits only request-bound media work and invalid generations are rejected',async()=>{
 const h=fixture(),lifecycle=require('./accountDeletionLifecycle.cjs'),created=Date.now()-31*86400000,due=created+30*86400000;
 Object.assign(h.job,{workflowVersion:3,requestId:'request',status:'processing',createdAt:new Date(created),autoDeleteAt:new Date(due),authorization:{source:'pending_timeout',requestId:'request',policyReference:lifecycle.POLICY_ID,authorizedAt:new Date(),dueAt:new Date(due)}});delete h.job.review;
 h.job.preflight=await preflightDeletion(h.job,h.options);h.stores[0].records.delete('marketplace_posts/listing');h.stores[0].records.set('media_cleanup_jobs/a',{accountDeletionJobId:'job',uid:'alice',databaseId:DATABASES[0],collection:'marketplace_posts',recordId:'listing',objectHashes:[sha(h.path)],status:'queued'});
 await assert.rejects(processAccountMedia(h.stores[0].db,{...h.job,authorization:{...h.job.authorization,requestId:'old'}},h.options),/media_preflight_required/);
 await processAccountMedia(h.stores[0].db,h.job,h.options);assert.deepEqual(h.deleted,[h.path]);
});
test('late timeout media requires the same request generation as its preflight receipt',async()=>{
 const h=fixture(),lifecycle=require('./accountDeletionLifecycle.cjs'),created=Date.now()-31*86400000,due=created+30*86400000;
 Object.assign(h.job,{workflowVersion:3,requestId:'request',status:'processing',createdAt:new Date(created),autoDeleteAt:new Date(due),authorization:{source:'pending_timeout',requestId:'request',policyReference:lifecycle.POLICY_ID,authorizedAt:new Date(),dueAt:new Date(due)}});delete h.job.review;
 h.job.preflight=await preflightDeletion(h.job,h.options);assert.equal(h.job.preflight.requestId,'request');h.stores[0].records.delete('marketplace_posts/listing');h.stores[0].records.set('media_cleanup_jobs/a',{accountDeletionJobId:'job',uid:'alice',databaseId:DATABASES[0],collection:'marketplace_posts',recordId:'listing',objectHashes:[sha(h.path)],status:'complete'});
 const ref=h.stores[0].db.doc('account_deletion_jobs/job');await ref.create(h.job);const late=require('./accountDeletionLateMedia.cjs').reconcileLateAccountMedia;
 const stale={...h.job,preflight:{...h.job.preflight,requestId:'old'}};await assert.rejects(late(h.stores[0].db,ref,stale,h.options),/media_preflight_required/);await assert.rejects(processAccountMedia(h.stores[0].db,stale,h.options),/media_preflight_required/);
 await late(h.stores[0].db,ref,h.job,h.options);assert.deepEqual(h.deleted,[h.path]);
});
