const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('../node_modules/typescript'),crypto=require('node:crypto');
function load(file,deps){const module={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(`native/src/news/${file}`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(key=>{assert.ok(key in deps,`unknown dependency ${key}`);return deps[key];},module,module.exports);return module.exports;}
const transfer=load('pdfTransfer.ts',{}),digest=async value=>crypto.createHash('sha256').update(value).digest('hex');
function fixture({controls=null,denied=false,existing=null,wrongReceipt=false,completeReceipts=false}={}){
 const calls=[],writes=[],auth={currentUser:{uid:'admin'}},bytes=Buffer.alloc(transfer.PDF_CHUNK_BYTES+12,65);bytes.write('%PDF-1.7\n');const source=transfer.stringPdfSource(transfer.PDF_PREFIX+bytes.toString('base64'));
 const totalChunks=Math.ceil(source.size/transfer.PDF_CHUNK_BYTES),totalSize=transfer.PDF_PREFIX.length+Math.ceil(source.size/3)*4;
 const module=load('edition.ts',{
  '../../../src/security/abuseBudget':{abuseControls:async()=>{calls.push('controls');return controls;}},
  'firebase/functions':{getFunctions:()=>({}),httpsCallable:()=>async input=>{calls.push(['reservation',input]);if(denied)throw Error('resource-exhausted');return{data:{reservationId:'a'.repeat(64),expiresAt:Date.now()+100000}};}},
  'firebase/firestore':{serverTimestamp:()=> 'server-time'},'firebase/storage':{},'../lib/firebase':{app:{},db:{},auth},'./actions':{approvedUser:async()=>({id:'admin'})},'./model':{},'./pdfTransfer':transfer,
  './firestorePdf':{pdfRequest:async()=>existing,pdfReceipts:async()=>{
   if(!wrongReceipt&&!completeReceipts)return[];
   const indices=completeReceipts?[0,1]:[0];return Promise.all(indices.map(async index=>({index,sha256:wrongReceipt?'0'.repeat(64):await digest((index===0?transfer.PDF_PREFIX:'')+await source.readBase64(index*transfer.PDF_CHUNK_BYTES,Math.min(transfer.PDF_CHUNK_BYTES,source.size-index*transfer.PDF_CHUNK_BYTES))),totalChunks,totalSize})));
  },chunkDigest:digest,savePdfDraft:async(id,data)=>{writes.push(data);calls.push(['draft',data.uploadState]);},commitPdfChunks:async(id,chunks)=>{calls.push(['chunks',chunks.map(c=>c.index)]);}},
 });return{module,calls,writes,source,totalChunks,totalSize,auth};
}
test('rollout OFF preserves fast byte-exact chunks with no callable request',async()=>{
 const f=fixture();const result=await f.module.stageEdition({id:'edition'},f.source,()=>{});
 assert.equal(result.sourceBytes,f.source.size);assert.equal(result.uploadedBy,'admin');assert.equal(f.calls.filter(Array.isArray).filter(c=>c[0]==='reservation').length,0);assert.equal(f.writes.length,2);
});
for(const controls of [{prepareClients:true},{enforceWrites:true}])test(`PDF reservation precedes all writes under ${Object.keys(controls)[0]}`,async()=>{
 const f=fixture({controls});const result=await f.module.stageEdition({id:'edition'},f.source,()=>{});
 const reservation=f.calls.find(c=>Array.isArray(c)&&c[0]==='reservation');assert.deepEqual(reservation[1],{newsletterId:'edition',bytes:f.source.size,totalChunks:f.totalChunks,totalSize:f.totalSize});
 assert.ok(f.calls.indexOf(reservation)<f.calls.findIndex(c=>Array.isArray(c)&&c[0]==='draft'));assert.equal(result.uploadBudgetId,'a'.repeat(64));assert.ok(f.writes.every(w=>w.uploadBudgetId===result.uploadBudgetId));
});
test('reservation denial fails before draft or chunk writes',async()=>{
 const f=fixture({controls:{prepareClients:true},denied:true});await assert.rejects(f.module.stageEdition({id:'edition'},f.source,()=>{}),/resource-exhausted/);assert.equal(f.writes.length,0);assert.equal(f.calls.filter(c=>Array.isArray(c)&&c[0]==='chunks').length,0);
});
test('wrong retained source fails before reservation or metadata changes',async()=>{
 const f=fixture({controls:{enforceWrites:true},wrongReceipt:true});await assert.rejects(f.module.stageEdition({id:'edition'},f.source,()=>{}),/not the original PDF/);assert.deepEqual(f.calls,[]);assert.equal(f.writes.length,0);
});
test('completed verified uploaded edition is reused without rewinding state or new quota',async()=>{
 const f=fixture({controls:{enforceWrites:true},completeReceipts:true,existing:{fields:{uploadState:{stringValue:'uploaded'},uploadedBy:{stringValue:'admin'},uploadBudgetId:{stringValue:'b'.repeat(64)}}}}),progress=[];
 const result=await f.module.stageEdition({id:'edition'},f.source,n=>progress.push(n));assert.equal(result.uploadState,'uploaded');assert.equal(result.uploadBudgetId,'b'.repeat(64));assert.deepEqual(progress,[100]);assert.deepEqual(f.calls,[]);assert.equal(f.writes.length,0);
});
test('existing source dimensions cannot be changed even without retained chunks',async()=>{
 const f=fixture({existing:{fields:{sourceBytes:{integerValue:'4'}}}});await assert.rejects(f.module.stageEdition({id:'edition'},f.source,()=>{}),/different PDF dimensions/);assert.equal(f.calls.length,0);assert.equal(f.writes.length,0);
});
