const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('../node_modules/typescript');
function load(name,modules,extra={}){modules={'../../newsletter-api.json':{url:''},...modules};const m={exports:{}};const code=ts.transpileModule(fs.readFileSync('native/src/news/'+name,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','module','exports',...Object.keys(extra),code)(id=>modules[id],m,m.exports,...Object.values(extra));return m.exports;}
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
 const requests=[];const api=load('ai.ts',{'./api':{preflightAnalysis:async()=> 'https://api.example.test'},'firebase/firestore':{},'../lib/firebase':{auth},'./actions':{approvedUser:async()=>({id:'manager'})},'./edition':{activeEdition:async()=>{}},'./model':{},'./analysisModel':{analysisItems:()=>[]}},{fetch:async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>({rsvp_events:[],pinned_highlights:[]})};}});
 await api.analyzeNewsletter({id:'retained',fileName:'newsletter.pdf'},true);await api.analyzeNewsletter({id:'retained'},true);
 assert.equal(requests.length,2);for(const r of requests){assert.match(r.url,/native\/extract-content$/);const body=JSON.parse(r.options.body);assert.equal(body.newsletterId,'retained');assert.equal(body.isNewUpload,true);assert.equal('base64Data' in body,false);assert.ok(r.options.body.length<500);}
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
