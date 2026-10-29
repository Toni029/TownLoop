const {test}=require('node:test');const assert=require('node:assert/strict');
const {fixture}=require('./testing/inbox-group-fixture.cjs');
const {canSee,memberPath}=require('./inbox-groups.cjs');
const {planConversationCleanup}=require('./inbox-group-cleanup.cjs');
const conversation=(h,cid)=>h.records.get(`inbox_conversations/${cid}`);
const membership=(h,cid,uid)=>h.records.get(memberPath(cid,uid));
const message=(h,cid,id)=>h.records.get(`inbox_conversations/${cid}/messages/${id}`);
test('Stage A and B gates fail closed, pending accounts and forged roles cannot create groups',async()=>{
 const h=fixture();assert.equal((await h.call('a',{op:'capabilities'},{enabled:false})).enabled,false);
 await assert.rejects(h.call('a',{op:'create',type:'office',recipientIds:['admin']},{enabled:false}),/failed-precondition/);
 h.records.get('users/b').approved=false;
 await assert.rejects(h.call('a',{op:'create',type:'office',recipientIds:['b'],role:'admin'}),/permission-denied/);
 await assert.rejects(h.call('',{op:'create',type:'private',recipientIds:['b']}),/unauthenticated/);
});
test('Office additions see no earlier messages/system events, timestamps and epochs are server owned',async()=>{
 const h=fixture(),{conversationId:id}=await h.call('a',{op:'create',type:'office',recipientIds:['admin'],joinedAt:0});
 await h.call('a',{op:'send',conversationId:id,messageId:'old',body:'Earlier private history'});
 await h.call('a',{op:'add',conversationId:id,recipientIds:['vip'],joinedAt:0,epoch:0});
 const c=conversation(h,id),m=membership(h,id,'vip'),p=h.records.get('users/vip');
 assert.equal(canSee(c,m,p,message(h,id,'old')),false);assert(m.joinedAt>0);assert.equal(m.epoch,1);
 const join=[...h.records.values()].find(v=>v.type==='join');assert.equal(canSee(c,m,p,join),true);
 await h.call('admin',{op:'send',conversationId:id,messageId:'new',body:'Welcome'});
 assert.equal(canSee(conversation(h,id),m,p,message(h,id,'new')),true);
 const size=h.records.size;await h.call('a',{op:'add',conversationId:id,recipientIds:['vip']});assert.equal(h.records.size,size);
 await assert.rejects(h.call('b',{op:'add',conversationId:id,recipientIds:['vip']}),/permission-denied/);
 await assert.rejects(h.call('a',{op:'add',conversationId:id,recipientIds:['b']}),/permission-denied/);
});
test('private leave revokes all access, remaining peer is read-only, final leave only queues cleanup',async()=>{
 const h=fixture(),{conversationId:id}=await h.call('a',{op:'create',type:'private',recipientIds:['b']});
 await h.call('a',{op:'send',conversationId:id,messageId:'m',body:'Private'});
 await h.call('a',{op:'leave',conversationId:id});
 assert.equal(canSee(conversation(h,id),membership(h,id,'a'),h.records.get('users/a'),message(h,id,'m')),false);
 await assert.rejects(h.call('b',{op:'send',conversationId:id,messageId:'next',body:'No recipient'}),/failed-precondition/);
 await assert.rejects(h.call('a',{op:'create',type:'private',recipientIds:['b']}),/permission-denied/);
 await h.call('b',{op:'leave',conversationId:id});
 assert.equal(conversation(h,id).status,'cleanup_pending');assert(message(h,id,'m'));
 assert.equal(h.records.get(`inbox_cleanup_requests/${id}`).status,'awaiting_separate_approval');
});
test('Crew shares one thread; additions have no history; role loss revokes; explicit leave is never undone',async()=>{
 const h=fixture(),{conversationId:id}=await h.call('a',{op:'create',type:'maintenance'});
 await h.call('a',{op:'send',conversationId:id,messageId:'before',body:'Initial issue'});
 h.records.set('users/crew2',{name:'crew2',role:'crew',approved:true});
 await h.call('a',{op:'sync',conversationId:id});
 assert.equal(canSee(conversation(h,id),membership(h,id,'crew2'),h.records.get('users/crew2'),message(h,id,'before')),false);
 assert.equal((await h.call('a',{op:'create',type:'maintenance'})).conversationId,id);
 await h.call('crew',{op:'leave',conversationId:id});await h.call('a',{op:'sync',conversationId:id});
 assert.equal(membership(h,id,'crew').reason,'left');
 h.records.get('users/crew2').role='resident';
 assert.equal(canSee(conversation(h,id),membership(h,id,'crew2'),h.records.get('users/crew2'),message(h,id,'before')),false);
 await h.call('a',{op:'sync',conversationId:id});h.records.get('users/crew2').role='crew';await h.call('a',{op:'sync',conversationId:id});
 assert.equal(membership(h,id,'crew2').epoch,2);
});
test('duplicate/retried messages create one record; impersonation/system/attachment input is ignored or rejected',async()=>{
 const h=fixture(),{conversationId:id}=await h.call('a',{op:'create',type:'private',recipientIds:['b']});
 const data={op:'send',conversationId:id,messageId:'retry',body:'Hello',isSystem:true,senderId:'admin',visibility:['vip:1']};
 await Promise.all([h.call('a',data),h.call('a',data)]);
 assert.equal(conversation(h,id).sequence,1);assert.equal(message(h,id,'retry').senderId,'a');assert.equal(message(h,id,'retry').isSystem,false);
 await assert.rejects(h.call('b',{...data,body:'Forgery'}),/already-exists/);
 await assert.rejects(h.call('a',{...data,messageId:'attachment',attachments:[{url:'https://private'}]}),/invalid-argument/);
 h.records.set('user_blocks/a/targets/b',{});await assert.rejects(h.call('a',{...data,messageId:'blocked'}),/failed-precondition/);
});
test('simultaneous one-tap leaves are serialized and only queue final cleanup',async()=>{
 const h=fixture(),{conversationId:id}=await h.call('a',{op:'create',type:'private',recipientIds:['b']});
 const outcomes=await Promise.allSettled(['a','b'].map(uid=>h.call(uid,{op:'leave',conversationId:id})));
 assert.equal(outcomes.filter(o=>o.status==='fulfilled').length,2);
 assert.equal(conversation(h,id).status,'cleanup_pending');
 assert.equal(h.records.get(`inbox_cleanup_requests/${id}`).status,'awaiting_separate_approval');
});
test('verified bounded legacy cutover preserves source and message IDs, no historical push or fabricated joins',async()=>{
 const h=fixture();const original={identityVersion:2,participantIds:['a','b'],messages:[{id:'historical',senderId:'a',senderName:'a',body:'Old history',createdAt:1}],subject:'Existing'};
 h.records.set('resident_chats/old',original);
 const {conversationId:id}=await h.call('a',{op:'create',type:'private',recipientIds:['b']});
 assert.deepEqual(h.records.get('resident_chats/old').messages,original.messages);
 assert.equal(message(h,id,'historical').notify,false);assert.equal(message(h,id,'historical').createdAt,1);
 assert(![...h.records.values()].some(m=>m.type==='join'));
 assert.equal((await h.call('a',{op:'create',type:'private',recipientIds:['b']})).conversationId,id);
});
test('ambiguous legacy identities and media fail closed without changing source',async()=>{
 for(const bad of [{senderId:'name_alias'},{photoUrl:'https://token-url'},{imageUrl:'https://unmodeled-token-url'},{isSystem:true,type:'join'}]){
 const h=fixture();const old={identityVersion:2,participantIds:['a','b'],messages:[{id:'m',senderId:'a',body:'private',createdAt:1,...bad}]};h.records.set('resident_chats/old',old);
 await assert.rejects(h.call('a',{op:'upgradeLegacy',source:'resident_chats',legacyId:'old'}),/failed-precondition/);
 assert.deepEqual(h.records.get('resident_chats/old'),old);
 }
});
test('Stage B preserves evidence/shared/quarantined media and cannot execute',()=>{
 const result=planConversationCleanup({conversation:{id:'c',status:'cleanup_pending'},members:[],messages:[{id:'m'},{id:'n'}],attachments:[{path:'quarantine',quarantined:true}],evidence:[{messageId:'m',basis:'documented review',expiresAt:Date.now()+1000}]});
 assert.equal(result.executable,false);assert.equal(result.stageBEnabled,false);assert.deepEqual(result.candidateMessageIds,['n']);assert.equal(result.conversationRemovalAllowed,false);
});
test('read watermark is monotonic and does not acknowledge a message arriving after the displayed snapshot',async()=>{
 const h=fixture(),{conversationId:id}=await h.call('a',{op:'create',type:'private',recipientIds:['b']});
 await h.call('a',{op:'send',conversationId:id,messageId:'first',body:'First'});
 await h.call('a',{op:'send',conversationId:id,messageId:'second',body:'Second'});
 await h.call('b',{op:'read',conversationId:id,sequence:1});
 assert.equal(membership(h,id,'b').readSequence,1);assert.equal(membership(h,id,'b').readAt,message(h,id,'first').createdAt);
 await h.call('b',{op:'read',conversationId:id,sequence:0});assert.equal(membership(h,id,'b').readSequence,1);
});
test('role-change event is idempotent and rejoining after role restoration receives a fresh epoch',async()=>{
 const h=fixture(),{conversationId:id}=await h.call('a',{op:'create',type:'maintenance'});
 const before={...h.records.get('users/crew')};h.records.get('users/crew').role='resident';
 const {revokeChangedMemberships}=require('./inbox-group-roles.cjs');const at=h.now+100;
 await revokeChangedMemberships(h.db,'crew',before,h.records.get('users/crew'),at);
 await revokeChangedMemberships(h.db,'crew',before,h.records.get('users/crew'),at);
 assert.equal(membership(h,id,'crew').reason,'role_revoked');
 h.records.get('users/crew').role='crew';await h.call('a',{op:'sync',conversationId:id},{now:at+1});
 assert.equal(membership(h,id,'crew').epoch,2);
 await revokeChangedMemberships(h.db,'crew',before,{...before,role:'resident'},at);
 assert.equal(membership(h,id,'crew').status,'active');
});
test('legacy staff conversion requires an expiring, exact-source Admin-reviewed manifest',async()=>{
 const h=fixture();const source={residentId:'a',messages:[{id:'old',senderId:'a',body:'Earlier',createdAt:1}]};h.records.set('office_chats/old',source);
 await assert.rejects(h.call('a',{op:'upgradeLegacy',source:'office_chats',legacyId:'old'}),/failed-precondition/);
 const {hash}=require('./inbox-groups.cjs');
 h.records.set(`inbox_legacy_authorizations/${hash('office_chats/old')}`,{sourceHash:hash(JSON.stringify(source)),participantIds:['a','admin'],reviewedBy:'admin',evidenceReference:'verified_fixture',expiresAt:h.now+10000});
 const {conversationId:id}=await h.call('a',{op:'upgradeLegacy',source:'office_chats',legacyId:'old'});
 await h.call('a',{op:'add',conversationId:id,recipientIds:['vip']});
 assert.equal(canSee(conversation(h,id),membership(h,id,'vip'),h.records.get('users/vip'),message(h,id,'old')),false);
 const roster=await h.call('a',{op:'roster',conversationId:id});assert.equal(roster.members.length,3);
 await h.call('admin',{op:'leave',conversationId:id});const after=await h.call('a',{op:'roster',conversationId:id});assert(!after.members.some(m=>m.uid==='admin'));assert(!after.candidates.some(m=>m.uid==='admin'));
});
test('existing UID-verified Office-direct conversation upgrades without exposing its private past to added Office staff',async()=>{
 const h=fixture();h.records.set('resident_chats/direct',{identityVersion:2,officeDirect:true,participantIds:['a','admin'],messages:[{id:'before',senderId:'a',body:'Original direct Office inquiry',createdAt:1}]});
 const result=await h.call('a',{op:'upgradeLegacy',source:'resident_chats',legacyId:'direct'});assert.equal(result.type,'office');
 await h.call('a',{op:'add',conversationId:result.conversationId,recipientIds:['vip']});
 assert.equal(canSee(conversation(h,result.conversationId),membership(h,result.conversationId,'vip'),h.records.get('users/vip'),message(h,result.conversationId,'before')),false);
});
test('Stage B runner has no effects when disabled and holds unapproved cleanup without deleting fixtures',async()=>{
 const {runConversationCleanup}=require('./inbox-group-cleanup-runner.cjs');
 const h=fixture(),{conversationId:id}=await h.call('a',{op:'create',type:'private',recipientIds:['b']});
 await h.call('a',{op:'leave',conversationId:id});await h.call('b',{op:'leave',conversationId:id,confirmPermanent:true});
 const size=h.records.size;assert.equal((await runConversationCleanup(h.db,null,id)).state,'disabled');
 assert.equal((await runConversationCleanup(h.db,null,id,{enabled:true,now:h.now+100})).state,'held');assert.equal(h.records.size,size);
});
test('explicit Stage B fixture approval supports idempotent backend cleanup while protected evidence holds it',async()=>{
 const {runConversationCleanup}=require('./inbox-group-cleanup-runner.cjs');
 const h=fixture(),{conversationId:id}=await h.call('a',{op:'create',type:'private',recipientIds:['b']});
 await h.call('a',{op:'send',conversationId:id,messageId:'m',body:'Fixture only'});
 await h.call('a',{op:'leave',conversationId:id});await h.call('b',{op:'leave',conversationId:id,confirmPermanent:true});
 h.records.set(`inbox_cleanup_authorizations/${id}`,{status:'approved',approvedBy:'admin',expiresAt:Date.now()+60000,sequence:conversation(h,id).sequence,membershipInventoryComplete:true,mediaReferenceInventoryComplete:true,evidenceReviewComplete:true});
 h.records.set('inbox_retention_holds/protected',{conversationId:id,basis:'Fixture report evidence',expiresAt:Date.now()+60000,expiryApproved:true});
 assert.equal((await runConversationCleanup(h.db,null,id,{enabled:true})).state,'held');assert(message(h,id,'m'));
 h.records.delete('inbox_retention_holds/protected');
 assert.equal((await runConversationCleanup(h.db,null,id,{enabled:true})).state,'completed');
 assert(!conversation(h,id));assert(!message(h,id,'m'));assert(!membership(h,id,'a'));
 assert.equal((await runConversationCleanup(h.db,null,id,{enabled:true})).state,'completed');
 assert(h.records.has('users/a'));assert(h.records.has('users/b'));
});
test('client message IDs cannot squat on trusted membership event namespaces and block another member leaving',async()=>{
 const h=fixture(),{conversationId:id}=await h.call('a',{op:'create',type:'private',recipientIds:['b']});
 const {hash}=require('./inbox-groups.cjs');
 for(const type of ['leave','join','revoke'])await assert.rejects(h.call('a',{op:'send',conversationId:id,messageId:`${type}_${hash('b/1')}`,body:'Attempted event collision'}),/invalid-argument/);
 await h.call('b',{op:'leave',conversationId:id});assert.equal(membership(h,id,'b').status,'left');
});
test('Stage B rejects missing, nonnumeric, infinite or expired approval expiries without mutation',async()=>{
 const {runConversationCleanup}=require('./inbox-group-cleanup-runner.cjs');
 for(const expiresAt of [undefined,'tomorrow',Infinity,NaN,0]){
  const h=fixture(),{conversationId:id}=await h.call('a',{op:'create',type:'private',recipientIds:['b']});
  await h.call('a',{op:'leave',conversationId:id});await h.call('b',{op:'leave',conversationId:id,confirmPermanent:true});
  h.records.set(`inbox_cleanup_authorizations/${id}`,{status:'approved',approvedBy:'admin',expiresAt,sequence:conversation(h,id).sequence,membershipInventoryComplete:true,mediaReferenceInventoryComplete:true,evidenceReviewComplete:true});
  const size=h.records.size;assert.equal((await runConversationCleanup(h.db,null,id,{enabled:true})).state,'held');assert.equal(h.records.size,size);assert(conversation(h,id));
 }
});
test('one-tap Office and Crew leave removes only the authenticated member and emits one genuine event',async()=>{
 for(const type of ['office','maintenance']){
  const h=fixture();h.records.set('users/crew2',{role:'crew',approved:true,name:'Crew Two'});
  const {conversationId:id}=await h.call('a',{op:'create',type,recipientIds:type==='office'?['admin','vip']:[]});
  await h.call('a',{op:'send',conversationId:id,messageId:'history',body:'Preserved fixture'});
  const actor=type==='office'?'admin':'crew',other=type==='office'?'vip':'crew2';
  await h.call(actor,{op:'leave',conversationId:id});await h.call(actor,{op:'leave',conversationId:id});
  assert.equal(membership(h,id,actor).status,'left');assert.equal(membership(h,id,other).status,'active');assert.equal(membership(h,id,'a').status,'active');
  assert.equal(canSee(conversation(h,id),membership(h,id,other),h.records.get(`users/${other}`),message(h,id,'history')),true);
  const events=[...h.records].filter(([p,d])=>p.startsWith(`inbox_conversations/${id}/messages/`)&&d.type==='leave');
  assert.equal(events.length,1);assert.equal(events[0][1].body,`${actor} left the conversation.`);assert.equal(events[0][1].actorId,actor);
  assert(!h.records.has(`inbox_cleanup_requests/${id}`));
 }
});
test('legacy leave and cutover are atomic; unresolved Office ownership produces no changes',async()=>{
 const {hash}=require('./inbox-groups.cjs'),h=fixture();
 const old={residentId:'a',messages:[{id:'old',senderId:'a',body:'Keep this history',createdAt:1}]};h.records.set('office_chats/old',old);
 const request={op:'leaveLegacy',source:'office_chats',legacyId:'old'};
 const before=h.records.size;await assert.rejects(h.call('admin',request),/failed-precondition/);assert.equal(h.records.size,before);assert.deepEqual(h.records.get('office_chats/old'),old);
 h.records.set(`inbox_legacy_authorizations/${hash('office_chats/old')}`,{sourceHash:hash(JSON.stringify(old)),participantIds:['a','admin','vip'],reviewedBy:'admin',evidenceReference:'verified_fixture',expiresAt:h.now+10000});
 const transaction=h.db.runTransaction;
 h.db.runTransaction=fn=>transaction(tx=>fn({...tx,update:(ref,data)=>{if(ref.path==='office_chats/old')throw Error('fixture_write_failed');tx.update(ref,data);}}));
 const size=h.records.size;await assert.rejects(h.call('admin',request),/fixture_write_failed/);assert.equal(h.records.size,size);assert.deepEqual(h.records.get('office_chats/old'),old);
 h.db.runTransaction=transaction;
 const result=await h.call('admin',request);assert.equal(result.left,true);assert.equal(result.cleanupPending,false);
 assert.equal(membership(h,result.conversationId,'admin').status,'left');assert.equal(membership(h,result.conversationId,'vip').status,'active');
 assert.deepEqual(h.records.get('office_chats/old').messages,old.messages);
 const repeat=await h.call('admin',request);assert.equal(repeat.left,true);assert.equal(repeat.unchanged,true);
});
