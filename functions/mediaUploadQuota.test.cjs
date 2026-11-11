'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { issue, issueAuthenticated, finalized, reservationId, TTL_MS } = require('./mediaUploadQuota.cjs');
const NOW = 1800000000000, BUCKET = 'fixture.firebasestorage.app';
function fixture() {
 const records = new Map([
  ['users/resident', {role:'resident',approved:true}], ['users/other', {role:'resident',approved:true}],
  ['users/admin', {role:'admin',approved:true}], ['users/vip', {role:'vip',approved:true}], ['users/crew', {role:'crew',approved:true}],
  ['discussion_feed/post', {userId:'resident',storageDraft:false}], ['posts/legacy', {authorId:'resident',storageDraft:false}],
  ['marketplace_posts/listing', {userId:'resident',storageDraft:false}], ['marketItems/legacy', {authorId:'resident',storageDraft:false}],
  ['work_orders/order', {userId:'resident',storageDraft:false,status:'Open'}],
 ]);
 let pending = Promise.resolve();
 const clone = value => value === undefined ? undefined : structuredClone(value);
 const db = { doc: path => ({path}), runTransaction: fn => {
  const result = pending.then(async () => {
   const next = new Map([...records].map(([key,value]) => [key,clone(value)])); let wrote = false;
   const tx = { get: async ref => { assert.equal(wrote,false,'all reads must precede writes'); return {exists:next.has(ref.path),data:()=>clone(next.get(ref.path))}; },
    set: (ref,data,options) => { wrote = true; next.set(ref.path, options?.merge ? {...next.get(ref.path),...clone(data)} : clone(data)); },
    update: (ref,data) => { wrote = true; assert.ok(next.has(ref.path)); next.set(ref.path,{...next.get(ref.path),...clone(data)}); } };
   const result = await fn(tx); records.clear(); for (const entry of next) records.set(...entry); return result;
  }); pending = result.catch(()=>{}); return result;
 }};
 const data = (overrides={}) => ({path:'feed/photo.jpg',bytes:2048,contentType:'image/jpeg',metadata:{uploadedBy:'resident',recordId:'post',collection:'discussion_feed',securityVersion:'1'},...overrides});
 const call = (uid='resident',input=data(),now=NOW) => issue(db,uid,input,{now});
 return {db,records,data,call,ticket: id => records.get('safety_limits/resident').uploads[id]};
}
function object(data,id,extra={}) { return {bucket:BUCKET,name:data.path,size:String(data.bytes),contentType:data.contentType,metadata:{...data.metadata,quotaReservation:id},generation:'123',timeCreated:new Date(NOW+1).toISOString(),...extra}; }
test('exact sequential and concurrent reservations charge once and preserve unrelated quota fields', async () => {
 const h=fixture(); h.records.set('safety_limits/resident',{reports:3,activity:{comments:{dayCount:2}}});
 const tickets=await Promise.all(Array.from({length:8},()=>h.call()));
 assert.ok(tickets.every(ticket=>ticket.reservationId===tickets[0].reservationId));
 assert.equal(tickets[0].reservationId,reservationId('resident','feed/photo.jpg'));
 assert.equal((await h.call()).expiresAt,NOW+TTL_MS);
 const q=h.records.get('safety_limits/resident'); assert.equal(q.activity.media.windowCount,1); assert.equal(q.activity.media.bytesDay,2048); assert.equal(q.activity.comments.dayCount,2); assert.equal(q.reports,3);
});
test('metadata, size and MIME differences cannot reuse the same pending ticket', async () => {
 const h=fixture(); await h.call();
 h.records.set('discussion_feed/second',{userId:'resident',storageDraft:false});
 for(const patch of [{bytes:4096},{contentType:'image/png'},{metadata:{...h.data().metadata,recordId:'second'}}]) await assert.rejects(h.call('resident',h.data(patch)),/failed-precondition/);
 assert.equal(h.records.get('safety_limits/resident').activity.media.windowCount,1);
});
test('missing, unapproved, deleted and unsupported canonical profiles cannot reserve', async () => {
 for(const profile of [undefined,{role:'resident',approved:false},{role:'resident',approved:true,deletionPending:true},{role:'staff',approved:true}]) {
  const h=fixture(); if(profile)h.records.set('users/resident',profile);else h.records.delete('users/resident');
  await assert.rejects(h.call(),/permission-denied/); assert.equal(h.records.has('safety_limits/resident'),false);
 }
});
test('same ticket retry rechecks canonical approval and parent authorization', async () => {
 const h=fixture(); await h.call(); h.records.set('users/resident',{role:'resident',approved:false}); await assert.rejects(h.call(),/permission-denied/);
 h.records.set('users/resident',{role:'resident',approved:true});h.records.set('discussion_feed/post',{userId:'other',storageDraft:false}); await assert.rejects(h.call(),/permission-denied/);
});
test('Auth disabled, revoked, anonymous, malformed or absent identity fails before transaction', async () => {
 const h=fixture(),valid={uid:'resident',tokensValidAfterTime:new Date(NOW-10000).toISOString()};
 const request={auth:{uid:'resident',token:{auth_time:NOW/1000}},data:h.data()};
 for(const identity of [{...valid,disabled:true},{...valid,tokensValidAfterTime:new Date(NOW+10000).toISOString()},{...valid,uid:'other'}]) await assert.rejects(issueAuthenticated(h.db,async()=>identity,request,{now:NOW}),/unauthenticated/);
 for(const auth of [undefined,{uid:'resident',token:{}},{uid:'resident',token:{auth_time:NOW/1000,firebase:{sign_in_provider:'anonymous'}}}]) await assert.rejects(issueAuthenticated(h.db,async()=>valid,{...request,auth},{now:NOW}),/unauthenticated/);
 assert.equal(h.records.has('safety_limits/resident'),false);
 assert.ok((await issueAuthenticated(h.db,async()=>valid,request,{now:NOW})).reservationId);
});
test('social owners only; approved staff can attach to published non-Done workorders', async () => {
 const h=fixture();
 for(const uid of ['other','admin','vip','crew']) await assert.rejects(h.call(uid,h.data({metadata:{...h.data().metadata,uploadedBy:uid}})),/permission-denied/);
 for(const uid of ['resident','admin','vip','crew']) {
  const input=h.data({path:`work_orders/${uid}.jpg`,metadata:{uploadedBy:uid,recordId:'order',collection:'work_orders',securityVersion:'1'}});
  assert.ok((await h.call(uid,input)).reservationId);
  h.records.get('work_orders/order').status='Done'; await assert.rejects(h.call(uid,input),/permission-denied/); h.records.get('work_orders/order').status='Open';
 }
 await assert.rejects(h.call('other',h.data({path:'work_orders/other.jpg',metadata:{uploadedBy:'other',recordId:'order',collection:'work_orders',securityVersion:'1'}})),/permission-denied/);
});
test('only owned unexpired drafts upload; staff cannot use another resident draft', async () => {
 const h=fixture(); h.records.set('work_orders/order',{userId:'resident',storageDraft:true,storageDraftExpiresAt:new Date(NOW+1000)});
 const input=h.data({path:'work_orders/photo.jpg',metadata:{uploadedBy:'resident',recordId:'order',collection:'work_orders',securityVersion:'1'}});
 await h.call('resident',input);
 await assert.rejects(h.call('crew',{...input,metadata:{...input.metadata,uploadedBy:'crew'}}),/permission-denied/);
 await assert.rejects(h.call('resident',input,NOW+1001),/permission-denied/);
});
test('invalid paths, mismatched linkage, wrong MIME and byte bounds never consume quota', async () => {
 const h=fixture();
 for(const patch of [{path:'newsletters/id/document.pdf'},{path:'feed/nested/photo.jpg'},{path:'feed/..'},{bytes:0},{bytes:25*1024*1024},{bytes:1.5},{contentType:'image/svg+xml'},{contentType:'application/octet-stream'},{metadata:{...h.data().metadata,uploadedBy:'other'}},{metadata:{...h.data().metadata,collection:'marketplace_posts'}},{metadata:{...h.data().metadata,securityVersion:'2'}},{metadata:{...h.data().metadata,recordId:'../post'}}]) await assert.rejects(h.call('resident',h.data(patch)),/invalid-argument/);
 await assert.rejects(h.call('resident',h.data({path:'work_orders/video.mp4',contentType:'video/mp4',metadata:{uploadedBy:'resident',recordId:'order',collection:'work_orders',securityVersion:'1'}})),/invalid-argument/);
 assert.equal(h.records.has('safety_limits/resident'),false);
});
test('quota rejects the 41st minute reservation and 1GiB daily overflow without creating a ticket', async () => {
 const h=fixture(); for(let i=0;i<40;i++)await h.call('resident',h.data({path:`feed/${i}.jpg`}));
 await assert.rejects(h.call(),error=>error.code==='resource-exhausted');
 assert.equal(Object.keys(h.records.get('safety_limits/resident').uploads).length,40);
 const q=h.records.get('safety_limits/resident');q.activity.media={windowAt:new Date(NOW),dayAt:new Date(NOW),windowCount:0,dayCount:0,bytesDay:1073741823};
 await assert.rejects(h.call(),error=>error.code==='resource-exhausted');
});
test('expired ticket maps are pruned and expiration recharges identical uploads', async () => {
 const h=fixture(),first=await h.call();
 h.records.get('safety_limits/resident').uploads.old={status:'complete',expiresAt:new Date(NOW-1)};
 await h.call('resident',h.data({path:'feed/next.jpg'})); assert.equal(h.records.get('safety_limits/resident').uploads.old,undefined);
 await h.call('resident',h.data(),NOW+TTL_MS+1); assert.equal(h.ticket(first.reservationId).issuedAt.getTime(),NOW+TTL_MS+1);
 assert.equal(h.records.get('safety_limits/resident').activity.media.dayCount,3);
});
test('trusted finalizer completes only exact matching ticket and duplicate events are idempotent', async () => {
 const h=fixture(),ticket=await h.call(),event=object(h.data(),ticket.reservationId);
 assert.equal(await finalized(h.db,event,{bucket:BUCKET,now:NOW+100}),true);
 const before=structuredClone(h.ticket(ticket.reservationId));
 assert.equal(await finalized(h.db,event,{bucket:BUCKET,now:NOW+200}),true); assert.deepEqual(h.ticket(ticket.reservationId),before);
 await assert.rejects(h.call(),/already-exists/);
 assert.equal(h.records.get('safety_limits/resident').activity.media.windowCount,1);
});
test('finalizer rejects wrong bucket/path/bytes/MIME/metadata/generation and old object events', async () => {
 const h=fixture(),ticket=await h.call(),event=object(h.data(),ticket.reservationId);
 for(const patch of [{bucket:'other'},{name:'feed/other.jpg'},{size:'4096'},{contentType:'video/mp4'},{metadata:{...event.metadata,uploadedBy:'other'}},{metadata:{...event.metadata,recordId:'other'}},{metadata:{...event.metadata,quotaReservation:'wrong'}},{generation:''},{timeCreated:new Date(NOW-1).toISOString()},{timeCreated:new Date(NOW+TTL_MS+1).toISOString()}]) assert.equal(await finalized(h.db,{...event,...patch},{bucket:BUCKET}),false);
 assert.equal(h.ticket(ticket.reservationId).status,'issued');
 assert.equal(await finalized(h.db,event,{bucket:BUCKET}),true);
 assert.equal(await finalized(h.db,{...event,generation:'456'},{bucket:BUCKET}),false);
});
test('other-user and other-path tickets cannot acknowledge an object; maintenance fences issuing', async () => {
 const h=fixture(),ticket=await h.call();
 h.records.set('database_cleanup_control/active',{referenceWritesBlocked:true});
 await assert.rejects(h.call(),/failed-precondition/);
 assert.equal(await finalized(h.db,object(h.data(),ticket.reservationId,{metadata:{...h.data().metadata,uploadedBy:'other',quotaReservation:ticket.reservationId}}),{bucket:BUCKET}),false);
});

