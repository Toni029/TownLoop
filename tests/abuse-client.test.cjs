const { test } = require('node:test');
const assert = require('node:assert/strict');
const { build } = require('esbuild');
let compiled;
async function client() {
 compiled ||= build({entryPoints:['src/security/abuseBudget.ts'],bundle:true,platform:'node',format:'cjs',write:false,plugins:[{name:'firestore-fixture',setup(b){b.onResolve({filter:/^firebase\/firestore$/},()=>({path:'firestore',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:`export const doc=(_db,...parts)=>({path:parts.join('/')});export const getDocFromServer=ref=>globalThis.__abuseClientFixture.control(ref);export const runTransaction=(db,fn)=>db.runTransaction(fn);export const serverTimestamp=()=>new Date();export const Timestamp={};`,loader:'js'}));}}]});
 const output=await compiled,m={exports:{}};new Function('require','module','exports',output.outputFiles[0].text)(require,m,m.exports);return m.exports;
}
function fixture(controls=null) {
 const records=new Map(),reads=[],writes=[],controlReads=[];let controlError;
 const snapshot=data=>({exists:()=>data!==undefined,data:()=>data});
 const merge=(old,value)=>{const next={...old};for(const[k,v]of Object.entries(value))next[k]=v&&typeof v==='object'&&!Array.isArray(v)&&!(v instanceof Date)?merge(next[k]||{},v):v;return next;};
 let transactions=0;
 const db={async runTransaction(action){transactions++;let wrote=false;const pending=[];const tx={
  async get(ref){assert.equal(wrote,false,'underlying Firestore read after write');reads.push(ref.path);return snapshot(records.get(ref.path));},
  set(ref,data,options){wrote=true;writes.push({method:'set',path:ref.path,data,options});pending.push(()=>records.set(ref.path,options?.merge?merge(records.get(ref.path)||{},data):data));return this;},
  update(ref,data){wrote=true;writes.push({method:'update',path:ref.path,data});pending.push(()=>records.set(ref.path,merge(records.get(ref.path)||{},data)));return this;},
  delete(ref){wrote=true;writes.push({method:'delete',path:ref.path});pending.push(()=>records.delete(ref.path));return this;},
 };const value=await action(tx);for(const apply of pending)apply();return value;}};
 const boundary={async control(ref){controlReads.push(ref.path);if(controlError)throw controlError;return snapshot(controls);}};
 return {db,records,reads,writes,controlReads,transactions:()=>transactions,error:code=>{controlError={code};},async run(uid,action){global.__abuseClientFixture=boundary;try{return await(await client()).runBudgetedTransaction(db,uid,action);}finally{delete global.__abuseClientFixture;}}};
}
const ref=path=>({path});
test('absent, unknown or inactive controls preserve old-backend transactions without quota writes',async()=>{
 for(const controls of [null,{protocolVersion:2,prepareClients:true},{protocolVersion:1,prepareClients:false,enforceWrites:false}]){
  const h=fixture(controls);const value=await h.run('u',async tx=>{await tx.get(ref('discussion_feed/post'));tx.set(ref('discussion_feed/post'),{storageDraft:false});return 'saved';});
  assert.equal(value,'saved');assert.deepEqual(h.controlReads,['security_controls/abuse_limits']);assert(!h.reads.includes('safety_limits/u'));assert.equal(h.writes.length,1);assert.equal(h.records.get('discussion_feed/post').storageDraft,false);
 }
 const denied=fixture();denied.error('permission-denied');await denied.run('u',async()=>{});assert.equal(denied.transactions(),1);
});
test('unavailable rollout check fails before attempting data transaction',async()=>{
 const h=fixture();h.error('unavailable');await assert.rejects(h.run('u',async()=>assert.fail('must not run')),/Check your connection/);assert.equal(h.transactions(),0);assert.equal(h.writes.length,0);
});
test('prepare and enforce modes atomically pair data with counter, deferring writes until all reads finish',async()=>{
 for(const mode of [{prepareClients:true},{enforceWrites:true}]){
  const h=fixture({protocolVersion:1,...mode});h.records.set('discussion_feed/post',{storageDraft:true,comments:[]});
  await h.run('u',async tx=>{await tx.get(ref('discussion_feed/post'));const returned=tx.update(ref('discussion_feed/post'),{storageDraft:false,title:'Published'});assert.equal(returned,tx);assert.equal(h.writes.length,0);await tx.get(ref('users/u'));assert.equal(h.writes.length,0);});
  assert.deepEqual(h.reads,['safety_limits/u','discussion_feed/post','users/u']);assert.deepEqual(h.writes.map(w=>w.path),['discussion_feed/post','safety_limits/u']);
  const budget=h.records.get('safety_limits/u');assert.equal(budget.activityScope,'posts');assert.equal(budget.activity.posts.windowCount,1);assert.equal(budget.activity.posts.dayCount,1);assert.equal(budget.activity.posts.target,'discussion_feed/post');assert.equal(h.records.get('discussion_feed/post').title,'Published');
 }
});
test('idempotent no-op retries and action failures spend no budget or data writes',async()=>{
 const h=fixture({protocolVersion:1,prepareClients:true});h.records.set('discussion_feed/post',{storageDraft:false});
 for(let i=0;i<3;i++)await h.run('u',async tx=>{const old=await tx.get(ref('discussion_feed/post'));if(old.exists()&&old.data().storageDraft===false)return 'already published';assert.fail('unexpected retry write');});
 assert.equal(h.writes.length,0);assert.equal(h.records.has('safety_limits/u'),false);
 await assert.rejects(h.run('u',async tx=>{tx.set(ref('discussion_feed/new'),{storageDraft:false});throw Error('authorization denied');}),/authorization denied/);assert.equal(h.writes.length,0);
});
test('client quota merge preserves server uploads, AI activity, reports and unrelated fields',async()=>{
 const h=fixture({protocolVersion:1,enforceWrites:true}),now=new Date(),old={uploads:{dayCount:7,bytesDay:1234},report:{until:123,count:8},serverOnly:{proof:'retained'},activity:{analysis:{dayCount:6,windowCount:2,windowAt:now,dayAt:now},translation:{dayCount:4},posts:{windowAt:now,dayAt:now,windowCount:2,dayCount:3}}};
 h.records.set('safety_limits/u',old);await h.run('u',async tx=>{await tx.get(ref('discussion_feed/new'));tx.set(ref('discussion_feed/new'),{storageDraft:false});});
 const next=h.records.get('safety_limits/u');for(const key of ['uploads','report','serverOnly'])assert.deepEqual(next[key],old[key]);for(const scope of ['analysis','translation'])assert.deepEqual(next.activity[scope],old.activity[scope]);assert.equal(next.activity.posts.windowCount,3);assert.equal(next.activity.posts.dayCount,4);
});
test('quota rejection applies zero writes; multiple chargeable records cannot share one counter pointer',async()=>{
 const h=fixture({protocolVersion:1,enforceWrites:true}),now=new Date();h.records.set('safety_limits/u',{activity:{posts:{windowAt:now,dayAt:now,windowCount:10,dayCount:10}}});
 await assert.rejects(h.run('u',async tx=>{await tx.get(ref('discussion_feed/new'));tx.set(ref('discussion_feed/new'),{storageDraft:false});}),e=>e.code==='resource-exhausted'&&e.retryAfterMs>0);assert.equal(h.writes.length,0);assert(!h.records.has('discussion_feed/new'));
 const two=fixture({protocolVersion:1,prepareClients:true});await assert.rejects(two.run('u',async tx=>{await tx.get(ref('discussion_feed/a'));await tx.get(ref('discussion_feed/b'));tx.set(ref('discussion_feed/a'),{storageDraft:false});tx.set(ref('discussion_feed/b'),{storageDraft:false});}),/separately/);assert.equal(two.writes.length,0);
});

test('publishing preserves server media reservations in both compatibility and quota modes',async()=>{
 for(const control of [null,{protocolVersion:1,prepareClients:true}]){
  const h=fixture(control),proof={ticket:{uid:'u',bytes:123,status:'issued'}},path='discussion_feed/post';
  h.records.set(path,{storageDraft:true,mediaUploadGeneration:'server-generation',mediaUploadTickets:proof});
  await h.run('u',async tx=>{await tx.get(ref(path));tx.set(ref(path),{storageDraft:false,title:'Publish without erasing receipt'});});
  assert.equal(h.records.get(path).mediaUploadGeneration,'server-generation');assert.deepEqual(h.records.get(path).mediaUploadTickets,proof);
 }
});
