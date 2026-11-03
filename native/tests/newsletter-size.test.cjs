const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ts=require('../node_modules/typescript'),root=path.resolve(__dirname,'../src/news');
function load(name,modules){const m={exports:{}};const code=ts.transpileModule(fs.readFileSync(path.join(root,name),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','module','exports',code)(id=>{if(!(id in modules))throw Error(`Unexpected dependency ${id}`);return modules[id];},m,m.exports);return m.exports;}
function fixture(){const writes=[];const edition=load('edition.ts',{'firebase/firestore':{setDoc:async(ref,data)=>writes.push({ref,size:data.data.length}),doc:(_db,...p)=>p.join('/'),serverTimestamp:()=> 'server-time'},'firebase/storage':{},'../lib/firebase':{db:{},storage:{}},'./actions':{approvedUser:async()=>({role:'admin',approved:true})},'./model':{}});return{edition,writes};}
const pdf=bytes=>'data:application/pdf;base64,JVBERi0'+'A'.repeat(Math.ceil(bytes/3)*4-7);
test('a 42 MiB replacement stages safely in bounded chunks, preserving the old active pointer',async()=>{
 const {edition,writes}=fixture(),progress=[];assert.equal(edition.MAX_PDF_BYTES,64*1024*1024);
 const data=pdf(42*1024*1024);const metadata=await edition.stageEdition({id:'replacement'},data,n=>progress.push(n));
 assert.equal(metadata.totalSize,data.length);assert.equal(writes.length,metadata.totalChunks);assert(writes.every(w=>w.size<=650*1024&&w.ref.startsWith('newsletters/replacement/chunks/')));
 assert.equal(writes.reduce((n,w)=>n+w.size,0),data.length);assert.equal(progress.at(-1),80);
});
test('PDFs above 64 MiB are rejected before any staging writes',async()=>{
 const {edition,writes}=fixture();await assert.rejects(edition.stageEdition({id:'replacement'},pdf(65*1024*1024),()=>{}),/64 MB/);assert.equal(writes.length,0);
});
test('native picker accepts a 42 MiB PDF and rejects oversized files before reading bytes',async()=>{
 const {edition}=fixture();for(const size of [42,65]){
  let reads=0;class File{constructor(){this.size=size*1024*1024;this.exists=true;}async base64(){reads++;return 'JVBERi0xLjcK';}delete(){this.exists=false;}}
  const files=load('files.ts',{'./download':{},'expo-file-system':{File},'expo-sharing':{},'expo-document-picker':{getDocumentAsync:async()=>({canceled:false,assets:[{uri:'fixture',name:'Newsletter.pdf'}]})},'./edition':edition,'../lib/firebase':{auth:{}},'../localData/privateMediaCache':{},'./model':{}});
  if(size===42){assert.equal((await files.pickPdf()).size,42*1024*1024);assert.equal(reads,1);}else{await assert.rejects(files.pickPdf(),/64 MB/);assert.equal(reads,0);}
 }
});
