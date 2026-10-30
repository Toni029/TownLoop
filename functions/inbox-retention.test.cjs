const emptyStorage={getFiles:async()=>[[],null]};
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {fixture}=require('./testing/inbox-group-fixture.cjs');
const {memberPath}=require('./inbox-groups.cjs');
const {GRACE_MS,addCalendarMonths,assessConversation}=require('./inbox-retention.cjs');
const root=(h,id)=>h.records.get(`inbox_conversations/${id}`);
const at=Date.UTC(2026,9,30);
async function pair(){const h=fixture();const {conversationId:id}=await h.call('a',{op:'create',type:'private',recipientIds:['b']},{now:at});return{h,id};}
test('six calendar months clamp month end and do not use a fixed 180-day cutoff',()=>{
 assert.equal(addCalendarMonths(Date.UTC(2026,7,31),6),Date.UTC(2027,1,28));
 assert.equal(addCalendarMonths(Date.UTC(2026,0,1),6),Date.UTC(2026,6,1));
});
test('last leave grants thirty days once, preserves history and only its own membership',async()=>{
 const {h,id}=await pair();await h.call('a',{op:'send',conversationId:id,messageId:'m',body:'Fixture'},{now:at+1});
 await h.call('a',{op:'leave',conversationId:id},{now:at+2});assert.equal(root(h,id).status,'read_only');
 assert.equal(h.records.get(memberPath(id,'b')).status,'active');
 await h.call('b',{op:'leave',conversationId:id},{now:at+3});
 assert.equal(root(h,id).retention.reason,'last_member_left');assert.equal(root(h,id).retention.deleteAfter,at+3+GRACE_MS);
 await h.call('b',{op:'leave',conversationId:id},{now:at+100});assert.equal(root(h,id).retention.deleteAfter,at+3+GRACE_MS);
 assert(h.records.has(`inbox_conversations/${id}/messages/m`));
});
test('inactivity archives with notice projection; new authorized message cancels grace, retries and joins do not',async()=>{
 const h=fixture();const {conversationId:id}=await h.call('a',{op:'create',type:'office',recipientIds:['admin']},{now:at});
 await h.call('a',{op:'send',conversationId:id,messageId:'m',body:'Fixture'},{now:at+1});
 const later=addCalendarMonths(at+1,6);
 assert.equal((await assessConversation(h.db,id,{now:later-1})).state,'active');
 assert.equal((await assessConversation(h.db,id,{now:later})).state,'archived');
 const deadline=later+GRACE_MS;
 assert.equal(h.records.get(memberPath(id,'a')).deleteAfter,deadline);
 await h.call('a',{op:'send',conversationId:id,messageId:'m',body:'Fixture'},{now:later+1});assert.equal(root(h,id).status,'archived');
 await assert.rejects(h.call('a',{op:'add',conversationId:id,recipientIds:['vip']},{now:later+2}),/failed-precondition/);
 await h.call('admin',{op:'send',conversationId:id,messageId:'new',body:'New activity'},{now:later+3});
 assert.equal(root(h,id).status,'open');assert.equal(root(h,id).retention,null);
 assert.equal(h.records.get(memberPath(id,'a')).deleteAfter,null);
 assert.equal(root(h,id).lastMessageAt,later+3);
 assert.equal(h.records.get(`inbox_cleanup_requests/${id}`).status,'cancelled');
});
test('missing, extra or mismatched authoritative memberships hold old abandoned chats; no empty-array inference',async()=>{
 for(const mode of ['missing','extra','uid','empty']){
  const {h,id}=await pair();await h.call('a',{op:'leave',conversationId:id},{now:at+1});await h.call('b',{op:'leave',conversationId:id},{now:at+2});
  if(mode==='missing')h.records.delete(memberPath(id,'b'));
  if(mode==='extra')h.records.set('inbox_memberships/unexpected',{uid:'stranger',status:'active',conversationId:id});
  if(mode==='uid')h.records.get(memberPath(id,'b')).uid='wrong';
  if(mode==='empty'){root(h,id).memberIds=[];root(h,id).memberRefs={};h.records.delete(memberPath(id,'a'));h.records.delete(memberPath(id,'b'));}
  assert.equal((await assessConversation(h.db,id,{now:at+GRACE_MS+3})).state,'needs_review');
  assert(root(h,id));
 }
});
test('old pending records receive a fresh grace period; system events do not extend last message date',async()=>{
 const {h,id}=await pair();await h.call('a',{op:'send',conversationId:id,messageId:'old',body:'Fixture'},{now:at+1});
 await h.call('a',{op:'leave',conversationId:id},{now:at+1000});await h.call('b',{op:'leave',conversationId:id},{now:at+2000});
 delete root(h,id).retention;delete root(h,id).lastMessageAt;
 const later=addCalendarMonths(at,8);
 assert.equal((await assessConversation(h.db,id,{now:later})).state,'grace');
 assert.equal(root(h,id).retention.deleteAfter,later+GRACE_MS);assert.equal(root(h,id).lastMessageAt,at+1);
});
test('no send or leave can mutate an irreversible cleanup claim; read-only private archives cannot send',async()=>{
 const {h,id}=await pair();await h.call('a',{op:'leave',conversationId:id},{now:at+1});
 await assessConversation(h.db,id,{now:addCalendarMonths(at,6)});
 await assert.rejects(h.call('b',{op:'send',conversationId:id,messageId:'no',body:'No peer'}),/failed-precondition/);
 root(h,id).status='cleanup_in_progress';
 await assert.rejects(h.call('b',{op:'leave',conversationId:id}),/failed-precondition/);
});
const {readCleanupInventory,runConversationCleanup}=require('./inbox-group-cleanup-runner.cjs');
async function review(h,id,now,extra={}){
 const inv=await h.db.runTransaction(tx=>readCleanupInventory(h.db,tx,id));
 h.records.set(`inbox_cleanup_authorizations/${id}`,{status:'approved',approvedBy:'admin',sequence:root(h,id).sequence,expiresAt:now+86400000,
  membershipInventoryComplete:true,mediaReferenceInventoryComplete:true,evidenceReviewComplete:true,inventoryHash:inv.hash,...extra});
}
async function abandoned(){
 const result=await pair(),{h,id}=result;
 await h.call('a',{op:'send',conversationId:id,messageId:'m',body:'Fixture only'},{now:at+1});
 await h.call('a',{op:'leave',conversationId:id},{now:at+2});await h.call('b',{op:'leave',conversationId:id},{now:at+3});
 return{...result,due:at+3+GRACE_MS};
}
test('cleanup is inert by default, rejects early deadlines, and requires a hash-bound Admin review',async()=>{
 const {h,id,due}=await abandoned();await review(h,id,due);const before=structuredClone(h.records);
 assert.equal((await runConversationCleanup(h.db,emptyStorage,id)).state,'disabled');assert.deepEqual(h.records,before);
 assert.equal((await runConversationCleanup(h.db,emptyStorage,id,{enabled:true,now:due-1})).state,'held');
 h.records.get(`inbox_cleanup_authorizations/${id}`).approvedBy='vip';
 assert.equal((await runConversationCleanup(h.db,emptyStorage,id,{enabled:true,now:due})).state,'held');assert.deepEqual(root(h,id).status,'cleanup_pending');
});
test('due cleanup removes only the selected conversation, notifications and verified exclusive object, idempotently',async()=>{
 const {h,id,due}=await abandoned(),path=`inbox_groups/${id}/m/photo`;
 h.records.set('inbox_media_references/photo',{path,conversationId:id,messageId:'m',storageGeneration:'42',referenceCount:1,verifiedExclusive:true});
 h.records.set(`inbox_conversations/${id}/messages/m`,{...h.records.get(`inbox_conversations/${id}/messages/m`),attachments:[{path,verified:true}]});
 h.records.set('notification_events/selected',{target:`inbox_conversations/${id}`});
 h.records.set('notification_events/other',{target:'inbox_conversations/someone_else'});
 h.records.set('marketplace_chats/untouched',{messages:['preserved']});
 await review(h,id,due);
 const deleted=[];const storage={getFiles:async()=>[[{name:path}],null],file:p=>({getMetadata:async()=>[{generation:'42',metadata:{conversationId:id,messageId:'m',verifiedExclusive:'true'}}],delete:async options=>{assert.equal(options.ifGenerationMatch,'42');deleted.push(p);}})};
 const run=()=>runConversationCleanup(h.db,storage,id,{enabled:true,now:due,clock:()=>due});
 assert.equal((await run()).state,'completed');assert.equal((await run()).state,'completed');assert.deepEqual(deleted,[path]);
 assert(!root(h,id));assert(!h.records.has('notification_events/selected'));assert(h.records.has('notification_events/other'));
 assert(h.records.has('marketplace_chats/untouched'));assert(h.records.has('users/a'));
 assert(![...h.records.values()].some(v=>v.conversationId===id&&v.status==='active'));
});
test('shared, quarantined, reported and unresolved media hold cleanup without deleting content',async()=>{
 for(const mode of ['shared','quarantine','report','evidence','unindexed']){
  const {h,id,due}=await abandoned();
  if(mode==='shared'||mode==='quarantine')h.records.set('inbox_media_references/hold',{path:`inbox_groups/${id}/m/photo`,conversationId:id,messageId:'m',storageGeneration:'42',referenceCount:mode==='shared'?2:1,verifiedExclusive:true,quarantined:mode==='quarantine'});
  if(mode==='report')h.records.set('moderation_reports/hold',{collection:'inbox_conversations',id});
  if(mode==='evidence')h.records.set('inbox_retention_holds/hold',{conversationId:id,basis:'fixture',expiresAt:due+86400000,expiryApproved:true});
  if(mode==='unindexed')h.records.get(`inbox_conversations/${id}/messages/m`).photoUrl='opaque-unresolved-reference';
  await review(h,id,due);const r=await runConversationCleanup(h.db,emptyStorage,id,{enabled:true,now:due,clock:()=>due});
  assert(['held','needs_review'].includes(r.state));assert(root(h,id));assert(h.records.has(`inbox_conversations/${id}/messages/m`));
 }
});
test('bounded page exhaustion resumes and concurrent cleanup claims cannot double-delete',async()=>{
 const {h,id,due}=await abandoned();
 for(let i=0;i<105;i++)h.records.set(`inbox_conversations/${id}/messages/page_${i}`,{id:`page_${i}`,type:'message',body:'fixture'});
 await review(h,id,due);
 const run=()=>runConversationCleanup(h.db,emptyStorage,id,{enabled:true,now:due,clock:()=>due,maxPages:1});
 const results=await Promise.all([run(),run()]);assert(results.some(r=>r.state==='busy'));assert(results.some(r=>r.state==='retry_required'));
 assert.equal((await run()).state,'retry_required'); // One message batch succeeds; further metadata stages are independently bounded.
 assert.equal((await runConversationCleanup(h.db,emptyStorage,id,{enabled:true,now:due,clock:()=>due})).state,'completed');
});
test('a new message wins before cleanup claim; a claim wins before any further send',async()=>{
 const h=fixture();const {conversationId:id}=await h.call('a',{op:'create',type:'office',recipientIds:['admin']},{now:at});
 await h.call('a',{op:'send',conversationId:id,messageId:'m',body:'old'},{now:at+1});
 const archived=addCalendarMonths(at+1,6);await assessConversation(h.db,id,{now:archived});const due=archived+GRACE_MS;
 await review(h,id,due);await h.call('admin',{op:'send',conversationId:id,messageId:'new',body:'new'},{now:due});
 assert.equal((await runConversationCleanup(h.db,emptyStorage,id,{enabled:true,now:due,clock:()=>due})).state,'held');assert(root(h,id));
});
test('expired inactivity grace can clean an archived group with remaining members after reviewed fencing',async()=>{
 const h=fixture();const {conversationId:id}=await h.call('a',{op:'create',type:'office',recipientIds:['admin']},{now:at});
 const archive=addCalendarMonths(at,6);await assessConversation(h.db,id,{now:archive});const due=archive+GRACE_MS;
 await review(h,id,due);
 assert.equal((await runConversationCleanup(h.db,emptyStorage,id,{enabled:true,now:due,clock:()=>due})).state,'completed');assert(!root(h,id));
});
test('disabled schedules do nothing; paginated scans preserve unresolved legacy chats and do not touch Marketplace',async()=>{
 const {scanRetentionPage,cleanupRetentionPage}=require('./inbox-retention-monitor.cjs');
 const h=fixture();h.records.set('office_chats/old',{leftBy:{a:true,admin:true}});h.records.set('marketplace_chats/never',{});
 const before=structuredClone(h.records);assert.equal((await scanRetentionPage(h.db)).state,'disabled');
 assert.equal((await cleanupRetentionPage(h.db,null)).state,'disabled');assert.deepEqual(h.records,before);
 for(let i=0;i<8;i++)await scanRetentionPage(h.db,{enabled:true,now:at,pageSize:1});
 const queue=[...h.records].filter(([p])=>p.startsWith('inbox_cleanup_requests/'));
 assert.equal(queue.length,1);assert.equal(queue[0][1].reason,'authoritative_legacy_membership_required');
 assert(h.records.has('office_chats/old'));assert(h.records.has('marketplace_chats/never'));
});
test('untracked Storage objects, unexpected subcollections and stale exclusivity counts are held',async()=>{
 for(const mode of ['storage','subcollection','shared-reference']){
  const {h,id,due}=await abandoned();let storage=emptyStorage;
  if(mode==='storage')storage={getFiles:async()=>[[{name:`inbox_groups/${id}/unknown`}],null]};
  if(mode==='subcollection')h.records.set(`inbox_conversations/${id}/unknown/record`,{preserve:true});
  if(mode==='shared-reference'){
   const path=`inbox_groups/${id}/m/photo`;
   h.records.set('inbox_media_references/a',{path,conversationId:id,messageId:'m',storageGeneration:'42',referenceCount:1,verifiedExclusive:true});
   h.records.set('inbox_media_references/b',{path,conversationId:'other',messageId:'m',storageGeneration:'42',referenceCount:1,verifiedExclusive:true});
  }
  await review(h,id,due);assert.equal((await runConversationCleanup(h.db,storage,id,{enabled:true,now:due,clock:()=>due})).state,'held');
  assert(root(h,id));assert(h.records.has(`inbox_conversations/${id}/messages/m`));
 }
});
test('human-review holds stay held until resolved; completed minimal receipts expire after sixty days',async()=>{
 const {h,id,due}=await abandoned();
 h.records.set(`inbox_cleanup_requests/${id}`,{conversationId:id,status:'needs_review',reason:'verified_ownership_required'});
 assert.equal((await assessConversation(h.db,id,{now:due})).state,'needs_review');
 await review(h,id,due);
 assert.equal((await runConversationCleanup(h.db,emptyStorage,id,{enabled:true,now:due,clock:()=>due})).state,'completed');
 const {cleanupRetentionPage}=require('./inbox-retention-monitor.cjs');
 await cleanupRetentionPage(h.db,emptyStorage,{enabled:true,now:due+60*86400000});
 assert(!h.records.has(`inbox_cleanup_requests/${id}`));
});
