const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ts=require('../node_modules/typescript'),root=path.resolve(__dirname,'../src/news');
function load(name,modules){const m={exports:{}};const code=ts.transpileModule(fs.readFileSync(path.join(root,name),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','module','exports',code)(id=>{if(!(id in modules))throw Error(`Unexpected dependency ${id}`);return modules[id];},m,m.exports);return m.exports;}
const transfer=load('pdfTransfer.ts',{});
function fixture(){const writes=[];const edition=load('edition.ts',{'./firestorePdf':{commitPdfChunks:async(id,chunks)=>{writes.push(...chunks.map(c=>({ref:`newsletters/${id}/chunks/${c.index}`,size:c.data.length})));}},'firebase/firestore':{setDoc:async(ref,data)=>writes.push({ref,checkpoint:data}),writeBatch:()=>{const pending=[];return {set:(ref,data)=>pending.push({ref,size:data.data.length}),commit:async()=>writes.push(...pending)};},doc:(_db,...p)=>p.join('/'),serverTimestamp:()=> 'server-time'},'firebase/storage':{},'../lib/firebase':{db:{},storage:{},auth:{currentUser:{uid:'admin'}}},'./actions':{approvedUser:async()=>({id:'admin',role:'admin',approved:true})},'./model':{},'./pdfTransfer':transfer});return{edition,writes};}
const pdf=bytes=>'data:application/pdf;base64,JVBERi0'+'A'.repeat(Math.ceil(bytes/3)*4-7);
test('a 42 MiB replacement stages safely in bounded chunks, preserving the old active pointer',async()=>{
 const {edition,writes}=fixture(),progress=[];assert.equal(edition.MAX_PDF_BYTES,64*1024*1024);
 const data=pdf(42*1024*1024);const metadata=await edition.stageEdition({id:'replacement'},data,n=>progress.push(n));const checkpoints=writes.filter(w=>w.checkpoint);assert.equal(checkpoints.length,1);assert.equal(checkpoints[0].checkpoint.uploadState,'uploaded');writes.splice(0,writes.length,...writes.filter(w=>!w.checkpoint));
 assert.equal(metadata.totalSize,data.length);assert.equal(writes.length,metadata.totalChunks);assert(writes.every(w=>w.size<=650*1024&&w.ref.startsWith('newsletters/replacement/chunks/')));
 assert.equal(writes.reduce((n,w)=>n+w.size,0),data.length);assert.equal(progress.at(-1),100);
});
test('PDFs above 64 MiB are rejected before any staging writes',async()=>{
 const {edition,writes}=fixture();await assert.rejects(edition.stageEdition({id:'replacement'},pdf(65*1024*1024),()=>{}),/64 MB/);assert.equal(writes.length,0);
});
test('native picker reads only the header, retains one account-scoped copy and reads AI bytes lazily',async()=>{
 const {edition}=fixture();for(const size of [42,65]){
  const reads=[],moves=[];const existing=new Set(['fixture']);
  class File{constructor(...parts){this.uri=parts.join('/');this.size=size*1024*1024;}get exists(){return existing.has(this.uri);}delete(){existing.delete(this.uri);}}
  const auth={currentUser:{uid:'admin'}};
  const files=load('files.ts',{'./download':{},'expo-file-system':{File,Paths:{cache:'cache'}},'expo-file-system/legacy':{EncodingType:{Base64:'base64'},readAsStringAsync:async(uri,options)=>{reads.push(options);return 'JVBERi0xLjcK';},moveAsync:async({from,to})=>{moves.push({from,to});existing.delete(from);existing.add(to);}},'expo-sharing':{},'expo-document-picker':{getDocumentAsync:async()=>({canceled:false,assets:[{uri:'fixture',name:'Newsletter.pdf'}]})},'./edition':edition,'../lib/firebase':{auth},'../localData/privateMediaCache':{accountMediaPrefix:uid=>`account-${uid}-`},'./model':{}});
  if(size===42){
   const selected=await files.pickPdf();assert.equal(selected.size,42*1024*1024);assert.deepEqual(reads,[{encoding:'base64',position:0,length:8}]);assert.equal(moves.length,1);assert.equal(existing.size,1);
   assert.match(await selected.readDataUrl(),/^data:application\/pdf;base64,JVBERi0/);assert.equal(reads.length,2);
   auth.currentUser={uid:'other'};await assert.rejects(selected.readBase64(0,8),/current account/);
   selected.dispose();assert.equal(existing.size,0);
  }else{await assert.rejects(files.pickPdf(),/64 MB/);assert.equal(reads.length,0);assert.equal(existing.size,0);}
 }
});
