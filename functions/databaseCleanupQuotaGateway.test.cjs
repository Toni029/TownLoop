'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createCleanupQuotaGateway,createPrivateInventoryInvoker,protectedReadOnlySource,inventoryServiceUrl,GATEWAY_SERVICE_ACCOUNT}=require('./databaseCleanupQuotaGateway.cjs');
const {charge}=require('./abuseLimits.cjs');
const request=(data={action:'preview',categories:['workOrders']})=>({auth:{uid:'admin'},rawRequest:{headers:{authorization:'Bearer verified-user-token'}},data});
function quotaDb(){const records=new Map(),writes=[];return{records,writes,doc:path=>({path}),async runTransaction(fn){let write;const value=await fn({get:async ref=>({data:()=>records.get(ref.path)}),set:(ref,data)=>{write={ref,data};}});if(write){records.set(write.ref.path,write.data);writes.push(write);}return value;}};}
function fixture(db=quotaDb(),overrides={}){const events=[],profile={role:'admin',approved:true},state={revoked:false,disabled:false,fail:false};const deps={verifyIdentity:async token=>{events.push('identity');assert.equal(token,'verified-user-token');return {uid:'admin',disabled:state.disabled};},read:async path=>{events.push('read:'+path);return path.startsWith('users/')?{exists:true,data:profile}:{exists:state.revoked};},charge:async(...args)=>{events.push('charge');await charge(db,...args);},invoke:async value=>{events.push('invoke');assert.equal(value.idToken,'verified-user-token');if(state.fail)throw Error('private secret upstream failure');return {readOnly:true,enabled:false,state:'review',counts:{}};},...overrides};return{db,events,profile,state,gateway:createCleanupQuotaGateway(deps),fresh:()=>createCleanupQuotaGateway(deps)};}
test('identity, canonical approval/Admin, revocation and disabled checks precede all quota writes',async()=>{
 for(const change of [f=>{f.profile.role='vip';},f=>{f.profile.role='resident';},f=>{f.profile.approved=false;},f=>{f.profile.deletionPending=true;},f=>{f.state.revoked=true;},f=>{f.state.disabled=true;}]){const f=fixture();change(f);await assert.rejects(f.gateway(request()),e=>e.code==='permission-denied');assert(!f.events.includes('charge'));assert.equal(f.db.writes.length,0);}
 const missing=fixture();await assert.rejects(missing.gateway({...request(),auth:null}),e=>e.code==='unauthenticated');assert.equal(missing.events.length,0);
 const mismatch=fixture(undefined,{verifyIdentity:async()=>({uid:'other'})});await assert.rejects(mismatch.gateway(request()),e=>e.code==='unauthenticated');assert(!mismatch.events.includes('charge'));
});
test('only bounded read-only preview categories are delegated; other actions/URL inputs never charge',async()=>{
 for(const data of [{action:'delete',categories:['workOrders']},{action:'preview',categories:[]},{action:'preview',categories:['unknown']},{action:'preview',categories:['workOrders','workOrders']},{action:'preview',categories:['workOrders'],url:'https://untrusted.invalid'},{action:'preview',categories:['workOrders'],cursor:1001}]){const f=fixture();await assert.rejects(f.gateway(request(data)),e=>['failed-precondition','invalid-argument'].includes(e.code));assert(!f.events.includes('charge'));assert(!f.events.includes('invoke'));}
 const f=fixture();assert.equal((await f.gateway(request({action:'preview',categories:['workOrders'],requestId:'readonly-refresh',cursor:100}))).readOnly,true);assert.equal(f.db.writes.length,1);assert.equal(f.db.writes[0].ref.path,'safety_limits/admin');assert.deepEqual(f.events.slice(-2),['charge','invoke']);
});
test('durable Admin preview limit persists across new handler instances and only quota state is written',async()=>{
 const f=fixture();for(let n=0;n<12;n++)await f.fresh()(request());await assert.rejects(f.fresh()(request()),e=>e.code==='resource-exhausted'&&e.details.retryAfterSeconds>0);assert.equal(f.db.writes.length,12);assert(f.db.writes.every(w=>w.ref.path==='safety_limits/admin'));assert.equal(f.db.records.get('safety_limits/admin').activity.adminRead.dayCount,12);assert.equal(f.events.filter(e=>e==='invoke').length,12);
});
test('private failure and unexpected responses expose no upstream detail and create no cleanup jobs',async()=>{
 const f=fixture();f.state.fail=true;await assert.rejects(f.gateway(request()),e=>e.code==='unavailable'&&!e.message.includes('secret'));assert.equal(f.db.writes.length,1);
 const invalid=fixture(undefined,{invoke:async()=>({enabled:true,id:'job-created'})});await assert.rejects(invalid.gateway(request()),e=>e.code==='unavailable');assert(invalid.db.writes.every(w=>w.ref.path==='safety_limits/admin'));
});
test('private invocation pins audience/URL and separates Google IAM token from verified resident token',async()=>{
 const serviceUrl='https://readonlydatabasecleanupinventory-883715389126.us-central1.run.app';let requestedAudience,network;const invoke=createPrivateInventoryInvoker({serviceUrl:()=>serviceUrl,googleAuth:{getIdTokenClient:async audience=>{requestedAudience=audience;return {getRequestHeaders:async()=>new Headers({authorization:'Bearer google-oidc-token'})};}},fetcher:async(url,options)=>{network={url,options};return Response.json({result:{readOnly:true,enabled:false}});}});
 await invoke({idToken:'verified-user-token',input:{action:'preview',categories:['workOrders']}});assert.equal(requestedAudience,serviceUrl);assert.equal(network.url,serviceUrl);assert.equal(network.options.headers.Authorization,'Bearer verified-user-token');assert.equal(network.options.headers['X-Serverless-Authorization'],'Bearer google-oidc-token');assert.equal(network.options.redirect,'error');assert.deepEqual(JSON.parse(network.options.body),{data:{action:'preview',categories:['workOrders']}});
});
test('private adapter transformation preserves original inventory implementation and read-only identity',()=>{
 const original=fs.readFileSync(__dirname+'/databaseCleanupReadOnlyEntry.cjs','utf8'),source=protectedReadOnlySource(original),calls=[];const module={exports:{}};
 const deps={'firebase-admin/app':{initializeApp:()=>({})},'firebase-admin/firestore':{getFirestore:()=>({})},'firebase-admin/auth':{getAuth:()=>({})},'firebase-admin/storage':{getStorage:()=>({bucket:()=>({})})},'firebase-functions/v2/https':{onCall:(options,handler)=>{calls.push(options);return handler;},HttpsError:class extends Error{}},'./databaseCleanupReadOnly.cjs':{createReadOnlyInventory:()=>()=>{},BUCKET:'fixture'}};
 vm.runInNewContext(source,{module,exports:module.exports,require:id=>deps[id]});assert.deepEqual(Object.keys(module.exports),['readOnlyDatabaseCleanupInventory']);assert.equal(calls[0].serviceAccount,'townloop-cleanup-preview@cc-livingcommunity-app.iam.gserviceaccount.com');assert.equal(calls[0].invoker[0],GATEWAY_SERVICE_ACCOUNT);assert.equal(calls[0].invoker.length,1);assert(!source.includes("invoker:'public'"));assert.throws(()=>protectedReadOnlySource('unexpected source'),/changed/);
});
test('missing or misdirected private service configuration fails before quota or private network',async()=>{
 for(const value of [undefined,'https://us-central1-cc-livingcommunity-app.cloudfunctions.net/readOnlyDatabaseCleanupInventory','https://readonlydatabasecleanupinventory-111111111111.us-central1.run.app','https://untrusted.invalid','https://readonlydatabasecleanupinventory-883715389126.us-central1.run.app/path']){
  let network=false;const invoke=createPrivateInventoryInvoker({googleAuth:{},serviceUrl:()=>value,fetcher:async()=>{network=true;}}),f=fixture(undefined,{invoke});
  await assert.rejects(f.gateway(request()),e=>e.code==='unavailable');assert.equal(f.db.writes.length,0);assert.equal(network,false);
 }
 assert.equal(inventoryServiceUrl('https://readonlydatabasecleanupinventory-abc123-uc.a.run.app'),'https://readonlydatabasecleanupinventory-abc123-uc.a.run.app');
});
test('scoped public entry pins quota gateway identity while original inventory files remain unmodified',()=>{
 const calls=[],apps=[],module={exports:{}},deps={
  'firebase-admin/app':{getApps:()=>apps,initializeApp:(options,name)=>{const app={name,options};apps.push(app);return app;}},
  'firebase-admin/firestore':{getFirestore:()=>({})},'firebase-admin/auth':{getAuth:()=>({})},
  'firebase-functions/v2/https':{onCall:(options,handler)=>{calls.push(options);return handler;},HttpsError:class extends Error{}},'google-auth-library':{GoogleAuth:class{}},'./abuseLimits.cjs':{charge:()=>{}},
  './databaseCleanupQuotaGateway.cjs':{...require('./databaseCleanupQuotaGateway.cjs'),createCleanupQuotaGateway:()=>()=>({})},
 };
 vm.runInNewContext(fs.readFileSync(__dirname+'/databaseCleanupQuotaGatewayEntry.cjs','utf8'),{module,exports:module.exports,require:id=>deps[id]});assert.deepEqual(Object.keys(module.exports),['previewDatabaseCleanup']);assert.equal(calls[0].serviceAccount,GATEWAY_SERVICE_ACCOUNT);assert.equal(calls[0].enforceAppCheck,false);assert.equal(apps[0].name,'townloop-request-controls');assert.equal(apps[0].options.projectId,'cc-livingcommunity-app');
});
