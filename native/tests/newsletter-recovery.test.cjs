const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('../node_modules/typescript');
function load(name,modules,extra={}){modules={'../../newsletter-api.json':{url:''},'expo-crypto':{CryptoDigestAlgorithm:{SHA256:'SHA-256'},digestStringAsync:async(_,s)=>require('crypto').createHash('sha256').update(s).digest('hex')},...modules};const m={exports:{}};const code=ts.transpileModule(fs.readFileSync('native/src/news/'+name,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','module','exports',...Object.keys(extra),code)(id=>modules[id],m,m.exports,...Object.values(extra));return m.exports;}
const auth={currentUser:{uid:'manager',getIdToken:async()=> 'fixture-id-token'}};
test('analysis rejects missing URL before any PDF read or upload',async()=>{
 const api=load('api.ts',{'../lib/firebase':{auth},'./actions':{approvedUser:async()=>({id:'manager'})},'react-native':{Platform:{OS:'android'}}},{process:{env:{}},fetch:()=>{throw Error('unexpected request');}});
 await assert.rejects(api.preflightAnalysis(42*1024*1024),/HTTPS.*service|service.*configured/i);
});
test('preflight rejects website HTML, wrong database, unavailable Gemini and size over the declared limit',async()=>{
 for(const body of [null,{service:'townloop-newsletter',projectId:'cc-livingcommunity-app',database:'website',version:1,configured:true,maxPdfBytes:50000000},{service:'townloop-newsletter',projectId:'cc-livingcommunity-app',database:'(default)',version:1,configured:false,maxPdfBytes:50000000},{service:'townloop-newsletter',projectId:'cc-livingcommunity-app',database:'(default)',version:1,configured:true,maxPdfBytes:32*1024*1024}]){
 const api=load('api.ts',{'../lib/firebase':{auth},'./actions':{approvedUser:async()=>({id:'manager'})},'react-native':{Platform:{OS:'android'}}},{process:{env:{EXPO_PUBLIC_TOWNLOOP_API_URL:'https://api.example.test'}},fetch:async()=>({ok:true,json:async()=>body})});await assert.rejects(api.preflightAnalysis(42*1024*1024));}
});
test('direct PDF commit uses Firebase identity/rules, exact paths, transforms and bounded payload; no service key',async()=>{
 const requests=[];const rest=load('firestorePdf.ts',{'../lib/firebase':{auth},'../../firebase-config.json':{projectId:'cc-livingcommunity-app'},'./pdfTransfer':{PDF_PREFIX:'data:application/pdf;base64,'}},{fetch:async(url,opts)=>{requests.push({url,opts});return {ok:true,json:async()=>({writeResults:[{}]})};}});
 await rest.commitPdfChunks('draft-1',[{index:0,data:'data:application/pdf;base64,JVBERi0=',bytes:5}],1,34);
 assert.match(requests[0].url,/databases\/\(default\)\/documents:commit$/);assert.equal(requests[0].opts.headers.Authorization,'Bearer fixture-id-token');const body=JSON.parse(requests[0].opts.body);assert.match(body.writes[0].update.name,/newsletters\/draft-1\/chunks\/0$/);assert.equal(body.writes[0].update.fields.data.stringValue,'data:application/pdf;base64,JVBERi0=');assert.equal(body.writes[0].updateTransforms[0].setToServerValue,'REQUEST_TIME');
 await assert.rejects(rest.commitPdfChunks('../unsafe',[],0,0));
});
test('analysis retry sends only the retained ID and never re-reads or retransmits the PDF',async()=>{
 const requests=[];const helper=load('analysisJobs.ts',{'../lib/firebase':{auth}},{fetch:async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>({jobId:'a'.repeat(64),state:'succeeded',result:{rsvp_events:[],pinned_highlights:[]}})};}});
 const api=load('ai.ts',{'./analysisJobs':helper,'./api':{preflightAnalysis:async()=> 'https://api.example.test'},'firebase/firestore':{},'../lib/firebase':{auth},'./actions':{approvedUser:async()=>({id:'manager'})},'./edition':{activeEdition:async()=>{}},'./model':{},'./analysisModel':{analysisItems:()=>[]}});
 await api.analyzeNewsletter({id:'retained',fileName:'newsletter.pdf'},true);await api.analyzeNewsletter({id:'retained'},true);
 assert.equal(requests.length,2);for(const r of requests){assert.match(r.url,/native\/analysis-jobs$/);const body=JSON.parse(r.options.body);assert.equal(body.newsletterId,'retained');assert.equal(body.isNewUpload,true);assert.equal('base64Data' in body,false);assert.ok(r.options.body.length<500);}
});
test('recovery lists a complete legacy orphan but excludes active and partial PDFs without reading document bytes',async()=>{
 const fields=n=>({integerValue:String(n)}),paths=[];
 const drafts=load('drafts.ts',{'./actions':{approvedUser:async()=>({id:'manager'})},'./pdfTransfer':{PDF_PREFIX:'data:application/pdf;base64,'},'./firestorePdf':{pdfId:id=>id,pdfRequest:async(path)=>{
  paths.push(path);if(path.startsWith('/newsletters?'))return {documents:[{name:'newsletters/current',fields:{id:{stringValue:'active'}}},{name:'newsletters/active',fields:{id:{stringValue:'active'},uploadState:{stringValue:'uploaded'}}},{name:'newsletters/orphan'},{name:'newsletters/partial'}]};
  const row=index=>({fields:{index:fields(index),totalChunks:fields(2),totalSize:fields(100),updatedAt:{timestampValue:'2026-11-03T17:04:30Z'}}});return {documents:path.includes('/orphan/')?[row(0),row(1)]:[row(0)]};
 }}});
 const values=await drafts.retainedEditions();assert.equal(values.length,1);assert.equal(values[0].id,'orphan');assert.equal(values[0].uploadedBy,undefined);assert.ok(paths.every(p=>!p.includes('mask.fieldPaths=data')));assert.equal(paths.some(p=>p.includes('/active/chunks')),false);
});
test('Android/iOS default configuration resolves the prepared Firebase endpoint without a public API key',()=>{
 const backend=JSON.parse(fs.readFileSync('native/newsletter-api.json','utf8'));
 for(const platform of ['android','ios']){const api=load('api.ts',{'../../newsletter-api.json':backend,'../lib/firebase':{auth},'./actions':{},'react-native':{Platform:{OS:platform}}},{process:{env:{}}});assert.equal(api.analysisServiceUrl(),'https://us-central1-cc-livingcommunity-app.cloudfunctions.net/newsletterApi');}
 assert.deepEqual(Object.keys(backend).sort(),['deploymentStatus','functionName','projectId','url']);
});
test('partial recovery offers only the current manager’s hashed draft, never another account or unverified legacy bytes',async()=>{
 const n=v=>({integerValue:String(v)}),size=2*480*1024,total='data:application/pdf;base64,'.length+Math.ceil(size/3)*4;
 const drafts=load('drafts.ts',{'./actions':{approvedUser:async()=>({id:'manager'})},'./pdfTransfer':{PDF_PREFIX:'data:application/pdf;base64,',PDF_CHUNK_BYTES:480*1024},'./firestorePdf':{pdfId:id=>id,pdfRequest:async path=>{
  if(path.startsWith('/newsletters?')) return {documents:['own','other','legacy'].map(id=>({name:'newsletters/'+id,fields:{id:{stringValue:id},uploadState:{stringValue:'uploading'},uploadedBy:{stringValue:id==='other'?'someone-else':'manager'},sourceBytes:n(size),totalChunks:n(2),totalSize:n(total)}}))};
  return {documents:[{fields:{index:n(0),totalChunks:n(2),totalSize:n(total),sha256:{stringValue:path.includes('/legacy/')?'':'f'.repeat(64)},updatedAt:{timestampValue:'2026-11-03T19:00:00Z'}}}]};
 }}});
 const result=await drafts.retainedEditions();assert.deepEqual(result.map(r=>r.id),['own']);assert.equal(result[0].partial,true);assert.equal(result[0].confirmedChunks,1);
});
test('Admin resume falls back from server-only orphan discovery to authorized draft listing',async()=>{
 const paths=[],n=v=>({integerValue:String(v)});
 const drafts=load('drafts.ts',{'./actions':{approvedUser:async()=>({id:'manager',role:'admin'})},'./pdfTransfer':{PDF_PREFIX:'data:application/pdf;base64,'},'./firestorePdf':{pdfId:id=>id,pdfRequest:async path=>{
  paths.push(path);
  if(new URL('https://fixture.test'+path).searchParams.get('showMissing')==='true')throw Object.assign(Error('metadata requires server authentication'),{code:'firestore-metadata-auth-required'});
  if(path.startsWith('/newsletters?'))return {documents:[{name:'newsletters/draft',fields:{id:{stringValue:'draft'},uploadState:{stringValue:'uploaded'}}}]};
  return {documents:[{fields:{index:n(0),totalChunks:n(1),totalSize:n(100),updatedAt:{timestampValue:'2026-11-03T19:00:00Z'}}}]};
 }}});
 assert.deepEqual((await drafts.retainedEditions()).map(x=>x.id),['draft']);assert.equal(paths.length,3);
});
test('resume never hides a real permission denial behind a listing fallback',async()=>{
 let calls=0;const drafts=load('drafts.ts',{'./actions':{approvedUser:async()=>({id:'manager'})},'./firestorePdf':{pdfRequest:async()=>{calls++;throw Error('not authorized');}}});
 await assert.rejects(drafts.retainedEditions(),/not authorized/);assert.equal(calls,1);
});
