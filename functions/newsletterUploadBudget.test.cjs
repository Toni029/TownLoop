'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {issue,issueAuthenticated,reservationId,TTL_MS,CHUNK_BYTES,PREFIX_LENGTH}=require('./newsletterUploadBudget.cjs');
const NOW=1800000000000;
function fixture(){
 const records=new Map([['users/admin',{role:'admin',approved:true}],['users/vip',{role:'vip',approved:true}],['users/resident',{role:'resident',approved:true}],['users/crew',{role:'crew',approved:true}]]);let pending=Promise.resolve();
 const clone=v=>v===undefined?undefined:structuredClone(v);
 const db={doc:path=>({path}),runTransaction:fn=>{const result=pending.then(async()=>{const next=new Map([...records].map(([k,v])=>[k,clone(v)]));let wrote=false;const tx={get:async ref=>{assert.equal(wrote,false);return{exists:next.has(ref.path),data:()=>clone(next.get(ref.path))};},set:(r,d,o)=>{wrote=true;next.set(r.path,o?.merge?{...next.get(r.path),...clone(d)}:clone(d));},update:(r,d)=>{wrote=true;assert.ok(next.has(r.path));next.set(r.path,{...next.get(r.path),...clone(d)});}};const result=await fn(tx);records.clear();for(const pair of next)records.set(...pair);return result;});pending=result.catch(()=>{});return result;}};
 const input=(bytes=1200000,newsletterId='edition')=>({newsletterId,bytes,totalChunks:Math.ceil(bytes/CHUNK_BYTES),totalSize:PREFIX_LENGTH+Math.ceil(bytes/3)*4});
 return{db,records,input,call:(data=input(),uid='admin',now=NOW)=>issue(db,uid,data,{now})};
}
test('concurrent and repeated identical reservations charge one PDF and preserve media quota maps',async()=>{
 const h=fixture();h.records.set('safety_limits/admin',{uploads:{media:{status:'issued'}},activity:{media:{dayCount:2}}});
 const tickets=await Promise.all(Array.from({length:8},()=>h.call()));assert.ok(tickets.every(t=>t.reservationId===reservationId('admin','edition')&&t.expiresAt===NOW+TTL_MS));
 const q=h.records.get('safety_limits/admin');assert.equal(q.activity.pdf.windowCount,1);assert.equal(q.activity.pdf.bytesDay,h.input().bytes);assert.equal(q.activity.media.dayCount,2);assert.equal(q.uploads.media.status,'issued');
});
test('dimensions, chunk count, prefix-aware size, IDs and 64MiB bounds are validated',async()=>{
 const h=fixture();for(const patch of [{newsletterId:'current'},{newsletterId:'../foreign'},{bytes:0},{bytes:64*1024*1024+1},{bytes:1.5},{totalChunks:9},{totalSize:5}])await assert.rejects(h.call({...h.input(),...patch}),/invalid-argument/);
 assert.equal(h.records.has('safety_limits/admin'),false);await h.call(h.input(64*1024*1024));
});
test('canonical role, approval, deletion and immediate account revocation deny before quota writes',async()=>{
 for(const uid of ['resident','crew','missing']){const h=fixture();await assert.rejects(h.call(h.input(),uid),/permission-denied/);}
 for(const patch of [{approved:false},{deletionPending:true}]){const h=fixture();Object.assign(h.records.get('users/admin'),patch);await assert.rejects(h.call(),/permission-denied/);}
 const h=fixture();await h.call();h.records.set('account_access_revocations/admin',{});await assert.rejects(h.call(),/permission-denied/);assert.equal(h.records.get('safety_limits/admin').activity.pdf.windowCount,1);
 assert.ok((await fixture().call(undefined,'vip')).reservationId);
});
test('disabled, revoked, anonymous and missing Firebase identities cannot reserve',async()=>{
 const h=fixture(),request={auth:{uid:'admin',token:{auth_time:NOW/1000}},data:h.input()},valid={uid:'admin',tokensValidAfterTime:new Date(NOW-1000).toISOString()};
 for(const user of [{...valid,disabled:true},{...valid,tokensValidAfterTime:new Date(NOW+1000).toISOString()},{...valid,uid:'vip'}])await assert.rejects(issueAuthenticated(h.db,async()=>user,request,{now:NOW}),/unauthenticated/);
 await assert.rejects(issueAuthenticated(h.db,async()=>valid,{...request,auth:null},{now:NOW}),/unauthenticated/);
 await assert.rejects(issueAuthenticated(h.db,async()=>valid,{...request,auth:{uid:'admin',token:{auth_time:NOW/1000,firebase:{sign_in_provider:'anonymous'}}}},{now:NOW}),/unauthenticated/);
 assert.ok((await issueAuthenticated(h.db,async()=>valid,request,{now:NOW})).reservationId);
});
test('published, foreign owner, removed or mismatched parent dimensions cannot be overwritten',async()=>{
 for(const parent of [{uploadState:'published'},{uploadedBy:'vip'},{isRemoved:true},{sourceBytes:3},{totalChunks:99},{totalSize:99},{id:'foreign'}]){
  const h=fixture();h.records.set('newsletters/edition',parent);await assert.rejects(h.call(),/permission-denied|failed-precondition/);assert.equal(h.records.has('safety_limits/admin'),false);
 }
});
test('legacy own uploading parent can acquire its first reservation without modifying retained content',async()=>{
 const h=fixture(),input=h.input(),parent={id:'edition',uploadedBy:'admin',uploadState:'uploading',sourceBytes:input.bytes,totalChunks:input.totalChunks,totalSize:input.totalSize};h.records.set('newsletters/edition',structuredClone(parent));
 const ticket=await h.call();assert.deepEqual(h.records.get('newsletters/edition'),parent);
 h.records.set('newsletters/edition',{...parent,uploadBudgetId:ticket.reservationId});await h.call();assert.equal(h.records.get('safety_limits/admin').activity.pdf.dayCount,1);
 await assert.rejects(h.call(h.input(input.bytes+3)),/failed-precondition/);
 h.records.get('newsletters/edition').uploadState='published';await assert.rejects(h.call(),/failed-precondition/);
});
test('completed uploaded edition cannot obtain a fresh reservation or rewind after ticket expiry',async()=>{
 const h=fixture();h.records.set('newsletters/edition',{uploadState:'uploaded',uploadedBy:'admin'});await assert.rejects(h.call(),/failed-precondition/);
 h.records.get('newsletters/edition').uploadState='uploading';await h.call();h.records.get('newsletters/edition').uploadState='uploaded';await h.call();
 await assert.rejects(h.call(h.input(),'admin',NOW+TTL_MS+1),/failed-precondition/);
});
test('4/minute,20/day and1GiB/day budgets apply atomically; expired tickets are pruned',async()=>{
 const h=fixture();for(let i=0;i<4;i++)await h.call(h.input(1000,`edition${i}`));await assert.rejects(h.call(),e=>e.code==='resource-exhausted');
 const q=h.records.get('safety_limits/admin');q.activity.pdf={windowAt:new Date(NOW-120000),dayAt:new Date(NOW-120000),windowCount:0,dayCount:20,bytesDay:0};await assert.rejects(h.call(),e=>e.code==='resource-exhausted');
 q.activity.pdf.dayCount=0;q.activity.pdf.bytesDay=1073741823;await assert.rejects(h.call(),e=>e.code==='resource-exhausted');
 q.activity.pdf.bytesDay=0;q.pdfUploads.old={expiresAt:new Date(NOW-1)};await h.call();assert.equal(h.records.get('safety_limits/admin').pdfUploads.old,undefined);
});
test('expired pending tickets recharge and maintenance blocks issuing',async()=>{
 const h=fixture(),first=await h.call();await h.call(h.input(),'admin',NOW+TTL_MS+1);const ticket=h.records.get('safety_limits/admin').pdfUploads[first.reservationId];assert.equal(ticket.issuedAt.getTime(),NOW+TTL_MS+1);
 h.records.set('database_cleanup_control/active',{referenceWritesBlocked:true});await assert.rejects(h.call(),/failed-precondition/);
});
test('scoped newsletter entry exports only its callable with enforcement disabled',async()=>{
 const vm=require('node:vm'),fs=require('node:fs');let called;const modules={
  'firebase-functions/v2/https':{onCall:(options,handler)=>({options,handler}),HttpsError:class extends Error{}},
  'firebase-admin/firestore':{getFirestore:()=>({fixture:true})},'firebase-admin/auth':{getAuth:()=>({getUser:async uid=>({uid})})},
  'firebase-admin/app':{getApps:()=>[{}],initializeApp:()=>assert.fail('already initialized')},
  './newsletterUploadBudget.cjs':{issueAuthenticated:async(...args)=>{called=args;return{reservationId:'fixture'};}},
 };const exports={};vm.runInNewContext(fs.readFileSync(require.resolve('./newsletter-upload-entry.cjs'),'utf8'),{exports,require:key=>{assert.ok(modules[key],key);return modules[key];}});
 assert.deepEqual(Object.keys(exports),['issueNewsletterUpload']);assert.equal(exports.issueNewsletterUpload.options.enforceAppCheck,false);
 const request={auth:{uid:'admin'}};await exports.issueNewsletterUpload.handler(request);assert.equal(called[2],request);
});
