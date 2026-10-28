const test=require('node:test');
const assert=require('node:assert/strict');
const {registerDevice,deliver,checkReceipts}=require('./inbox-push.cjs');
function fixture(){
 const records=new Map(),sent=[];let hook=()=>{};
 const ref=path=>({path,id:path.split('/').at(-1),get:async()=>snap(path),update:async patch=>records.set(path,{...records.get(path),...patch})});
 const snap=path=>({exists:records.has(path),id:ref(path).id,ref:ref(path),data:()=>records.get(path)});
 const db={doc:ref,collection(path){const filters=[];let max=Infinity;const q={doc:id=>ref(`${path}/${id}`),where(k,op,v){filters.push(d=>op==='in'?v.includes(d[k]):op==='>'?d[k]>v:op==='<='?d[k]<=v:d[k]===v);return q;},limit(n){max=n;return q;},count(){return{get:async()=>{const count=(await q.get()).docs.length;return {data:()=>({count})};}};},async get(){const docs=[...records].filter(([p,d])=>p.startsWith(path+'/')&&p.split('/').length===2&&filters.every(f=>f(d))).slice(0,max).map(([p])=>snap(p));return {docs,empty:!docs.length};}};return q;},async runTransaction(fn){hook();return fn({get:r=>r.get(),create(r,d){assert(!records.has(r.path));records.set(r.path,d);},set(r,d){records.set(r.path,d);},delete:r=>records.delete(r.path)});}};
 const now=Date.now();const identity=async()=>({disabled:false,tokensValidAfterTime:new Date(0).toISOString()});
 const transport=async(path,payload)=>{sent.push(payload);return path==='send'?{data:{status:'ok',id:`ticket${sent.length}`}}:{data:{ticket1:{status:'error',details:{error:'DeviceNotRegistered'}}}};};
 const profiles={a:{name:'A',role:'resident',approved:true},b:{name:'B',role:'resident',approved:true},admin:{name:'Admin',role:'admin',approved:true},vip:{name:'VIP',role:'vip',approved:true},crew:{name:'Crew',role:'crew',approved:true}};
 for(const [id,p]of Object.entries(profiles))records.set(`users/${id}`,p);
 const data={token:'ExpoPushToken[aaa]',platform:'android',installationId:'a'.repeat(32),secret:'s'.repeat(64)};
 const register=(uid='b',patch={})=>registerDevice(db,uid,{...data,...patch},{now});
 const message={id:'m1',senderId:'a',senderName:'A',senderRole:'resident',body:'PRIVATE CONTENT'};
 const chat={identityVersion:2,participantIds:['a','b'],messages:[message]};records.set('resident_chats/chat',chat);
 const event={authId:'a',authType:'unknown',time:new Date(now).toISOString(),params:{chatId:'chat'},data:{before:{data:()=>undefined},after:{data:()=>chat}}};
 return {records,db,now,sent,data,register,event,chat,deliver:(patch={})=>deliver(db,event,'resident_chats',{now,identity,transport,...patch}),hook:fn=>{hook=fn;}};
}
test('authenticated approved registration; device capability prevents token theft and supports account switch',async()=>{
 const h=fixture();await assert.rejects(()=>h.register(''),/unauthenticated/);h.records.set('users/pending',{role:'resident',approved:false});await assert.rejects(()=>h.register('pending'),/permission-denied/);
 await h.register();await assert.rejects(()=>h.register('a',{secret:'x'.repeat(64)}),/permission-denied/);
 await h.register('a');assert.equal([...h.records].find(([p])=>p.startsWith('notification_devices/'))[1].uid,'a');
});
test('two recipient devices, no sender, generic payload, event replay/receipt/edit/delete do not alert',async()=>{
 const h=fixture();await h.register();await h.register('b',{token:'ExpoPushToken[bbb]',installationId:'b'.repeat(32)});await h.register('a',{token:'ExpoPushToken[ccc]',installationId:'c'.repeat(32)});
 await h.deliver();await h.deliver();assert.equal(h.sent.length,2);assert(h.sent.every(p=>p.body==='You have a new Inbox message.'));assert(!JSON.stringify(h.sent).includes('PRIVATE CONTENT'));assert(!JSON.stringify(h.sent).includes('recipientId'));
 h.event.data.before.data=()=>h.chat;await h.deliver();h.event.data.after.data=()=>undefined;await h.deliver();assert.equal(h.sent.length,2);
});
test('disabled preference, expired token, blocked, unapproved or disabled identity suppress delivery',async()=>{
 for(const mode of ['off','expired','blocked','pending','auth']){const h=fixture();await h.register();const device=[...h.records].find(([p])=>p.startsWith('notification_devices/'));
 if(mode==='off')device[1].enabled=false;if(mode==='expired')device[1].expiresAt=new Date(0);if(mode==='blocked')h.records.set('user_blocks/b/targets/a',{});if(mode==='pending')h.records.get('users/b').approved=false;
 await h.deliver(mode==='auth'?{identity:async()=>({disabled:true})}:{});assert.equal(h.sent.length,0,mode);}
});
test('logout revokes via installation capability even after Auth sign-out; unrelated secret cannot revoke',async()=>{
 const h=fixture();await h.register();await assert.rejects(()=>registerDevice(h.db,null,{...h.data,remove:true,secret:'z'.repeat(64)},{now:h.now}),/permission-denied/);
 await registerDevice(h.db,null,{...h.data,remove:true},{now:h.now});await h.deliver();assert.equal(h.sent.length,0);
});
test('delivery failures cannot replay; invalid receipts retire matching device only',async()=>{
 const h=fixture();await h.register();await h.deliver({transport:async()=>{throw Error('timeout');}});await h.deliver();assert.equal(h.sent.length,0);assert([...h.records.values()].some(d=>d.state==='unknown'));
 const f=fixture();await f.register();await f.deliver();await checkReceipts(f.db,{now:f.now,transport:async()=>({data:{ticket1:{status:'error',details:{error:'DeviceNotRegistered'}}}})});assert(![...f.records.keys()].some(p=>p.startsWith('notification_devices/')));
});
test('Office and Crew Inbox notify only authorized recipients; all four approved roles can register',async()=>{
 for(const uid of ['a','admin','vip','crew']){const h=fixture();await h.register(uid);}
 for(const [collection,receiver]of [['office_chats','admin'],['office_chats','vip'],['maintenance_chats','crew']]){
  const h=fixture();await h.register(receiver);const chat={residentId:'a',messages:h.chat.messages};h.records.set(`${collection}/chat`,chat);h.event.data.after.data=()=>chat;
  await deliver(h.db,h.event,collection,{now:h.now,identity:async()=>({disabled:false}),transport:async(_,p)=>{h.sent.push(p);return {data:{status:'ok',id:'one'}};}});
  assert.equal(h.sent.length,1);assert.equal(h.sent[0].data.category,collection==='office_chats'?'office':'maintenance');
 }
});
test('Marketplace uses its actual seller/buyer schema without identityVersion; leave markers are not incoming messages',async()=>{
 const h=fixture();await h.register();const chat={sellerId:'a',buyerId:'b',participantIds:['a','b'],messages:[{id:'one',senderId:'a',senderName:'A',text:'Private'}]};h.records.set('marketplace_chats/chat',chat);h.event.data.after.data=()=>chat;
 await deliver(h.db,h.event,'marketplace_chats',{now:h.now,identity:async()=>({disabled:false}),transport:async(_,p)=>{h.sent.push(p);return {data:{status:'ok',id:'one'}};}});assert.equal(h.sent.length,1);
 chat.messages[0].id='two';chat.buyerLeft=true;await deliver(h.db,h.event,'marketplace_chats',{now:h.now,identity:async()=>({disabled:false}),transport:async()=>{throw Error('must not send');}});assert.equal(h.sent.length,1);
});
test('preference revocation before claim, token rotation and expired event are safe',async()=>{
 const h=fixture();await h.register();h.hook(()=>{const d=[...h.records].find(([p])=>p.startsWith('notification_devices/'));if(d)d[1].enabled=false;});await h.deliver();assert.equal(h.sent.length,0);
 const f=fixture();await f.register();await f.register('b',{token:'ExpoPushToken[new]',previousToken:f.data.token});assert.equal([...f.records.keys()].filter(p=>p.startsWith('notification_devices/')).length,1);
 f.event.time=new Date(f.now-3600001).toISOString();await f.deliver();assert.equal(f.sent.length,0);
});
test('registration ignores forged recipient UID and uses only verified callable authentication',async()=>{
 const h=fixture();await h.register('a',{uid:'b',recipientId:'b'});
 const device=[...h.records].find(([p])=>p.startsWith('notification_devices/'))[1];
 assert.equal(device.uid,'a');assert.equal(device.recipientId,undefined);
});
test('four category preferences persist, Marketplace uses its own text/channel, disabled categories do not send',async()=>{
 const h=fixture();await h.register('b',{preferences:{inbox:false,marketplace:true,discussion:false,workorders:false}});await h.deliver();assert.equal(h.sent.length,0);
 const chat={sellerId:'a',buyerId:'b',participantIds:['a','b'],messages:[{id:'one',senderId:'a',senderName:'A',text:'PRIVATE'}]};h.records.set('marketplace_chats/chat',chat);h.event.data.after.data=()=>chat;
 await deliver(h.db,h.event,'marketplace_chats',{now:h.now,identity:async()=>({disabled:false}),transport:async(_,p)=>{h.sent.push(p);return {data:{status:'ok',id:'one'}};}});
 assert.equal(h.sent[0].body,'You have a new Marketplace message.');assert.equal(h.sent[0].channelId,'marketplace');assert.equal(h.sent[0].badge,1);
});
test('discussion replies/completions deliver once per recipient device, suppress blocks/self and leave no private content in receipts',async()=>{
 const {deliverContent,notificationState}=require('./inbox-push.cjs');
 for(const collection of ['discussion_feed','work_orders']){
  const h=fixture();await h.register('b',{preferences:{discussion:true,workorders:true}});
  h.records.get('users/a').role=collection==='work_orders'?'crew':'resident';
  const before={userId:'b',storageDraft:false,comments:[],status:'In Progress'};
  const after={...before,status:'Done',completedAt:new Date(h.now),comments:[{id:'c',authorId:'a',text:'PRIVATE COMMENT'}]};
  h.records.set(`${collection}/target`,after);
  const e={...h.event,params:{documentId:'target'},data:{before:{data:()=>before},after:{data:()=>after}}};
  const options={now:h.now,identity:async()=>({disabled:false}),transport:async(_,p)=>{h.sent.push(p);return {data:{status:'ok',id:'one'}};}};
  await deliverContent(h.db,e,collection,options);await deliverContent(h.db,e,collection,options);assert.equal(h.sent.length,1);
  assert(!JSON.stringify([...h.records].filter(([p])=>p.startsWith('notification_'))).includes('PRIVATE COMMENT'));
  assert.equal(h.sent[0].badge,1);
  const category=collection==='work_orders'?'workorders':'discussion';
  const result=await notificationState(h.db,'b',{ack:{category,conversationId:'target'}},{now:h.now});assert.equal(result.counts[category],0);
  await assert.rejects(()=>notificationState(h.db,'',{ack:{category,conversationId:'target'}}),/unauthenticated/);
 }
});
test('notification acknowledgments cannot alter another account receipts or bypass conversation authorization',async()=>{
 const {notificationState}=require('./inbox-push.cjs');const h=fixture();await h.register();await h.deliver();
 h.records.set('resident_chats/other',{identityVersion:2,participantIds:['admin','vip'],messages:[]});
 await assert.rejects(()=>notificationState(h.db,'b',{ack:{category:'friend',conversationId:'other'}},{now:h.now}),/permission-denied/);
 const a=await notificationState(h.db,'a',{ack:{category:'friend',conversationId:'chat'}},{now:h.now});assert.equal(a.counts.inbox,0);
 const b=await notificationState(h.db,'b',{}, {now:h.now});assert.equal(b.counts.inbox,1);
});
test('read watermark suppresses delayed trigger creation, and existing chat read cursor suppresses already-read messages',async()=>{
 const {notificationState}=require('./inbox-push.cjs');const h=fixture();await h.register();
 await notificationState(h.db,'b',{ack:{category:'friend',conversationId:'chat',readAt:h.now}},{now:h.now});await h.deliver();assert.equal(h.sent.length,0);
 const f=fixture();await f.register();f.chat.readBy={b:1};await f.deliver();assert.equal(f.sent.length,0);
});
test('acknowledgments page more than 100 events safely and preserve events newer than offline read cutoff',async()=>{
 const {notificationState}=require('./inbox-push.cjs');const h=fixture();
 for(let i=0;i<101;i++)h.records.set(`notification_events/e${i}`,{uid:'b',target:'resident_chats/chat',category:'inbox',seen:false,createdAt:new Date(h.now-100),expiresAt:new Date(h.now+10000)});
 h.records.set('notification_events/new',{uid:'b',target:'resident_chats/chat',category:'inbox',seen:false,createdAt:new Date(h.now+1),expiresAt:new Date(h.now+10000)});
 const data={ack:{category:'friend',conversationId:'chat',readAt:h.now}};
 const first=await notificationState(h.db,'b',data,{now:h.now});assert.equal(first.ackPending,true);assert.equal(first.counts.inbox,2);
 const next=await notificationState(h.db,'b',data,{now:h.now});assert.equal(next.ackPending,false);assert.equal(next.counts.inbox,1);
});
test('push payload uses opaque IDs; only authorized recipient can resolve a destination, with fresh blocking checks',async()=>{
 const {notificationState}=require('./inbox-push.cjs');const h=fixture();await h.register();await h.deliver();
 const payload=h.sent[0].data;assert.equal(payload.type,'notice');assert.match(payload.noticeId,/^[a-f0-9]{64}$/);assert.equal(payload.conversationId,undefined);
 const result=await notificationState(h.db,'b',{resolve:payload.noticeId},{now:h.now});assert.equal(result.target.conversationId,'chat');
 await assert.rejects(()=>notificationState(h.db,'a',{resolve:payload.noticeId},{now:h.now}),/permission-denied/);
 h.records.set('user_blocks/b/targets/a',{});await assert.rejects(()=>notificationState(h.db,'b',{resolve:payload.noticeId},{now:h.now}),/permission-denied/);
});


