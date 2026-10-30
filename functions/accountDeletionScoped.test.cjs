const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {memoryFirestore}=require('./testSupport/memoryFirestore.cjs');
const {advanceScopedDeletion}=require('./accountDeletionScoped.cjs');
const {DATABASES}=require('./accountDeletionScope.cjs');
const {jobIdFor,SHARED}=require('./accountDeletionPolicy.cjs');
const retention=require('./accountDeletionRetention.cjs');
function fixture(extra={}) {
 let now=Date.parse('2026-10-26T14:00:00Z');const id=jobIdFor('alice');
 const policy={ownerApproved:true,policyVersion:2,approvalReference:retention.POLICY_ID,identityCoverageVerified:true,mediaCoverageVerified:true,databaseScopeVerified:true,retentionDays:60,reviewBusinessDays:3,escalationCalendarDays:7,completionCalendarDays:7,scopeWriteFreezeVerified:Object.fromEntries(DATABASES.map(id=>[id,true])),scopeRuleHashes:Object.fromEntries(DATABASES.map((id,i)=>[id,String(i+1).repeat(64)])),tokenDrainMs:3900000};
 const job={uid:'alice',processingProtocol:3,policyVersion:2,phase:'requested',status:'queued',createdAt:new Date(now-86400000),review:{decision:'approved',processingAuthorized:true,reviewerId:'manager',reviewedAt:new Date(now-1000),policyReference:retention.POLICY_ID}};
 const scopes=DATABASES.map((_,i)=>memoryFirestore({'users/alice':{id:'alice',approved:true},'users/bob':{id:'bob',approved:true},'resident_directory/alice':{name:'fixture'},'posts/own':{userId:'alice',title:'synthetic'},'posts/shared':{userId:'bob',comments:[{authorId:'alice',text:'remove synthetic'},{authorId:'bob',text:'keep synthetic'}]},'work_orders/ticket':{userId:'alice',code:'1234',ticketNumber:1234,status:'Done',description:'synthetic',comments:[]},'work_order_numbers/1234':{orderId:'ticket'},'user_blocks/bob/targets/alice':{createdAt:new Date(now)},'user_blocks/bob/targets/charlie':{createdAt:new Date(now)},...extra}));
 const control=scopes[0];control.records.set('deletion_policies/account',policy);control.records.set(`account_deletion_jobs/${id}`,job);
 const calls=[],auth={getUser:async uid=>({uid}),updateUser:async(uid,patch)=>calls.push(['disable',uid,patch]),revokeRefreshTokens:async uid=>calls.push(['revoke',uid]),deleteUser:async uid=>calls.push(['delete',uid])};
 const module={exports:{}};vm.runInNewContext(fs.readFileSync(require.resolve('./accountDeletionV2.cjs'),'utf8'),{module,exports:module.exports,Date,process,require:name=>name==='firebase-admin/firestore'?{FieldPath:{documentId:()=> '__name__'},FieldValue:{serverTimestamp:()=>new Date(now)}}:require(name)});
 const ref=control.db.doc(`account_deletion_jobs/${id}`),dbFor=id=>scopes[DATABASES.indexOf(id)].db;
 return {scopes,control,ref,calls,policy,get now(){return now;},advance(days){now+=days*86400000;},async step(){const job=(await ref.get()).data();await advanceScopedDeletion(control.db,auth,ref,job,{dbFor,step:module.exports.processRetentionStep,clearWebAccess:async()=>calls.push(['bridge_closed']),now,clock:()=>now});},async run(){for(let n=0;n<320;n++){const job=(await ref.get()).data();if(job.phase==='scoped_drain')now=job.tokensDrainUntil+1;if(['retention_pending','needs_review','waiting_for_media'].includes(job.status))return;await this.step();if(!extra['posts/own']?.photoUrl)for(const scope of scopes)for(const [path,media]of scope.records)if(path.startsWith('media_cleanup_jobs/')&&media.status==='queued')scope.records.set(path,{...media,status:'complete',fixtureEvidence:'verified empty Storage inventory'});}throw Error('fixture did not settle');}};
}
test('both databases complete independently before one Auth deletion; others and reservations survive',async()=>{
 const old=process.env.TOWNLOOP_ACCOUNT_DELETION_ENABLED;process.env.TOWNLOOP_SCOPED_DELETION_ENABLED='true';process.env.TOWNLOOP_ACCOUNT_DELETION_ENABLED='true';
 try{const h=fixture();await h.run();const root=(await h.ref.get()).data();assert.equal(root.status,'retention_pending');assert.deepEqual(root.databaseCompletion.map(s=>s.databaseId),DATABASES);assert.equal(h.calls.filter(c=>c[0]==='delete').length,1);assert.deepEqual(h.calls.at(-2),['bridge_closed']);
 for(const scope of h.scopes){assert.equal(scope.records.has('users/alice'),false);assert.equal(scope.records.has('posts/own'),false);assert.ok(scope.records.has('users/bob'));assert.equal(scope.records.has('user_blocks/bob/targets/alice'),false);assert.ok(scope.records.has('user_blocks/bob/targets/charlie'));assert.ok(scope.records.has('work_order_numbers/1234'));assert.deepEqual(scope.records.get('posts/shared').comments,[{authorId:'bob',text:'keep synthetic'}]);assert.equal(scope.records.get('work_orders/ticket').userId,undefined);}
 await h.step();assert.equal(h.calls.filter(c=>c[0]==='delete').length,1);
 h.advance(61);for(let n=0;n<12&&h.control.records.has(h.ref.path);n++)await h.step();assert.equal(h.control.records.has(h.ref.path),false);for(const scope of h.scopes){assert.equal([...scope.records.keys()].some(p=>p.startsWith('account_deletion_scopes/')),false);assert.equal([...scope.records.keys()].some(p=>p.startsWith('media_cleanup_jobs/')),false);assert.ok(scope.records.has('users/bob'));assert.equal(scope.records.has('account_access_revocations/alice'),false);}
 }finally{delete process.env.TOWNLOOP_SCOPED_DELETION_ENABLED;if(old===undefined)delete process.env.TOWNLOOP_ACCOUNT_DELETION_ENABLED;else process.env.TOWNLOOP_ACCOUNT_DELETION_ENABLED=old;}
});
test('legacy ownership pauses instead of deleting Auth or endlessly retrying',async()=>{
 process.env.TOWNLOOP_SCOPED_DELETION_ENABLED='true';process.env.TOWNLOOP_ACCOUNT_DELETION_ENABLED='true';try{const h=fixture({'resident_chats/legacy':{residentId:'alice',participantIds:['legacy-name'],messages:[]}});await h.run();assert.equal((await h.ref.get()).data().status,'needs_review');assert.equal(h.calls.some(c=>c[0]==='delete'),false);const before=structuredClone([...h.control.records]);await h.step();assert.deepEqual([...h.control.records],before);assert.ok(h.scopes[0].records.has('resident_chats/legacy'));}finally{delete process.env.TOWNLOOP_SCOPED_DELETION_ENABLED;delete process.env.TOWNLOOP_ACCOUNT_DELETION_ENABLED;}
});
test('unqualified media stays pending and cannot certify database completion',async()=>{
 process.env.TOWNLOOP_SCOPED_DELETION_ENABLED='true';process.env.TOWNLOOP_ACCOUNT_DELETION_ENABLED='true';try{const h=fixture({'posts/own':{userId:'alice',photoUrl:'synthetic-private-reference'}});await h.run();assert.equal((await h.ref.get()).data().status,'waiting_for_media');assert.equal(h.calls.some(c=>c[0]==='delete'),false);const media=[...h.control.records].find(([path])=>path.startsWith('media_cleanup_jobs/'));assert.equal(media[1].databaseId,'(default)');h.control.records.set(media[0],{...media[1],status:'pending_legacy_review'});await h.step();assert.equal((await h.ref.get()).data().status,'needs_review');}finally{delete process.env.TOWNLOOP_SCOPED_DELETION_ENABLED;delete process.env.TOWNLOOP_ACCOUNT_DELETION_ENABLED;}
});
test('held request and unverified write-freeze policy cause no destructive actions',async()=>{
 process.env.TOWNLOOP_SCOPED_DELETION_ENABLED='true';process.env.TOWNLOOP_ACCOUNT_DELETION_ENABLED='true';try{const h=fixture();h.policy.scopeWriteFreezeVerified[DATABASES[1]]=false;await h.step();assert.deepEqual(h.calls,[]);assert.equal((await h.ref.get()).data().status,'pending_owner_approval');const a=fixture();a.control.records.get(a.ref.path).review.processingAuthorized=false;await a.step();assert.deepEqual(a.calls,[]);}finally{delete process.env.TOWNLOOP_SCOPED_DELETION_ENABLED;delete process.env.TOWNLOOP_ACCOUNT_DELETION_ENABLED;}
});
test('a failure in the website scope cannot overwrite app completion or prematurely delete Auth',async()=>{
 process.env.TOWNLOOP_SCOPED_DELETION_ENABLED='true';process.env.TOWNLOOP_ACCOUNT_DELETION_ENABLED='true';
 try{const h=fixture(),named=h.scopes[1].db,original=named.runTransaction;let fail=true;named.runTransaction=async fn=>{if(fail&&(await h.ref.get()).data().phase==='scoped_run'){fail=false;throw Error('synthetic website interruption');}return original(fn);};await assert.rejects(h.run(),/synthetic website interruption/);let root=(await h.ref.get()).data();assert.equal(root.databaseCompletion.length,1);assert.equal(root.databaseCompletion[0].databaseId,'(default)');assert.equal(h.calls.some(c=>c[0]==='delete'),false);named.runTransaction=original;await h.run();root=(await h.ref.get()).data();assert.equal(root.databaseCompletion.length,2);assert.equal(root.status,'retention_pending');assert.equal(h.calls.filter(c=>c[0]==='delete').length,1);}finally{delete process.env.TOWNLOOP_SCOPED_DELETION_ENABLED;delete process.env.TOWNLOOP_ACCOUNT_DELETION_ENABLED;}
});
test('final reconciliation catches late backend references before certifying either scope',async()=>{
 process.env.TOWNLOOP_SCOPED_DELETION_ENABLED='true';process.env.TOWNLOOP_ACCOUNT_DELETION_ENABLED='true';
 try{const h=fixture();let inserted=false;for(let n=0;n<320;n++){const root=(await h.ref.get()).data();if(root.phase==='scoped_drain')h.advance(1);if(root.status==='retention_pending')break;const scope=h.control.records.get(`account_deletion_scopes/${jobIdFor('alice')}`);if(scope?.phase==='scoped_reconcile'&&!inserted){h.control.records.set('notification_deliveries/late',{uid:'alice',status:'accepted',createdAt:new Date(h.now)});inserted=true;}await h.step();for(const store of h.scopes)for(const [path,job]of store.records)if(path.startsWith('media_cleanup_jobs/')&&job.status==='queued')store.records.set(path,{...job,status:'complete'});}
 assert.equal(inserted,true);assert.equal((await h.ref.get()).data().status,'retention_pending');assert.equal(h.control.records.get('notification_deliveries/late').uid,undefined);assert.equal(h.calls.filter(c=>c[0]==='delete').length,1);
 }finally{delete process.env.TOWNLOOP_SCOPED_DELETION_ENABLED;delete process.env.TOWNLOOP_ACCOUNT_DELETION_ENABLED;}
});

