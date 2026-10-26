const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function fixture(role='resident',approved=true){
 const fields=[],docs=[{id:'new',userId:'alice',createdAt:300,status:'Queued',storageDraft:false},{id:'first',userId:'bob',createdAt:100,status:'Queued',storageDraft:false},{id:'middle',userId:'alice',createdAt:200,status:'Queued',storageDraft:false},{id:'done',userId:'alice',createdAt:50,status:'Done',storageDraft:false},{id:'draft',userId:'alice',createdAt:1,status:'Queued',storageDraft:true}];
 let scans=0;const query={where:(...args)=>{assert.deepEqual(args,['status','!=','Done']);return query;},select:(...args)=>{fields.push(...args);return query;},limit:n=>{assert.equal(n,2001);return query;},get:async()=>{scans++;return {size:docs.length,docs:docs.map(d=>({id:d.id,data:()=>d}))};}};
 const db={doc:path=>{assert.equal(path,'users/alice');return {get:async()=>({data:()=>({role,approved})})};},collection:path=>{assert.equal(path,'work_orders');return query;}};
 class HttpsError extends Error{constructor(code,message){super(message);this.code=code;}}
 const exports={};vm.runInNewContext(fs.readFileSync(__dirname+'/workOrderQueue.cjs','utf8'),{exports,require:name=>name==='firebase-functions/v2/https'?{onCall:(_options,fn)=>fn,HttpsError}:name==='firebase-admin/auth'?{getAuth:()=>({verifyIdToken:async()=>({uid:'alice'})})}:{getFirestore:database=>{assert.equal(database,'(default)');return db;}}});
 return {api:exports,docs,fields,scans:()=>scans,request:{auth:{uid:'alice'},rawRequest:{headers:{authorization:'Bearer fixture-token'}}}};
}
test('all approved roles receive only their own exact global positions from metadata projection',async()=>{
 for(const role of ['resident','crew','vip','admin']){const f=fixture(role);const result=await f.api.getWorkOrderQueuePositions(f.request);assert.equal(JSON.stringify(result.positions),JSON.stringify({middle:2,new:3}));assert.deepEqual(f.fields,['createdAt','userId','status','storageDraft']);}
});
test('unauthenticated or unapproved users cannot scan the queue',async()=>{
 let f=fixture();await assert.rejects(f.api.getWorkOrderQueuePositions({}),e=>e.code==='unauthenticated');assert.equal(f.scans(),0);
 f=fixture('resident',false);await assert.rejects(f.api.getWorkOrderQueuePositions(f.request),e=>e.code==='permission-denied');assert.equal(f.scans(),0);
 f=fixture('unknown');await assert.rejects(f.api.getWorkOrderQueuePositions(f.request),e=>e.code==='permission-denied');assert.equal(f.scans(),0);
});
test('oldest, reopened and tied submissions have deterministic ordering without draft/done positions',()=>{
 const f=fixture();f.docs.push({id:'A',userId:'alice',createdAt:100,status:'In Progress',storageDraft:false});const positions=f.api.positionsFor(f.docs,'alice');assert.equal(positions.A,1);assert.equal(positions.middle,3);assert.equal(positions.new,4);assert.equal(positions.done,undefined);assert.equal(positions.draft,undefined);
});
