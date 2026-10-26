const test=require('node:test');
const assert=require('node:assert/strict');
const {registerDevice,deliver,checkReceipts}=require('./inbox-push.cjs');
function fixture(){
 const records=new Map(),sent=[];let hook=()=>{};
 const ref=path=>({path,id:path.split('/').at(-1),get:async()=>snap(path),update:async patch=>records.set(path,{...records.get(path),...patch})});
 const snap=path=>({exists:records.has(path),id:ref(path).id,ref:ref(path),data:()=>records.get(path)});
 const db={doc:ref,collection(path){const filters=[];let max=Infinity;const q={doc:id=>ref(`${path}/${id}`),where(k,op,v){filters.push(d=>op==='in'?v.includes(d[k]):d[k]===v);return q;},limit(n){max=n;return q;},async get(){const docs=[...records].filter(([p,d])=>p.startsWith(path+'/')&&p.split('/').length===2&&filters.every(f=>f(d))).slice(0,max).map(([p])=>snap(p));return {docs,empty:!docs.length};}};return q;},async runTransaction(fn){hook();return fn({get:r=>r.get(),create(r,d){assert(!records.has(r.path));records.set(r.path,d);},set(r,d){records.set(r.path,d);},delete:r=>records.delete(r.path)});}};
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