test('Inbox v3 membership and nested messages are removed without erasing another participants content',async()=>{
 process.env.TOWNLOOP_SCOPED_DELETION_ENABLED='true';process.env.TOWNLOOP_ACCOUNT_DELETION_ENABLED='true';
 try{const h=fixture({
  'inbox_conversations/thread':{schemaVersion:3,type:'private',memberIds:['alice','bob'],memberRefs:{alice:'a',bob:'b'}},
  'inbox_memberships/a':{uid:'alice',conversationId:'thread',status:'left'},
  'inbox_memberships/b':{uid:'bob',peerId:'alice',conversationId:'thread',status:'active'},
  'inbox_conversations/thread/messages/m':{senderId:'bob',body:'fixture only',visibility:['alice:1','bob:1']},
  'inbox_conversations/thread/messages/a':{senderId:'alice',body:'remove fixture',visibility:['alice:1','bob:1']},
 });await h.run();assert.equal((await h.ref.get()).data().status,'retention_pending');
 assert.equal(h.control.records.has('inbox_memberships/a'),false);assert.equal(h.control.records.has('inbox_conversations/thread/messages/a'),false);
 assert.deepEqual(h.control.records.get('inbox_conversations/thread/messages/m').visibility,['bob:1']);
 assert.equal(h.control.records.get('inbox_conversations/thread/messages/m').body,'fixture only');
 assert.deepEqual(h.control.records.get('inbox_conversations/thread').memberIds,['bob']);
 assert.equal(h.control.records.get('inbox_conversations/thread').status,'read_only');
 }finally{delete process.env.TOWNLOOP_SCOPED_DELETION_ENABLED;delete process.env.TOWNLOOP_ACCOUNT_DELETION_ENABLED;}
});
test('reported source content and evidence are preserved before any media cleanup is queued',async()=>{
 process.env.TOWNLOOP_SCOPED_DELETION_ENABLED='true';process.env.TOWNLOOP_ACCOUNT_DELETION_ENABLED='true';
 try{const h=fixture({'moderation_reports/report':{collection:'posts',id:'own',reporterId:'bob',targetUid:'alice',status:'open'},'posts/own':{userId:'alice',title:'reported fixture'}});await h.run();
 assert.equal((await h.ref.get()).data().status,'needs_review');assert.equal(h.control.records.get('posts/own').title,'reported fixture');assert.equal(h.control.records.get('moderation_reports/report').targetUid,'alice');assert.equal(h.calls.some(c=>c[0]==='delete'),false);
 assert.equal([...h.control.records].some(([p,d])=>p.startsWith('media_cleanup_jobs/')&&d.recordId==='own'),false);
 }finally{delete process.env.TOWNLOOP_SCOPED_DELETION_ENABLED;delete process.env.TOWNLOOP_ACCOUNT_DELETION_ENABLED;}
});
test('a UID in a legacy conversation document path cannot survive under a completion receipt',async()=>{
 process.env.TOWNLOOP_SCOPED_DELETION_ENABLED='true';process.env.TOWNLOOP_ACCOUNT_DELETION_ENABLED='true';
 try{const h=fixture({'resident_chats/alice_vs_bob':{identityVersion:2,participantIds:['alice','bob'],messages:[]}});await h.run();assert.equal((await h.ref.get()).data().status,'needs_review');assert(h.control.records.has('resident_chats/alice_vs_bob'));assert.equal(h.calls.some(c=>c[0]==='delete'),false);
 }finally{delete process.env.TOWNLOOP_SCOPED_DELETION_ENABLED;delete process.env.TOWNLOOP_ACCOUNT_DELETION_ENABLED;}
});
test('owned notification state is erased while another residents notification state survives',async()=>{
 process.env.TOWNLOOP_SCOPED_DELETION_ENABLED='true';process.env.TOWNLOOP_ACCOUNT_DELETION_ENABLED='true';
 try{const h=fixture({'notification_events/a':{uid:'alice',seen:false},'notification_reads/a':{uid:'alice',readAt:1},'notification_events/b':{uid:'bob',seen:false}});await h.run();assert.equal((await h.ref.get()).data().status,'retention_pending');for(const scope of h.scopes){assert(!scope.records.has('notification_events/a'));assert(!scope.records.has('notification_reads/a'));assert(scope.records.has('notification_events/b'));}}
 finally{delete process.env.TOWNLOOP_SCOPED_DELETION_ENABLED;delete process.env.TOWNLOOP_ACCOUNT_DELETION_ENABLED;}
});
test('nested message inventory resumes beyond 100 and safely erases the final owned message',async()=>{
 process.env.TOWNLOOP_SCOPED_DELETION_ENABLED='true';process.env.TOWNLOOP_ACCOUNT_DELETION_ENABLED='true';
 try{const extra=Object.fromEntries(Array.from({length:101},(_,i)=>[`inbox_conversations/t/messages/${String(i).padStart(3,'0')}`,{senderId:i===100?'alice':'bob',visibility:['bob:1']} ]));const h=fixture(extra);await h.run();assert.equal((await h.ref.get()).data().status,'retention_pending');assert.equal(h.control.records.has('inbox_conversations/t/messages/100'),false);assert(h.control.records.has('inbox_conversations/t/messages/099'));assert.equal(h.calls.some(c=>c[0]==='delete'),true);}
 finally{delete process.env.TOWNLOOP_SCOPED_DELETION_ENABLED;delete process.env.TOWNLOOP_ACCOUNT_DELETION_ENABLED;}
});

