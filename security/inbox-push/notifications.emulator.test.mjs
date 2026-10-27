// Local fixtures only: no Auth accounts, resident data, Expo transport or live project.
import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const host=process.env.FIRESTORE_EMULATOR_HOST;
if(!/^(127\.0\.0\.1|localhost):\d+$/.test(host||''))throw Error('A loopback Firestore emulator is required.');
const project='demo-townloop-push',base=`http://${host}`,documents=`${base}/v1/projects/${project}/databases/(default)/documents`;
const require=createRequire(new URL('../../functions/package.json',import.meta.url));
const {initializeApp,deleteApp}=require('firebase-admin/app'),{getFirestore,Timestamp}=require('firebase-admin/firestore');
const {registerDevice,deliver,deliverContent,notificationState}=require('./inbox-push.cjs');
const app=initializeApp({projectId:project},'notification-emulator'),db=getFirestore(app);
const roles={Alice:'resident',Bob:'resident',Other:'resident',Admin:'admin',Vip:'vip',Crew:'crew',Pending:'resident'};
const headers={Authorization:'Bearer owner','Content-Type':'application/json'};
const profile=uid=>({id:uid,name:uid,email:`${uid}@example.invalid`,role:roles[uid],approved:uid!=='Pending'});
function token(uid){const encode=o=>Buffer.from(JSON.stringify(o)).toString('base64url'),now=Math.floor(Date.now()/1000);return `${encode({alg:'none',typ:'JWT'})}.${encode({iss:`https://securetoken.google.com/${project}`,aud:project,auth_time:now,user_id:uid,sub:uid,iat:now,exp:now+3600,email:`${uid}@example.invalid`,firebase:{sign_in_provider:'custom',identities:{}}})}.`;}
function value(x){if(x===null)return{nullValue:null};if(x instanceof Date)return{timestampValue:x.toISOString()};if(Array.isArray(x))return{arrayValue:{values:x.map(value)}};if(typeof x==='object')return{mapValue:{fields:fields(x)}};if(typeof x==='boolean')return{booleanValue:x};if(typeof x==='number')return{integerValue:String(x)};return{stringValue:x};}
const fields=x=>Object.fromEntries(Object.entries(x).map(([k,v])=>[k,value(v)]));
async function write(path,uid,data){const r=await fetch(`${documents}:commit`,{method:'POST',headers:{'Content-Type':'application/json',...(uid?{Authorization:`Bearer ${token(uid)}`}:{})},body:JSON.stringify({writes:[{update:{name:`projects/${project}/databases/(default)/documents/${path}`,fields:fields(data)},updateTransforms:[{fieldPath:'updatedAt',setToServerValue:'REQUEST_TIME'}]}]})});return {status:r.status,body:await r.text()};}
const allowed=async promise=>{const r=await promise;assert.equal(r.status,200,r.body);};
const denied=async promise=>{const r=await promise;assert.equal(r.status,403,r.body);};
const comment=(uid,id,extra={})=>({id,authorId:uid,author:uid,authorAvatar:'',authorEmail:'',unit:'TownLoop Resident',text:'fixture comment',timeAgo:'Just now',...extra});
const post=(comments=[])=>({userId:'Alice',storageDraft:false,author:'Alice',authorAvatar:'',authorEmail:'',unit:'TownLoop Resident',title:'Fixture',content:'Fixture',comments,createdAt:new Date('2026-01-01'),likes:0,likedBy:{}});
before(async()=>{
 const rules=await readFile(new URL('./firestore-replies.candidate.rules',import.meta.url),'utf8');
 const r=await fetch(`${base}/emulator/v1/projects/${project}:securityRules`,{method:'PUT',headers,body:JSON.stringify({rules:{files:[{name:'firestore.rules',content:rules}]}})});assert.equal(r.status,200,await r.text());
 const reset=await fetch(`${base}/emulator/v1/projects/${project}/databases/(default)/documents`,{method:'DELETE',headers});assert.equal(reset.status,200);
 await Promise.all(Object.keys(roles).map(uid=>db.doc(`users/${uid}`).set(profile(uid))));
});
after(async()=>{await db.terminate();await deleteApp(app);});
test('candidate compiles; each approved canonical role can append normal comments and verified discussion replies',async()=>{
 for(const uid of ['Bob','Admin','Vip','Crew']){
  const original=post([comment('Other','parent')]),path=`discussion_feed/role-${uid}`;await db.doc(path).set(original);
  const ordinary=comment(uid,'ordinary');await allowed(write(path,uid,{...original,comments:[...original.comments,ordinary]}));
  await allowed(write(path,uid,{...original,comments:[...original.comments,ordinary,comment(uid,'reply',{replyToCommentId:'parent',replyToCommentIndex:0})]}));
 }
});
test('reply parent/index, author identity, immutable history and approved-account checks are enforced',async()=>{
 const original=post([comment('Other','parent')]),path='discussion_feed/invalid';await db.doc(path).set(original);
 for(const patch of [{replyToCommentIndex:9},{replyToCommentId:'missing'},{replyToCommentIndex:-1},{replyToCommentIndex:'0'},{authorId:'Other'},{author:'Other'}])await denied(write(path,'Bob',{...original,comments:[...original.comments,comment('Bob','reply',{replyToCommentId:'parent',replyToCommentIndex:0,...patch})]}));
 await denied(write(path,'Bob',{...original,comments:[{...original.comments[0],text:'rewritten'},comment('Bob','new')]}));
 for(const uid of ['Pending',undefined])await denied(write(path,uid,{...original,comments:[...original.comments,comment('Bob','new')]}));
 const legacy=post([{id:'old',author:'Other',text:'legacy'}]);await db.doc('discussion_feed/legacy').set(legacy);
 await denied(write('discussion_feed/legacy','Bob',{...legacy,comments:[...legacy.comments,comment('Bob','new',{replyToCommentId:'old',replyToCommentIndex:0})]}));
});
test('verified numeric legacy comment IDs work; Marketplace and original web comments retain their old permissions',async()=>{
 const original=post([comment('Other',42)]);await db.doc('discussion_feed/numeric').set(original);
 await allowed(write('discussion_feed/numeric','Bob',{...original,comments:[...original.comments,comment('Bob','new',{replyToCommentId:'42',replyToCommentIndex:0})]}));
 for(const [collection,legacy]of [['marketplace_posts',false],['posts',true]]){
  const item={...post([comment('Other','parent')]),...(legacy?{authorId:'Alice'}:{description:'Fixture',price:'FREE',sold:false,claimed:false})};await db.doc(`${collection}/compat`).set(item);
  await denied(write(`${collection}/compat`,'Bob',{...item,comments:[...item.comments,comment('Bob','reply',{replyToCommentId:'parent',replyToCommentIndex:0})]}));
  await allowed(write(`${collection}/compat`,'Bob',{...item,comments:[...item.comments,comment('Bob','normal')]}));
 }
});
test('device tokens, event receipts, read watermarks and delivery claims stay client-inaccessible, including Admin',async()=>{
 for(const collection of ['notification_devices','notification_events','notification_reads','notification_deliveries']){
  await db.doc(`${collection}/private-fixture`).set({uid:'Bob'});
  for(const uid of ['Bob','Admin',undefined]){
   const r=await fetch(`${documents}/${collection}/private-fixture`,{headers:uid?{Authorization:`Bearer ${token(uid)}`}:{}});assert.equal(r.status,403);
   await denied(write(`${collection}/forged`,uid,{uid:'Bob'}));
  }
 }
});
test('actual Admin SDK transactions/aggregations exercise all four categories, multi-device deduplication, generic payloads and recipient isolation',async()=>{
 const now=Date.now(),preferences={inbox:true,marketplace:true,discussion:true,workorders:true};
 const device=async(uid,suffix)=>registerDevice(db,uid,{token:`ExpoPushToken[${suffix}]`,platform:'android',installationId:createHash('sha256').update(suffix).digest('hex').slice(0,32),secret:'s'.repeat(64),preferences},{now});
 await device('Bob','bob1');await device('Bob','bob2');await device('Alice','alice');await device('Other','other');
 const sent=[],options={now,identity:async()=>({disabled:false,tokensValidAfterTime:new Date(0).toISOString()}),transport:async(path,payload)=>{assert.equal(path,'send');sent.push(payload);return{data:{status:'ok',id:`ticket-${sent.length}`}};}};
 const event=(uid,id,before,after)=>({authId:uid,authType:'unknown',time:new Date(now).toISOString(),params:{chatId:id,documentId:id},data:{before:{data:()=>before},after:{data:()=>after}}});
 for(const collection of ['resident_chats','marketplace_chats']){
  const message={id:'new',senderId:'Alice',senderName:'Alice',senderRole:'resident',...(collection==='marketplace_chats'?{text:'PRIVATE FIXTURE'}:{body:'PRIVATE FIXTURE'})};
  const after={identityVersion:2,participantIds:['Alice','Bob'],...(collection==='marketplace_chats'?{sellerId:'Alice',buyerId:'Bob',unreadForBuyer:true}:{}),messages:[message]};await db.doc(`${collection}/incoming`).set(after);
  const e=event('Alice','incoming',{...after,messages:[]},after);await deliver(db,e,collection,options);await deliver(db,e,collection,options);
 }
 const before={...post([comment('Other','parent')]),userId:'Bob'},after={...before,comments:[...before.comments,comment('Alice','incoming',{replyToCommentId:'parent',replyToCommentIndex:0})]};await db.doc('discussion_feed/incoming').set(after);
 const discussion=event('Alice','incoming',before,after);await deliverContent(db,discussion,'discussion_feed',options);await deliverContent(db,discussion,'discussion_feed',options);
 const order={userId:'Bob',storageDraft:false,status:'In Progress'},done={...order,status:'Done',completedAt:Timestamp.fromMillis(now)};await db.doc('work_orders/incoming').set(done);
 const completed=event('Crew','incoming',order,done);await deliverContent(db,completed,'work_orders',options);await deliverContent(db,completed,'work_orders',options);
 assert.equal(sent.length,9);assert.equal(new Set(sent.map(p=>p.channelId)).size,4);assert(!sent.some(p=>p.to==='ExpoPushToken[alice]'));
 assert(!JSON.stringify(sent).includes('PRIVATE FIXTURE'));assert(sent.every(p=>/^[a-f0-9]{64}$/.test(p.data.noticeId)&&p.data.conversationId===undefined));
 const state=await notificationState(db,'Bob',{}, {now});assert.deepEqual(state.counts,{inbox:1,marketplace:1,discussion:1,workorders:1});
 const resolved=await notificationState(db,'Bob',{resolve:sent[0].data.noticeId},{now});assert.equal(resolved.target.category,'friend');
 await assert.rejects(()=>notificationState(db,'Alice',{resolve:sent[0].data.noticeId},{now}),/permission-denied/);
 await notificationState(db,'Bob',{ack:{category:'friend',conversationId:'incoming',readAt:now}},{now});assert.equal((await notificationState(db,'Bob',{}, {now})).counts.inbox,0);
 await db.doc('user_blocks/Bob/targets/Alice').set({});
 const blockedAfter={identityVersion:2,participantIds:['Alice','Bob'],messages:[{id:'blocked',senderId:'Alice',senderName:'Alice',senderRole:'resident',body:'PRIVATE FIXTURE'}]};await db.doc('resident_chats/blocked').set(blockedAfter);
 await deliver(db,event('Alice','blocked',{...blockedAfter,messages:[]},blockedAfter),'resident_chats',options);assert.equal(sent.length,9);
});
test('production index contract covers real aggregate and acknowledgment query shapes (emulator does not enforce indexes)',async()=>{
 const indexes=JSON.parse(await readFile(new URL('./notification.indexes.json',import.meta.url),'utf8')).indexes;
 for(const fields of [['uid','category','seen','expiresAt'],['uid','target','seen','createdAt']])assert(indexes.some(i=>i.collectionGroup==='notification_events'&&i.queryScope==='COLLECTION'&&JSON.stringify(i.fields.map(f=>f.fieldPath))===JSON.stringify(fields)));
});
