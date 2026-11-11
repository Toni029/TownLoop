const {test}=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('./testing/inbox-group-fixture.cjs');
const {memberPath,canSee}=require('./inbox-groups.cjs');
const root=(h,id)=>h.records.get(`inbox_conversations/${id}`),mem=(h,id,uid)=>h.records.get(memberPath(id,uid)),msg=(h,id,key)=>h.records.get(`inbox_conversations/${id}/messages/${key}`);
for(const peer of ['admin','vip','crew','b'])for(const starter of ['a',peer])test(`private ${peer}: ${starter} composes after one leave without reviving old history`,async()=>{
 const h=fixture(),input=uid=>({op:'create',type:'private',recipientIds:[uid==='a'?peer:'a']});
 const {conversationId:old}=await h.call('a',input('a'));await h.call(peer,{op:'send',conversationId:old,messageId:'history',body:'Old content'});
 await h.call('a',{op:'leave',conversationId:old});const snapshot=structuredClone(root(h,old)),left=structuredClone(mem(h,old,'a'));
 const results=await Promise.all([h.call(starter,input(starter)),h.call(starter==='a'?peer:'a',input(starter==='a'?peer:'a'))]);
 const fresh=results[0].conversationId;assert.equal(fresh,results[1].conversationId);assert.notEqual(fresh,old);
 assert.deepEqual(root(h,old),snapshot);assert.deepEqual(mem(h,old,'a'),left);assert.equal(root(h,old).status,'read_only');
 assert(canSee(root(h,old),mem(h,old,peer),h.records.get(`users/${peer}`),msg(h,old,'history')));assert(!canSee(root(h,old),mem(h,old,'a'),h.records.get('users/a'),msg(h,old,'history')));
 assert.equal(msg(h,fresh,'history'),undefined);assert.equal(root(h,fresh).sequence,0);
 await h.call(starter,{op:'send',conversationId:fresh,messageId:'new',body:'Only new history'});
 assert.equal((await h.call(peer,input(peer))).conversationId,fresh);assert.equal(msg(h,old,'new'),undefined);
 await assert.rejects(h.call(peer,{op:'send',conversationId:old,messageId:'denied',body:'Cannot send here'}),/failed-precondition/);
});
for(const type of ['office','maintenance'])test(`${type}: protected legacy history automatically creates one new shared thread without warning`,async()=>{
 const h=fixture(),path=`${type}_chats/protected`,old={residentId:'a',messages:[{id:'past',senderId:'a',body:'Protected old history',createdAt:1,photoUrl:'https://example.invalid/protected'}]};h.records.set(path,structuredClone(old));
 const input={op:'create',type,...(type==='office'?{recipientIds:['admin']}:{})};
 const [one,two]=await Promise.all([h.call('a',input),h.call('a',input)]);assert.equal(one.conversationId,two.conversationId);assert.deepEqual(h.records.get(path),old);assert.equal(msg(h,one.conversationId,'past'),undefined);assert.equal(root(h,one.conversationId).sequence,0);
});
test('ambiguous private histories do not block new compose and do not copy messages or attachment links',async()=>{
 const h=fixture();for(const id of ['one','two'])h.records.set(`resident_chats/${id}`,{identityVersion:2,participantIds:['a','admin'],messages:[{id:'past',senderId:'a',body:'Protected',createdAt:1}]});
 const before=structuredClone([...h.records]);const {conversationId:id}=await h.call('admin',{op:'create',type:'private',recipientIds:['a']});assert.equal(msg(h,id,'past'),undefined);for(const [path,value]of before)if(path.startsWith('resident_chats/'))assert.deepEqual(h.records.get(path),value);
});
for(const starter of ['a','admin'])test(`legacy one-left private pair: ${starter} starts clean without modifying the remaining history`,async()=>{
 const h=fixture(),source={identityVersion:2,participantIds:['a','admin'],leftBy:{a:true},messages:[{id:'past',senderId:'admin',body:'Old retained history',createdAt:1}]};h.records.set('resident_chats/left',structuredClone(source));
 const {conversationId:id}=await h.call(starter,{op:'create',type:'private',recipientIds:[starter==='a'?'admin':'a']});assert.equal(msg(h,id,'past'),undefined);assert.deepEqual(h.records.get('resident_chats/left'),source);assert.equal(mem(h,id,'a').status,'active');assert.equal(mem(h,id,'admin').status,'active');
});
test('protected-history fallback still rejects blocked or unauthorized new recipients',async()=>{
 const h=fixture();h.records.set('office_chats/protected',{residentId:'a',messages:[]});h.records.set('user_blocks/a/targets/admin',{});
 await assert.rejects(h.call('a',{op:'create',type:'office',recipientIds:['admin']}),/permission-denied/);await assert.rejects(h.call('a',{op:'create',type:'office',recipientIds:['b']}),/permission-denied/);assert.equal([...h.records.keys()].filter(p=>/^inbox_conversations\/[^/]+$/.test(p)).length,0);
});