test('all existing social namespaces and video MIME types keep owner-only upload support', async () => {
 const h=fixture();
 for(const [folder,collection,recordId]of [['feed','discussion_feed','post'],['feed','posts','legacy'],['marketplace','marketplace_posts','listing'],['marketplace','marketItems','legacy']]) {
  for(const [index,contentType]of ['image/jpeg','video/mp4','video/quicktime','video/webm'].entries()) {
   const input=h.data({path:`${folder}/${collection}-${index}.media`,contentType,metadata:{uploadedBy:'resident',recordId,collection,securityVersion:'1'}});
   assert.ok((await h.call('resident',input)).reservationId);
  }
 }
});
test('500 daily uploads are bounded even after the minute window resets', async () => {
 const h=fixture(); h.records.set('safety_limits/resident',{activity:{media:{windowAt:new Date(NOW-120000),dayAt:new Date(NOW-120000),windowCount:40,dayCount:500,bytesDay:0}}});
 await assert.rejects(h.call(),error=>error.code==='resource-exhausted');
 assert.equal(h.records.get('safety_limits/resident').uploads,undefined);
});
test('scoped entry exports only media functions with App Check enforcement disabled', async () => {
 const vm=require('node:vm'),fs=require('node:fs'),calls=[];let initialized=false;
 const modules={
  'firebase-functions/v2/https':{onCall:(options,handler)=>({options,handler}),HttpsError:class extends Error{constructor(code,message){super(message);this.code=code;}}},
  'firebase-functions/v2/storage':{onObjectFinalized:(options,handler)=>({options,handler})},
  'firebase-admin/firestore':{getFirestore:()=>({fixture:true})},
  'firebase-admin/auth':{getAuth:()=>({getUser:async uid=>({uid})})},
  'firebase-admin/app':{getApp:()=>({options:{storageBucket:BUCKET}}),getApps:()=>[],initializeApp:()=>{initialized=true;}},
  './mediaUploadQuota.cjs':{issueAuthenticated:async(...args)=>{calls.push(['issue',...args]);return{reservationId:'fixture'};},finalized:async(...args)=>{calls.push(['finalized',...args]);return true;}},
 };
 const exports={};vm.runInNewContext(fs.readFileSync(require.resolve('./media-upload-entry.cjs'),'utf8'),{exports,require:key=>{assert.ok(modules[key],key);return modules[key];}});
 assert.equal(initialized,true);assert.deepEqual(Object.keys(exports).sort(),['completeMediaUpload','issueMediaUpload']);
 assert.equal(exports.issueMediaUpload.options.enforceAppCheck,false);
 const request={auth:{uid:'resident'},data:{}};await exports.issueMediaUpload.handler(request);assert.equal(calls[0][3],request);
 await exports.completeMediaUpload.handler({data:{name:'fixture'}});assert.equal(calls[1][3].bucket,'cc-livingcommunity-app.firebasestorage.app');
});

