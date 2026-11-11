const { test } = require('node:test');
const assert = require('node:assert/strict');
const { build } = require('esbuild');
const fs = require('node:fs'), vm = require('node:vm');
function memoryDb() {
 const records = new Map(); let writes = 0, queue = Promise.resolve();
 const snapshot = value => {
  const convert = v => v instanceof Date ? { toMillis: () => v.getTime() } : Array.isArray(v) ? v.map(convert) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k,x]) => [k,convert(x)])) : v;
  return { exists: !!value, data: () => convert(value) };
 };
 const db = { records, count: () => writes, doc: path => ({ path }), collection: name => ({ doc: id => ({ path: name + '/' + id }) }), runTransaction(fn) {
  const job = queue.then(async () => {
   let wrote = false; const pending = [];
   const value = await fn({ get: async ref => { assert.equal(wrote, false, 'transaction read after write'); return snapshot(records.get(ref.path)); }, set(ref,data,opts) { wrote = true; pending.push(() => records.set(ref.path, opts?.merge ? {...records.get(ref.path), ...data} : data)); }, update(ref,data) { wrote = true; pending.push(() => records.set(ref.path, {...records.get(ref.path),...data})); } });
   for (const apply of pending) { apply(); writes++; } return value;
  }); queue = job.catch(() => {}); return job;
 } }; return db;
}
async function jobs() {
 const b = await build({ entryPoints: ['server/newsletterJobs.ts'], bundle: true, platform: 'node', format: 'cjs', write: false, packages: 'external', plugins: [{name:'no-extractor',setup(b){b.onLoad({filter:/newsletterExtractor\.ts$/},()=>({contents:'export const extractNewsletterContent=()=>{throw Error("unexpected provider")};',loader:'js'}));}}] });
 const m = {exports:{}}; new Function('require','module','exports',b.outputFiles[0].text)(require,m,m.exports); return m.exports;
}
test('analysis jobs charge persistent UID quota once, preserving idempotency, successful result and checkpoint retry', async () => {
 const api = await jobs(), db = memoryDb(), request = {newsletterId:'draft',isNewUpload:true}, send = async()=>{}, revision = async()=> 'revision';
 const first = await api.startNewsletterJob('manager',request,db,send,revision);
 assert.equal(db.records.get('safety_limits/manager').activity.analysis.dayCount,1);
 const again = await (await jobs()).startNewsletterJob('manager',request,db,send,revision);
 assert.equal(again.jobId,first.jobId); assert.equal(db.records.get('safety_limits/manager').activity.analysis.dayCount,1);
 const ref = 'newsletter_analysis_jobs/'+first.jobId;
 db.records.set(ref,{...db.records.get(ref),state:'failed',checkpoints:{0:{value:'saved'}}});
 const resumed = await api.startNewsletterJob('manager',request,db,send,revision);
 assert.equal(resumed.state,'queued'); assert.equal(db.records.get(ref).checkpoints[0].value,'saved'); assert.equal(db.records.get('safety_limits/manager').activity.analysis.dayCount,2);
 db.records.set(ref,{...db.records.get(ref),state:'succeeded',result:{ready:true}});
 assert.equal((await api.startNewsletterJob('manager',request,db,send,revision)).result.ready,true);
 assert.equal(db.records.get('safety_limits/manager').activity.analysis.dayCount,2);
});
test('analysis generation limits survive module reload and rejection writes no job', async () => {
 const db = memoryDb(), api = await jobs();
 for(let n=0;n<12;n++) await api.startNewsletterJob('manager',{newsletterId:'draft'+n,isNewUpload:true},db,async()=>{},async()=> 'revision');
 const before=db.count();
 await assert.rejects((await jobs()).startNewsletterJob('manager',{newsletterId:'too-many',isNewUpload:true},db,async()=>{},async()=> 'revision'),e=>e.status===429&&e.retryAfterMs>0);
 assert.equal(db.count(),before); assert.equal(db.records.get('safety_limits/manager').activity.analysis.dayCount,12);
 await api.startNewsletterJob('other',{newsletterId:'other',isNewUpload:true},db,async()=>{},async()=> 'revision');
});
function translation(db, profile={approved:true,role:'admin'}) {
 let handler, calls=0;
 const deps = {'firebase-functions/v2/https':{onRequest:(_,fn)=>{handler=fn;return fn;}},'firebase-functions/params':{defineSecret:()=>({value:()=> 'fixture'})},'firebase-admin/auth':{getAuth:()=>({verifyIdToken:async()=>({uid:'translator'})})},'firebase-admin/firestore':{getFirestore:()=>({...db,collection:()=>({doc:()=>({get:async()=>({data:()=>profile})})})})},'./abuseLimits.cjs':require('../functions/abuseLimits.cjs')};
 const m={exports:{}};vm.runInNewContext(fs.readFileSync('functions/translation.cjs','utf8'),{module:m,exports:m.exports,require:id=>deps[id],Date,AbortSignal,fetch:async()=>{calls++;return {ok:true,json:async()=>({data:{translations:[{translatedText:'Hola'}]}})};}});
 return {calls:()=>calls,async send(body={title:'Hello'}){const headers={};let status=200,result;const res={set:(k,v)=>{headers[k]=v;},status(n){status=n;return this;},json(value){result=value;return this;}};await handler({method:'POST',headers:{authorization:'Bearer fixture'},body},res);return {status,result,headers};}};
}
test('translation quotas persist across instances; unauthorized/invalid/empty requests do not spend provider budget',async()=>{
 const db=memoryDb();for(let n=0;n<30;n++){const h=translation(db);assert.equal((await h.send()).status,200);assert.equal(h.calls(),1);}
 const fresh=translation(db),limited=await fresh.send();assert.equal(limited.status,429);assert(+limited.headers['Retry-After']>0);assert.equal(fresh.calls(),0);
 const before=db.count();assert.equal((await translation(db,{approved:false,role:'admin'}).send()).status,403);assert.equal((await translation(db).send({title:4})).status,400);assert.equal((await translation(db).send({title:''})).status,200);assert.equal(db.count(),before);
});
test('concurrent new requests for the same job spend once',async()=>{
 const db=memoryDb(),api=await jobs(),request={newsletterId:'same',isNewUpload:true};
 const results=await Promise.all(Array.from({length:5},()=>api.startNewsletterJob('manager',request,db,async()=>{},async()=> 'revision')));
 assert.equal(new Set(results.map(x=>x.jobId)).size,1);assert.equal(db.records.get('safety_limits/manager').activity.analysis.dayCount,1);
});
