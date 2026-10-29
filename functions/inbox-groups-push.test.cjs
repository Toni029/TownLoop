const {test}=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('./testing/inbox-group-fixture.cjs');
const {registerDevice,notificationState}=require('./inbox-push.cjs');
const {deliverGroup}=require('./inbox-groups-push.cjs');
const {authorizeGroupMedia}=require('./inbox-group-media.cjs');
async function setup(type='office'){
 const h=fixture(),{conversationId:id}=await h.call('a',{op:'create',type,recipientIds:type==='private'?['b']:['admin','vip']});
 const now=h.now+1000;
 for(const [i,uid]of ['a','admin','vip','crew','b'].entries())await registerDevice(h.db,uid,{token:`ExpoPushToken[device${i}]`,platform:'android',inboxGroupProtocol:3,installationId:String(i).repeat(32),secret:'s'.repeat(64),preferences:{inbox:true}},{now});
 await h.call('a',{op:'send',conversationId:id,messageId:'m',body:'PRIVATE MESSAGE NEVER LOGGED'});
 const sent=[],event={params:{conversationId:id,messageId:'m'},data:{data:()=>h.records.get(`inbox_conversations/${id}/messages/m`)}};
 const dependencies={now,identity:async()=>({disabled:false}),recipientAllowed:()=>true,deviceAllowed:()=>true,transport:async(_,p)=>{sent.push(p);return{data:{status:'ok',id:'ticket'}};}};
 return{...h,id,now,sent,event,dependencies,deliver:()=>deliverGroup(h.db,event,dependencies)};
}
test('Office/Crew notify every eligible recipient device, never sender, generic body, no retry duplication',async()=>{
 for(const type of ['office','maintenance']){
 const h=await setup(type);await h.deliver();const count=h.sent.length;assert.equal(count,type==='office'?2:1);
 await h.deliver();assert.equal(h.sent.length,count);assert(h.sent.every(p=>p.body==='You have a new Inbox message.'));
 assert(!JSON.stringify(h.sent).includes('PRIVATE MESSAGE'));assert(!h.sent.some(p=>p.to==='ExpoPushToken[device0]'));
 }
});
test('left/blocked/role-revoked members are excluded, including a leave after event creation',async()=>{
 for(const mode of ['left','blocked','role','preference']){
 const h=await setup();
 if(mode==='left')await h.call('admin',{op:'leave',conversationId:h.id});
 if(mode==='blocked')h.records.set('user_blocks/admin/targets/a',{});
 if(mode==='role')h.records.get('users/admin').role='resident';
 if(mode==='preference')[...h.records.values()].filter(d=>d.uid==='admin'&&d.token).forEach(d=>d.preferences.inbox=false);
 await h.deliver();assert(!h.sent.some(p=>p.to==='ExpoPushToken[device1]'),mode);assert.equal(h.sent.length,1);
 }
});
test('new members cannot receive old events; system/history events never notify; receipt navigation authorizes membership',async()=>{
 const h=await setup();await h.call('a',{op:'add',conversationId:h.id,recipientIds:['admin']});
 await h.deliver();const notice=[...h.records.entries()].find(([p,d])=>p.startsWith('notification_events/')&&d.uid==='admin');
 const result=await notificationState(h.db,'admin',{resolve:notice[0].split('/')[1]},{now:h.now+1000});assert.equal(result.target.conversationId,h.id);
 await h.call('admin',{op:'leave',conversationId:h.id});await assert.rejects(notificationState(h.db,'admin',{resolve:notice[0].split('/')[1]},{now:h.now+1000}),/permission-denied/);
 const oldSent=h.sent.length;h.event.data.data=()=>({...h.records.get(`inbox_conversations/${h.id}/messages/m`),notify:false});await h.deliver();assert.equal(h.sent.length,oldSent);
});
test('authenticated group media enforces message generation and rejects bearer/shared/quarantined paths',async()=>{
 const h=await setup();const path=`inbox_conversations/${h.id}/messages/m`;
 h.records.get(path).attachments=[{id:'photo',verified:true,path:`inbox_groups/${h.id}/m/photo.jpg`}];
 assert((await authorizeGroupMedia(h.db,'admin',{conversationId:h.id,messageId:'m',attachmentId:'photo'})).path);
 await h.call('admin',{op:'leave',conversationId:h.id});
 await assert.rejects(authorizeGroupMedia(h.db,'admin',{conversationId:h.id,messageId:'m',attachmentId:'photo'}),/permission-denied/);
 h.records.get(path).attachments[0].quarantined=true;
 await assert.rejects(authorizeGroupMedia(h.db,'vip',{conversationId:h.id,messageId:'m',attachmentId:'photo'}),/permission-denied/);
});
test('late-added member never receives delayed earlier events and multiple devices receive one alert each',async()=>{
 const h=fixture(),{conversationId:id}=await h.call('a',{op:'create',type:'office',recipientIds:['admin']});
 await h.call('a',{op:'send',conversationId:id,messageId:'old',body:'Old fixture'});
 await h.call('a',{op:'add',conversationId:id,recipientIds:['vip']});
 const now=h.now+1000;
 for(const [uid,suffix] of [['vip','c'],['admin','a'],['admin','b']])await registerDevice(h.db,uid,{token:`ExpoPushToken[device${suffix}]`,platform:'android',inboxGroupProtocol:3,installationId:suffix.repeat(32),secret:'s'.repeat(64),preferences:{inbox:true}},{now});
 const sent=[],deps={now,identity:async()=>({disabled:false}),transport:async(_,p)=>{sent.push(p);return{data:{status:'ok',id:'ticket'}};}};
 await deliverGroup(h.db,{params:{conversationId:id,messageId:'old'},data:{data:()=>h.records.get(`inbox_conversations/${id}/messages/old`)}},deps);
 assert.equal(sent.length,2);assert(!sent.some(p=>p.to==='ExpoPushToken[devicec]'));
});
test('group sequence watermark preserves notifications for unseen messages sharing the same timestamp',async()=>{
 const h=await setup();
 await h.call('a',{op:'send',conversationId:h.id,messageId:'second',body:'Second fixture'});
 const first=h.records.get(`inbox_conversations/${h.id}/messages/m`),second=h.records.get(`inbox_conversations/${h.id}/messages/second`);second.createdAt=first.createdAt;
 await h.call('admin',{op:'read',conversationId:h.id,sequence:first.sequence});
 const {hash}=require('./inbox-groups.cjs');h.records.set(`notification_reads/${hash(`admin/inbox_conversations/${h.id}`)}`,{until:new Date(first.createdAt)});
 h.event.params.messageId='second';h.event.data.data=()=>second;await h.deliver();
 assert(h.sent.some(p=>p.to==='ExpoPushToken[device1]'));
 await notificationState(h.db,'admin',{ack:{category:'office',conversationId:h.id,readAt:second.createdAt}},{now:h.now+1000});
 const notice=[...h.records.values()].find(d=>d.uid==='admin'&&d.category==='inbox'&&d.sequence===second.sequence);assert.equal(notice.seen,false);
});
test('devices without group navigation support remain excluded from group pushes',async()=>{
 const h=await setup();for(const d of h.records.values())if(d.uid==='admin'&&d.token)delete d.inboxGroupProtocol;
 await h.deliver();assert(!h.sent.some(p=>p.to==='ExpoPushToken[device1]'));assert.equal(h.sent.length,1);
});