test('immediate account revocation marker denies new and retried media reservations',async()=>{
 const h=fixture();await h.call();h.records.set('account_access_revocations/resident',{revokedAt:new Date(NOW)});
 await assert.rejects(h.call(),/permission-denied/);
 await assert.rejects(h.call('resident',h.data({path:'feed/second.jpg'})),/permission-denied/);
 assert.equal(h.records.get('safety_limits/resident').activity.media.windowCount,1);
});
test('new reservations project an authoritative matching receipt into the existing parent',async()=>{
 const h=fixture(),ticket=await h.call(),parent=h.records.get('discussion_feed/post');
 assert.deepEqual(parent.mediaUploadTickets[ticket.reservationId],h.ticket(ticket.reservationId));
 assert.equal(parent.userId,'resident');assert.equal(parent.storageDraft,false);
});
test('exact pending retry restores a missing parent receipt without another charge',async()=>{
 const h=fixture(),ticket=await h.call();delete h.records.get('discussion_feed/post').mediaUploadTickets;
 await h.call();assert.deepEqual(h.records.get('discussion_feed/post').mediaUploadTickets[ticket.reservationId],h.ticket(ticket.reservationId));
 assert.equal(h.records.get('safety_limits/resident').activity.media.windowCount,1);
});
test('issuing prunes expired parent receipts but preserves active other uploads',async()=>{
 const h=fixture();h.records.get('discussion_feed/post').mediaUploadTickets={expired:{expiresAt:new Date(NOW-1)},active:{expiresAt:new Date(NOW+10000),path:'feed/other.jpg'}};
 const ticket=await h.call(),map=h.records.get('discussion_feed/post').mediaUploadTickets;
 assert.equal(map.expired,undefined);assert.equal(map.active.path,'feed/other.jpg');assert.deepEqual(map[ticket.reservationId],h.ticket(ticket.reservationId));
});
test('finalization atomically retires the matching parent receipt and completes durable quota',async()=>{
 const h=fixture(),ticket=await h.call();await finalized(h.db,object(h.data(),ticket.reservationId),{bucket:BUCKET,now:NOW+2});
 const parent=h.records.get('discussion_feed/post');assert.equal(parent.mediaUploadTickets[ticket.reservationId],undefined);assert.equal(parent.mediaUploadGeneration,h.ticket(ticket.reservationId).parentGeneration);assert.equal(h.ticket(ticket.reservationId).status,'complete');
 const before=structuredClone(h.records.get('discussion_feed/post'));await finalized(h.db,object(h.data(),ticket.reservationId),{bucket:BUCKET,now:NOW+3});assert.deepEqual(h.records.get('discussion_feed/post'),before);
});
test('finalization never resurrects deleted parents or removed receipt maps',async()=>{
 for(const removal of ['parent','map','ticket']){
  const h=fixture(),ticket=await h.call();
  if(removal==='parent')h.records.delete('discussion_feed/post');
  else if(removal==='map')delete h.records.get('discussion_feed/post').mediaUploadTickets;
  else delete h.records.get('discussion_feed/post').mediaUploadTickets[ticket.reservationId];
  const parent=structuredClone(h.records.get('discussion_feed/post'));
  assert.equal(await finalized(h.db,object(h.data(),ticket.reservationId),{bucket:BUCKET,now:NOW+5}),true);
  assert.equal(h.ticket(ticket.reservationId).status,'complete');assert.deepEqual(h.records.get('discussion_feed/post'),parent);
 }
});
test('finalizer preserves mismatched parent receipt and exact retry refuses conflicting projection',async()=>{
 const h=fixture(),ticket=await h.call();h.records.get('discussion_feed/post').mediaUploadTickets[ticket.reservationId].bytes=9999;
 await assert.rejects(h.call(),/failed-precondition/);
 assert.equal(await finalized(h.db,object(h.data(),ticket.reservationId),{bucket:BUCKET}),true);
 assert.equal(h.ticket(ticket.reservationId).status,'complete');assert.equal(h.records.get('discussion_feed/post').mediaUploadTickets[ticket.reservationId].bytes,9999);assert.equal(h.records.get('discussion_feed/post').mediaUploadTickets[ticket.reservationId].status,'issued');
});
test('parent generation is server-generated, persisted across retries and bound to projected tickets',async()=>{
 const h=fixture(),ticket=await h.call(),generation=h.records.get('discussion_feed/post').mediaUploadGeneration;
 assert.match(generation,/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);assert.equal(h.ticket(ticket.reservationId).parentGeneration,generation);
 await h.call();assert.equal(h.records.get('discussion_feed/post').mediaUploadGeneration,generation);assert.equal(h.records.get('safety_limits/resident').activity.media.windowCount,1);
});
test('deleted/recreated parent cannot reuse a free pending ticket even with identical UID/path/dimensions',async()=>{
 const h=fixture(),ticket=await h.call(),oldGeneration=h.ticket(ticket.reservationId).parentGeneration;
 h.records.set('discussion_feed/post',{userId:'resident',storageDraft:false});
 await h.call('resident',h.data(),NOW+10);const current=h.ticket(ticket.reservationId);
 assert.notEqual(current.parentGeneration,oldGeneration);assert.equal(h.records.get('safety_limits/resident').activity.media.windowCount,2);assert.equal(current.issuedAt.getTime(),NOW+10);
 assert.deepEqual(h.records.get('discussion_feed/post').mediaUploadTickets[ticket.reservationId],current);
 assert.equal(await finalized(h.db,object(h.data(),ticket.reservationId),{bucket:BUCKET}),false);
});
test('missing parent generation forces a new charge even when an old projection was copied back',async()=>{
 const h=fixture(),ticket=await h.call(),old=structuredClone(h.records.get('discussion_feed/post'));delete old.mediaUploadGeneration;h.records.set('discussion_feed/post',old);
 const oldGeneration=h.ticket(ticket.reservationId).parentGeneration;await h.call('resident',h.data(),NOW+5);
 assert.notEqual(h.ticket(ticket.reservationId).parentGeneration,oldGeneration);assert.equal(h.records.get('safety_limits/resident').activity.media.windowCount,2);
});
test('finalizer does not project into a recreated parent with a different generation',async()=>{
 const h=fixture(),ticket=await h.call(),old=h.ticket(ticket.reservationId);
 h.records.set('discussion_feed/post',{userId:'resident',storageDraft:false,mediaUploadGeneration:'00000000-0000-0000-0000-000000000000',mediaUploadTickets:{[ticket.reservationId]:structuredClone(old)}});
 const before=structuredClone(h.records.get('discussion_feed/post'));
 assert.equal(await finalized(h.db,object(h.data(),ticket.reservationId),{bucket:BUCKET}),true);assert.equal(h.ticket(ticket.reservationId).status,'complete');assert.deepEqual(h.records.get('discussion_feed/post'),before);
});

test('completed acknowledgement removes only its receipt and duplicate events cannot restore uploader metadata',async()=>{
 const h=fixture(),ticket=await h.call();const next=await h.call('resident',h.data({path:'feed/second.jpg'}));
 const generation=h.records.get('discussion_feed/post').mediaUploadGeneration;
 await finalized(h.db,object(h.data(),ticket.reservationId),{bucket:BUCKET});
 const parent=h.records.get('discussion_feed/post');assert.equal(parent.mediaUploadGeneration,generation);assert.equal(parent.mediaUploadTickets[ticket.reservationId],undefined);assert.ok(parent.mediaUploadTickets[next.reservationId]);
 await finalized(h.db,object(h.data(),ticket.reservationId),{bucket:BUCKET});assert.equal(h.records.get('discussion_feed/post').mediaUploadTickets[ticket.reservationId],undefined);
 await assert.rejects(h.call(),/already-exists/);assert.equal(h.records.get('safety_limits/resident').activity.media.windowCount,2);
});