test('request-bound access fences exist in both databases before Auth is disabled and retries cannot overwrite another request',async()=>{
 process.env.TOWNLOOP_SCOPED_DELETION_ENABLED='true';process.env.TOWNLOOP_ACCOUNT_DELETION_ENABLED='true';
 try{const h=fixture();await h.step();assert.deepEqual(h.calls,[]);await h.step();for(const scope of h.scopes){const fence=scope.records.get('account_access_revocations/alice');assert.equal(fence.uid,'alice');assert.equal(fence.jobId,jobIdFor('alice'));assert(Number.isFinite(+fence.expiresAt));assert(scope.records.has('users/alice'));assert.equal(scope.records.get('users/alice').approved,false);assert.equal(scope.records.has('resident_directory/alice'),false);}assert.equal(h.calls[0][0],'disable');
 const conflict=fixture();conflict.scopes[1].records.set('account_access_revocations/alice',{uid:'alice',jobId:'another-request'});await conflict.step();await assert.rejects(conflict.step(),/access_fence_conflict/);assert.deepEqual(conflict.calls,[]);assert.equal(conflict.scopes[1].records.get('account_access_revocations/alice').jobId,'another-request');
 }finally{delete process.env.TOWNLOOP_SCOPED_DELETION_ENABLED;delete process.env.TOWNLOOP_ACCOUNT_DELETION_ENABLED;}
});