test('tester-only Android delivery excludes iOS devices and other recipient accounts',async()=>{
 const h=fixture();await h.register('b');await h.register('b',{token:'ExpoPushToken[ios]',installationId:'d'.repeat(32),platform:'ios'});
 await h.deliver({recipientAllowed:uid=>uid==='b',deviceAllowed:device=>device.platform==='android'});
 assert.equal(h.sent.length,1);assert.equal(h.sent[0].to,'ExpoPushToken[aaa]');
 const excluded=fixture();await excluded.register('b');await excluded.deliver({recipientAllowed:uid=>uid==='other',deviceAllowed:device=>device.platform==='android'});assert.equal(excluded.sent.length,0);
});

// Live triggers previously acknowledged events without explaining a suppressed push.
test('delivery tracing reports fixed reason codes without message or identity data',async()=>{
 for(const mode of ['missing-auth','sender-denied','not-new-message','tester-excluded','preference-off','sent']){
  const h=fixture(),stages=[];await h.register();
  if(mode==='missing-auth')delete h.event.authId;
  if(mode==='sender-denied')h.records.get('users/a').approved=false;
  if(mode==='not-new-message')h.event.data.before.data=()=>h.chat;
  if(mode==='preference-off')await h.register('b',{preferences:{inbox:false}});
  await h.deliver({trace:code=>stages.push(code),recipientAllowed:()=>mode!=='tester-excluded'});
  const expected={'missing-auth':'principal_missing','sender-denied':'sender_not_authorized','not-new-message':'not_new_message','tester-excluded':'recipient_excluded','preference-off':'device_or_recipient_ineligible',sent:'transport_accepted'}[mode];
  assert(stages.includes(expected),mode+': '+JSON.stringify(stages));
  assert(stages.every(s=>/^[a-z_]+$/.test(s)));assert(!JSON.stringify(stages).includes('PRIVATE CONTENT'));
 }
});
