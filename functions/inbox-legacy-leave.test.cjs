const {test}=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('./testing/inbox-group-fixture.cjs');
const {member}=require('./inbox-policy.cjs');
for(const [source,actor,other]of [['office_chats','admin','vip'],['maintenance_chats','crew','crew2'],['resident_chats','a','b']])test(`${source}: one-person legacy leave requires no whole-chat migration`,async()=>{
 const h=fixture();h.records.set('users/crew2',{name:'crew2',role:'crew',approved:true});
 const old={residentId:'a',identityVersion:2,participantIds:['a','b'],messages:[{id:'historical:1',senderId:'old-alias',body:'Fixture',createdAt:1,unmodeledHistoricalField:true}],subject:'Fixture'};h.records.set(`${source}/legacy`,structuredClone(old));
 const result=await h.call(actor,{op:'leaveLegacy',source,legacyId:'legacy',uid:other});assert.equal(result.left,true);
 const after=h.records.get(`${source}/legacy`);assert.deepEqual(after.messages.slice(0,-1),old.messages);assert.deepEqual(after.leftBy,{[actor]:true});assert.equal(after.groupConversationId,undefined);assert.equal(after.sideLeft,undefined);
 assert.equal(after.messages.at(-1).actorId,actor);assert.equal(after.messages.at(-1).body,`${actor} left the conversation.`);
 assert.equal(member(source,after,{...h.records.get(`users/${actor}`),id:actor}),false);assert.equal(member(source,after,{...h.records.get(`users/${other}`),id:other}),true);
 assert(!(await h.call(actor,{op:'listLegacy'})).rows.some(r=>r.id==='legacy'));
 assert((await h.call(other,{op:'listLegacy'})).rows.some(r=>r.id==='legacy'));
 await h.call(actor,{op:'leaveLegacy',source,legacyId:'legacy'});assert.equal(h.records.get(`${source}/legacy`).messages.length,2);
 assert.equal([...h.records.keys()].filter(p=>p.startsWith('inbox_conversations/')).length,0);
});
test('outsiders cannot leave; failed writes roll back; left callers cannot create a replacement',async()=>{
 const h=fixture(),old={identityVersion:2,participantIds:['a','b'],messages:[]};h.records.set('resident_chats/x',old);
 await assert.rejects(h.call('crew',{op:'leaveLegacy',source:'resident_chats',legacyId:'x'}),/permission-denied/);assert.deepEqual(h.records.get('resident_chats/x'),old);
 const transaction=h.db.runTransaction;h.db.runTransaction=fn=>transaction(tx=>fn({...tx,update:()=>{throw Error('fixture_write_failed');}}));
 await assert.rejects(h.call('a',{op:'leaveLegacy',source:'resident_chats',legacyId:'x'}),/fixture_write_failed/);assert.deepEqual(h.records.get('resident_chats/x'),old);h.db.runTransaction=transaction;
 await h.call('a',{op:'leaveLegacy',source:'resident_chats',legacyId:'x'});
 await assert.rejects(h.call('a',{op:'create',type:'private',recipientIds:['b']}),/permission-denied|failed-precondition/);
 await h.call('b',{op:'leaveLegacy',source:'resident_chats',legacyId:'x'});assert(h.records.has('resident_chats/x'));assert([...h.records.values()].some(v=>v.status==='awaiting_separate_approval'));
});
test('legacy push delivery excludes a departed staff member even for a queued pre-leave event',async()=>{
 const {registerDevice,deliver}=require('./inbox-push.cjs');const h=fixture(),now=h.now+1000;
 for(const [uid,suffix]of [['admin','a'],['vip','b']])await registerDevice(h.db,uid,{token:`ExpoPushToken[fixture${suffix}]`,platform:'android',installationId:suffix.repeat(32),secret:'s'.repeat(64),preferences:{inbox:true}},{now});
 const old={residentId:'a',messages:[]},next={...old,messages:[{id:'new',senderId:'a',senderName:'a',senderRole:'resident',body:'Fixture',createdAt:now}]};h.records.set('office_chats/push',next);
 await h.call('admin',{op:'leaveLegacy',source:'office_chats',legacyId:'push'});
 const event={authId:'a',authType:'unknown',time:new Date(now).toISOString(),params:{chatId:'push'},data:{before:{data:()=>old},after:{data:()=>next}}};const sent=[];
 await deliver(h.db,event,'office_chats',{now,identity:async()=>({disabled:false}),transport:async(_,payload)=>{sent.push(payload);return{data:{status:'ok',id:'fixture-ticket'}};}});
 assert.equal(sent.length,1);assert.equal(sent[0].to,'ExpoPushToken[fixtureb]');
});
test('concurrent legacy departures preserve both records and repeated requests emit one event each',async()=>{
 const h=fixture();h.records.set('office_chats/concurrent',{residentId:'a',messages:[]});
 await Promise.all(['admin','vip','admin'].map(uid=>h.call(uid,{op:'leaveLegacy',source:'office_chats',legacyId:'concurrent'})));
 const source=h.records.get('office_chats/concurrent');assert.deepEqual(source.leftBy,{admin:true,vip:true});assert.equal(source.messages.length,2);assert.equal(source.sideLeft,undefined);assert.equal(source.groupConversationId,undefined);assert.equal([...h.records.keys()].filter(k=>k.startsWith('inbox_cleanup_requests/')).length,0);
});
