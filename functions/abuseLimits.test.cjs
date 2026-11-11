const {test}=require('node:test'),assert=require('node:assert/strict');
const {advance,POLICIES}=require('./abusePolicy.cjs'),{charge}=require('./abuseLimits.cjs');
const {fixture}=require('./testing/inbox-group-fixture.cjs');
test('per-user counters survive new instances, serialize concurrent charges and respect separate scopes',async()=>{
 const h=fixture();await Promise.all(Array.from({length:40},(_,i)=>charge(h.db,'a','media','file'+i,1000000000000)));
 await assert.rejects(charge(h.db,'a','media','overflow',1000000000000),{code:'resource-exhausted'});
 await charge(h.db,'b','media','different-account',1000000000000);await charge(h.db,'a','comments','different-scope',1000000000000);
 await charge(h.db,'a','media','next-minute',1000000060000);assert.equal(h.records.get('safety_limits/a').activity.media.dayCount,41);
});
test('daily and byte budgets reject overflow and recover after rolling deadlines',()=>{
 const now=1000000000000;let counter;for(let i=0;i<20;i++)counter=advance(counter,'pdf','edition',now+i*60000,50*1024*1024);
 assert.throws(()=>advance(counter,'pdf','overflow',now+21*60000,1),{code:'resource-exhausted'});
 assert.equal(advance(counter,'pdf','tomorrow',now+86400000,10).dayCount,1);
 assert.throws(()=>advance(null,'media','huge',now,1073741825),{code:'resource-exhausted'});
});
test('Inbox message quota is atomic, duplicate acknowledgements are free, failures preserve history',async()=>{
 const h=fixture(),{conversationId}=await h.call('a',{op:'create',type:'private',recipientIds:['b']});const now=1000000001000;
 for(let i=0;i<POLICIES.messages[0];i++)await h.call('a',{op:'send',conversationId,messageId:'message'+i,body:'Synthetic'},{now});
 const before=h.records.size;await h.call('a',{op:'send',conversationId,messageId:'message0',body:'Synthetic'},{now});assert.equal(h.records.size,before);
 await assert.rejects(h.call('a',{op:'send',conversationId,messageId:'overflow',body:'Synthetic'},{now}),{code:'resource-exhausted'});
 assert.equal(h.records.size,before);assert.equal(h.records.get('safety_limits/a').activity.messages.windowCount,120);
 await h.call('b',{op:'send',conversationId,messageId:'reply',body:'Still works'},{now});
});
