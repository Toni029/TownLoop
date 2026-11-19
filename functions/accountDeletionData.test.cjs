const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {memoryFirestore}=require('./testSupport/memoryFirestore.cjs');
const retention=require('./accountDeletionRetention.cjs');
function executor(){const module={exports:{}};vm.runInNewContext(fs.readFileSync(require.resolve('./accountDeletionV2.cjs'),'utf8'),{module,exports:module.exports,Date,process,require:name=>name==='firebase-admin/firestore'?{FieldPath:{documentId:()=> '__name__'},FieldValue:{serverTimestamp:()=>new Date()}}:require(name)});return module.exports.processRetentionStep;}
function fixture(collection,record){const h=memoryFirestore({[`${collection}/record`]:record,'account_deletion_scopes/job':{uid:'alice'},'account_deletion_scopes/job/inventory/item':{path:`${collection}/record`,collection,state:'pending_redaction'}});const job={uid:'alice',phase:'v2_redact',createdAt:new Date(),review:{reviewedAt:new Date(),policyReference:retention.POLICY_ID}};const policy={ownerApproved:true,policyVersion:2,approvalReference:retention.POLICY_ID,identityCoverageVerified:true,mediaCoverageVerified:true,databaseScopeVerified:true,retentionDays:60,reviewBusinessDays:3,escalationCalendarDays:7,completionCalendarDays:7};return {...h,job,scope:{policy,databaseId:'(default)'},ref:h.db.doc('account_deletion_scopes/job')};}
test('removed own comment avatar/media copies get an exact cleanup receipt, other comments remain',async()=>{
 const h=fixture('posts',{userId:'bob',comments:[{authorId:'alice',authorAvatar:'feed/avatar.jpg'},{authorId:'bob',text:'Keep'}]});await executor()(h.db,{},h.ref,h.job,h.scope);
 const item=h.records.get('account_deletion_scopes/job/inventory/item');assert(item.cleanupJobId);const media=h.records.get(`media_cleanup_jobs/${item.cleanupJobId}`);assert.equal(media.commentAuthorOnly,true);assert.equal(media.objectHashes.length,1);assert.deepEqual(h.records.get('posts/record').comments,[{authorId:'bob',text:'Keep'}]);
});
test('maintenance replacement tracks any supported removed attachment shape',async()=>{
 const h=fixture('work_orders',{userId:'alice',mediaUrl:'work_orders/photo.jpg',status:'Done'});await executor()(h.db,{},h.ref,h.job,h.scope);const item=h.records.get('account_deletion_scopes/job/inventory/item');assert(item.cleanupJobId);assert.equal(h.records.get(`media_cleanup_jobs/${item.cleanupJobId}`).objectHashes.length,1);
});
test('new timeout and approval authorization execute data redaction without fabricated processingAuthorized review',async()=>{
 const lifecycle=require('./accountDeletionLifecycle.cjs');
 for(const source of ['pending_timeout','admin_approval']){
  const h=fixture('posts',{userId:'alice'}),created=Date.now()-31*86400000,due=created+30*86400000,at=new Date();
  Object.assign(h.job,{workflowVersion:3,requestId:'request',createdAt:new Date(created),autoDeleteAt:new Date(due),status:'processing',authorization:{source,requestId:'request',policyReference:lifecycle.POLICY_ID,authorizedAt:at,...(source==='pending_timeout'?{dueAt:new Date(due)}:{actorId:'admin'})}});
  if(source==='pending_timeout')delete h.job.review;else h.job.review={decision:'approved',reviewerId:'admin',reviewedAt:at};
  h.scope.policy={ownerApproved:true,policyVersion:3,approvalReference:lifecycle.POLICY_ID,pendingPeriodDays:30,executionMode:'firestore-event-v1',effectiveFrom:new Date(created-1),receiptRetentionDays:60,identityCoverageVerified:true,mediaCoverageVerified:true,databaseScopeVerified:true};
  await executor()(h.db,{},h.ref,h.job,h.scope);assert.equal(h.records.has('posts/record'),false,source);assert.equal(h.records.get('account_deletion_scopes/job/inventory/item').state,'redacted');
 }
});
