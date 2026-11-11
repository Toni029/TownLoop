const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const {NewsletterInputError}=classErrors();
function classErrors(){return {NewsletterInputError:class extends Error{constructor(message,status=400){super(message);this.status=status;}}};}
function fixture(){
 const routes=new Map(),events=[],forwarded=[],logs=[];let authorized=true,quotaError=false;
 const router={use(){},get(path,...handlers){routes.set('GET '+path,handlers);},post(path,...handlers){routes.set('POST '+path,handlers);}};
 const express={json:()=> (_req,_res,next)=>next()};
 const deps={
  express:{...express,default:express,Router:()=>router},
  './newsletterAuth.ts':{requireNativeNewsletterManager(req,res,next){events.push('authorization');if(!req.headers.authorization){res.status(401).json({error:'Sign in'});return;}if(!authorized){res.status(403).json({error:'Denied'});return;}res.locals.newsletterManagerUid='manager';next();}},
  './nativeNewsletter.ts':{NATIVE_PDF_LOADER_VERSION:2,nativeNewsletterCapabilities:()=>({configured:true}),retainedNativePdf:async(id,authorization,newUpload,fetcher)=>{events.push('pdf');await fetcher('https://firestore.googleapis.com/fixed',{headers:{Authorization:authorization}});return 'PDF';}},
  './newsletterPdfText.ts':{NewsletterPdfError:class extends Error{}},'./newsletterPdfSecurity.ts':{NewsletterInputError},
  './newsletterExtractor.ts':{extractNewsletterContent:async()=>{events.push('provider');return {ready:true};}},
  'node:crypto':{randomUUID:()=> 'fixture'},'./newsletterAnalysisErrors.ts':{newsletterAnalysisFailure:()=>({httpStatus:503,error:'Unavailable'})},
  './newsletterJobs.ts':{newsletterJobsEnabled:()=>true,startNewsletterJob:async()=>{if(quotaError)throw Object.assign(Error('private budget details'),{code:'resource-exhausted',retryAfterMs:60000});return {state:'queued'};},chargeNewsletterAnalysis:async(uid,target)=>{events.push('quota');assert.equal(uid,'manager');if(quotaError)throw Object.assign(Error('private budget details'),{code:'resource-exhausted',retryAfterMs:60000});}},
  'firebase-admin/app':{getApps:()=>[{}]},'firebase-admin/app-check':{getAppCheck:()=>({verifyToken:async token=>{events.push('verify');if(token!=='valid')throw Error('sensitive verification details');return {};}})},
 };
 const m={exports:{}},output=ts.transpileModule(fs.readFileSync('server/nativeNewsletterRoutes.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 vm.runInNewContext(output,{module:m,exports:m.exports,require:id=>{assert(id in deps,id);return deps[id];},Headers,fetch:async(url,init)=>{forwarded.push(init.headers);return {};},console:{info:(...args)=>logs.push(args),warn:(...args)=>logs.push(args)}});
 return {events,forwarded,logs,deny(){authorized=false;},limit(){quotaError=true;},async send(token,path='/extract-content',bodyOverride,authenticated=true){
  let status=200,body,headers={};const req={headers:{...(authenticated?{authorization:'Bearer user-id-token'}:{}),...(token===undefined?{}:{'x-firebase-appcheck':token})},body:bodyOverride||{newsletterId:'draft',isNewUpload:true}},res={locals:{},setHeader(k,v){headers[k]=v;},status(n){status=n;return this;},json(data){body=data;}};
  const handlers=routes.get('POST '+path);async function run(i){if(i>=handlers.length)return;let continuation;await handlers[i](req,res,()=>{continuation=run(i+1);});await continuation;}await run(0);return {status,body,headers};
 }};
}
test('App Check monitoring never substitutes for canonical auth and only verified token reaches retained-PDF REST',async()=>{
 const h=fixture(),result=await h.send('valid');assert.equal(result.status,200);assert.deepEqual(h.events,['verify','authorization','quota','pdf','provider']);assert.equal(h.forwarded[0].get('Authorization'),'Bearer user-id-token');assert.equal(h.forwarded[0].get('X-Firebase-AppCheck'),'valid');assert(!JSON.stringify(h.logs).includes('user-id-token'));
 const denied=fixture();denied.deny();assert.equal((await denied.send('valid')).status,403);assert.deepEqual(denied.events,['verify','authorization']);
});
test('missing/invalid App Check continues monitoring without forwarding unverified header or raw errors',async()=>{
 for(const token of [undefined,'invalid']){const h=fixture();assert.equal((await h.send(token)).status,200);assert.equal(h.forwarded[0].get('X-Firebase-AppCheck'),null);assert(!JSON.stringify(h.logs).includes('sensitive'));}
});
test('synchronous and queued analysis limits return safe 429 and retry timing before provider',async()=>{
 for(const path of ['/extract-content','/analysis-jobs']){const h=fixture();h.limit();const result=await h.send('valid',path);assert.equal(result.status,429);assert.equal(result.headers['Retry-After'],'60');assert(!JSON.stringify(result).includes('private'));assert(!h.events.includes('provider'));}
});
test('optional attestation never authorizes a missing account session and oversized headers are not verified',async()=>{
 for(const token of [undefined,'invalid','valid']){const h=fixture();assert.equal((await h.send(token,'/extract-content',undefined,false)).status,401);assert(!h.events.includes('quota'));assert(!h.events.includes('pdf'));}
 const oversized=fixture();assert.equal((await oversized.send('x'.repeat(16385))).status,200);assert(!oversized.events.includes('verify'));assert.equal(oversized.forwarded[0].get('X-Firebase-AppCheck'),null);
});
test('sync validation charge happens before PDF reads; invalid references consume no budget',async()=>{
 const h=fixture();h.limit();assert.equal((await h.send('valid')).status,429);assert(!h.events.includes('pdf'));
 for(const body of [{newsletterId:'../bad',isNewUpload:true},{newsletterId:'current',isNewUpload:true},{newsletterId:'draft',isNewUpload:'yes'}]){const invalid=fixture();assert.equal((await invalid.send(undefined,'/extract-content',body)).status,400);assert(!invalid.events.includes('quota'));assert(!invalid.events.includes('pdf'));}
});
test('native canonical authentication forwards only middleware-verified attestation to lookup and profile',async()=>{
 const {build}=require('esbuild'),out=await build({entryPoints:['server/newsletterAuth.ts'],bundle:true,platform:'node',format:'cjs',write:false});const m={exports:{}};new Function('module','exports','require',out.outputFiles[0].text)(m,m.exports,require);
 const original=global.fetch;try{
  for(const verified of [undefined,'genuine-verified-token']){
   const calls=[];global.fetch=async(url,init)=>{calls.push({url:String(url),headers:new Headers(init.headers)});return Response.json(String(url).includes('accounts:lookup')?{users:[{localId:'manager',providerUserInfo:[{providerId:'password'}]}]}:{fields:{approved:{booleanValue:true},role:{stringValue:'admin'}}});};
   let passed=false;const res={locals:verified?{verifiedAppCheckToken:verified}:{},status(){return this;},json(){}};
   await m.exports.requireNativeNewsletterManager({headers:{authorization:'Bearer user-token','x-firebase-appcheck':'untrusted-raw-token'}},res,()=>{passed=true;});assert(passed);assert.equal(calls.length,2);
   for(const call of calls)assert.equal(call.headers.get('X-Firebase-AppCheck'),verified||null);
   assert.equal(calls[1].headers.get('Authorization'),'Bearer user-token');assert.equal(res.locals.newsletterManagerUid,'manager');
  }
 }finally{global.fetch=original;}
});
