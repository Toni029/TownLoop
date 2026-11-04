const {test,after}=require('node:test'),assert=require('node:assert/strict'),{build}=require('esbuild');
if(!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST||''))throw Error('Disposable local emulator required.');
const requireFunctions=require('node:module').createRequire(require.resolve('../../functions/package.json')),{initializeApp,deleteApp}=requireFunctions('firebase-admin/app'),{getFirestore}=requireFunctions('firebase-admin/firestore');
const app=initializeApp({projectId:'demo-townloop-news-job-tests'}),db=getFirestore(app,'(default)');after(()=>deleteApp(app));
async function load(){const b=await build({entryPoints:['server/newsletterJobs.ts'],bundle:true,platform:'node',format:'cjs',write:false,packages:'external'}),m={exports:{}};new Function('require','module','exports',b.outputFiles[0].text)(require,m,m.exports);return m.exports;}
test.before(async()=>{const r=await fetch('http://'+process.env.FIRESTORE_EMULATOR_HOST+'/emulator/v1/projects/demo-townloop-news-job-tests/databases/(default)/documents',{method:'DELETE'});assert.equal(r.ok,true);});
const value={monthEdition:'November 2026',events:[],highlights:[]};
test('durable jobs resume only missing batches, enforce ownership and keep publishing separate',async()=>{
 const api=await load();await db.doc('newsletters/draft/chunks/0').set({index:0,sha256:'fixture',totalChunks:1,totalSize:43});await db.doc('users/manager').set({role:'admin',approved:true});
 let sent=[];const request={newsletterId:'draft',isNewUpload:true};const created=await api.startNewsletterJob('manager',request,db,async(id,generation)=>sent.push({id,generation}));const again=await api.startNewsletterJob('manager',request,db,async(id,generation)=>sent.push({id,generation}));assert.equal(created.jobId,again.jobId);assert.deepEqual(sent[0],sent[1]);
 const ref=db.doc('newsletter_analysis_jobs/'+created.jobId),task={jobId:created.jobId,generation:1};
 await assert.rejects(api.getNewsletterJob('other-manager',created.jobId,db),/not available/);
 const processed=[];let fail=true;
 const deps={db,enabled:true,account:async()=>({disabled:false}),loadPdf:async()=>'%PDF fixture',extract:async(payload,cp)=>{assert.equal(payload.newsletterId,'draft');const saved=await cp.load('verified-hash',3);for(let i=0;i<3;i++){if(saved[i])continue;processed.push(i);await cp.save('verified-hash',i,3,value,'fixture-model');if(fail){fail=false;throw Object.assign(Error('503 UNAVAILABLE'),{status:503});}}return {...value,rsvp_events:[],pinned_highlights:[]};}};
 await assert.rejects(api.runNewsletterJob(task,deps),/Retryable/);const partial=(await ref.get()).data();assert.equal(partial.state,'retrying');assert.deepEqual(Object.keys(partial.checkpoints),['0']);
 await api.runNewsletterJob(task,deps);assert.equal((await ref.get()).data().state,'succeeded');assert.deepEqual(processed,[0,1,2]);const published=await api.getNewsletterJob('manager',created.jobId,db);assert.ok(published.result);assert.equal(published.completedBatches,3);assert.equal((await db.doc('newsletters/current').get()).exists,false);
 await api.runNewsletterJob(task,deps);assert.deepEqual(processed,[0,1,2]);assert.equal((await ref.get()).data().attempts,2);
 await db.doc('newsletters/draft/chunks/0').update({sha256:'changed'});const replacement=await api.startNewsletterJob('manager',request,db,async()=>{});assert.notEqual(replacement.jobId,created.jobId);
 const leaked=JSON.stringify(published);assert.ok(!leaked.includes('ownerUid'));assert.ok(!leaked.includes('checkpoints'));
});
test('disabled work, revocation, discarded drafts, changed inputs and retry limits fail closed',async()=>{
 const api=await load();await db.doc('users/manager2').set({role:'vip',approved:true});
 async function create(id){await db.doc('newsletters/'+id+'/chunks/0').set({index:0,sha256:'fixture',totalChunks:1,totalSize:43});const j=await api.startNewsletterJob('manager2',{newsletterId:id,isNewUpload:true},db,async()=>{});return {job:j,ref:db.doc('newsletter_analysis_jobs/'+j.jobId),task:{jobId:j.jobId,generation:1}};}
 const d=await create('disabled');await api.runNewsletterJob(d.task,{db});assert.equal((await d.ref.get()).data().state,'queued');
 const deps={db,enabled:true,account:async()=>({disabled:false}),loadPdf:async()=> 'PDF',extract:async()=>{throw Error('must not run');}};
 const discarded=await create('discarded');await db.doc('newsletter_draft_cleanup/discarded').set({state:'purged'});await api.runNewsletterJob(discarded.task,deps);assert.equal((await discarded.ref.get()).data().state,'failed');
 const revoked=await create('revoked');await db.doc('account_access_revocations/manager2').set({blocked:true});await api.runNewsletterJob(revoked.task,deps);assert.equal((await revoked.ref.get()).data().state,'failed');await db.doc('account_access_revocations/manager2').delete();
 const changed=await create('changed');await changed.ref.update({inputHash:'old',checkpoints:{0:{value,model:'x'}}});await api.runNewsletterJob(changed.task,{...deps,extract:async(p,cp)=>cp.load('different',3)});assert.equal((await changed.ref.get()).data().state,'failed');assert.equal((await changed.ref.get()).data().checkpoints[0].model,'x');
 const exhausted=await create('exhausted');const busy={...deps,extract:async()=>{throw Object.assign(Error('503'),{status:503});}};for(let i=0;i<4;i++)await assert.rejects(api.runNewsletterJob(exhausted.task,busy),/Retryable/);await api.runNewsletterJob(exhausted.task,busy);assert.equal((await exhausted.ref.get()).data().state,'failed');assert.equal((await exhausted.ref.get()).data().attempts,5);
 const retry=await api.startNewsletterJob('manager2',{newsletterId:'exhausted',isNewUpload:true},db,async()=>{});assert.equal(retry.state,'queued');assert.equal((await exhausted.ref.get()).data().generation,2);await api.runNewsletterJob(exhausted.task,busy);assert.equal((await exhausted.ref.get()).data().attempts,0);
});
test('concurrent task delivery cannot duplicate work or overwrite a recovered lease',async()=>{
 const api=await load();await db.doc('users/lease-manager').set({approved:true,role:'admin'});await db.doc('newsletters/lease/chunks/0').set({index:0,totalChunks:1,totalSize:43});const job=await api.startNewsletterJob('lease-manager',{newsletterId:'lease',isNewUpload:true},db,async()=>{}),ref=db.doc('newsletter_analysis_jobs/'+job.jobId),task={jobId:job.jobId,generation:1};
 let entered,release;const ready=new Promise(r=>entered=r),pause=new Promise(r=>release=r);let loads=0;
 const deps={db,enabled:true,account:async()=>({disabled:false}),loadPdf:async()=>{loads++;return 'fixture';},extract:async(p,cp)=>{await cp.load('lease-hash',1);entered();await pause;await cp.save('lease-hash',0,1,value,'fixture');return {...value,marker:'stale'};}};
 const old=api.runNewsletterJob(task,deps);await ready;
 await assert.rejects(api.runNewsletterJob(task,deps),/already running/);assert.equal(loads,1);
 await ref.update({leaseUntil:new Date(Date.now()-1)});
 await api.runNewsletterJob(task,{...deps,extract:async()=>({...value,marker:'recovered'})});release();await old;
 const done=(await ref.get()).data();assert.equal(done.state,'succeeded');assert.equal(done.result.marker,'recovered');assert.equal(done.attempts,2);
});
test('direct Firestore access to private job progress is denied even to an approved manager',async()=>{
 const fs=require('fs'),project='demo-townloop-news-job-tests',host=process.env.FIRESTORE_EMULATOR_HOST;
 const r=await fetch(`http://${host}/emulator/v1/projects/${project}:securityRules`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({rules:{files:[{name:'firestore.rules',content:fs.readFileSync('firestore.rules','utf8')}]}})});assert.equal(r.ok,true);
 const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url'),now=Math.floor(Date.now()/1000),token=enc({alg:'none',typ:'JWT'})+'.'+enc({iss:`https://securetoken.google.com/${project}`,aud:project,sub:'manager',user_id:'manager',iat:now,exp:now+3600,firebase:{sign_in_provider:'password'}})+'.';
 const url=`http://${host}/v1/projects/${project}/databases/(default)/documents/newsletter_analysis_jobs/arbitrary`;
 assert.equal((await fetch(url,{headers:{Authorization:'Bearer '+token}})).status,403);
 assert.equal((await fetch(url,{method:'PATCH',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({fields:{ownerUid:{stringValue:'manager'},state:{stringValue:'succeeded'}}})})).status,403);
});
