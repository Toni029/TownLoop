const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('../node_modules/typescript');
function load(){const auth={currentUser:{uid:'manager',getIdToken:async()=> 'fixture'}},m={exports:{}};const code=ts.transpileModule(fs.readFileSync('native/src/news/analysisJobs.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','module','exports',code)(()=>({auth}),m,m.exports);return {auth,api:m.exports};}
const id='a'.repeat(64),ok=value=>({ok:true,json:async()=>value});
test('client follows durable progress without another PDF upload and returns only a complete result',async()=>{
 const {api}=load(),calls=[],progress=[],states=['running','retrying','succeeded'];let completed=0;
 const result=await api.analyzeInBackground('https://api.test',{newsletterId:'retained',isNewUpload:true},'manager',{wait:async()=>{},onProgress:p=>progress.push(p.state),fetcher:async(url,opts)=>{calls.push({url,opts});const state=opts.method==='POST'?'queued':states.shift();return ok({jobId:id,state,completedBatches:completed++,totalBatches:3,result:state==='succeeded'?{events:['verified']}:undefined});}});
 assert.deepEqual(result,{events:['verified']});assert.deepEqual(progress,['queued','running','retrying','succeeded']);assert.equal(calls.filter(c=>c.opts.method==='POST').length,1);assert.equal(JSON.parse(calls[0].opts.body).newsletterId,'retained');assert.ok(!calls.some(c=>c.opts.body?.includes('base64')));
});
test('account changes and closing stop client polling without cancelling the trusted worker',async()=>{
 const {api,auth}=load();let calls=0;
 await assert.rejects(api.analyzeInBackground('https://api.test',{newsletterId:'retained'},'manager',{fetcher:async()=>{calls++;return ok({jobId:id,state:'running'});},wait:async()=>{auth.currentUser={uid:'other'};}}),/account changed/);assert.equal(calls,1);
 auth.currentUser={uid:'manager',getIdToken:async()=> 'fixture'};const controller=new AbortController();calls=0;
 await assert.rejects(api.analyzeInBackground('https://api.test',{newsletterId:'retained'},'manager',{signal:controller.signal,fetcher:async()=>{calls++;return ok({jobId:id,state:'running'});},wait:async()=>controller.abort()}),/continues securely/);assert.equal(calls,1);
});
test('useful worker failure is displayed; temporary network failures retry only the reference',async()=>{
 const {api}=load();await assert.rejects(api.analyzeInBackground('https://api.test',{newsletterId:'retained'},'manager',{fetcher:async()=>ok({jobId:id,state:'failed',error:'Gemini quota reached. Retry saved groups later.'})}),/quota reached/);
 let calls=0;const result=await api.analyzeInBackground('https://api.test',{newsletterId:'retained'},'manager',{wait:async()=>{},fetcher:async()=>{if(++calls===1)throw Error('temporary DNS');return ok({jobId:id,state:'succeeded',result:{ready:true}});}});assert.equal(result.ready,true);assert.equal(calls,2);
});
