const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('../node_modules/typescript'),crypto=require('node:crypto');
function moduleFor(name,deps){const m={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync('native/src/news/'+name,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(id=>deps[id],m,m.exports);return m.exports;}
const transfer=moduleFor('pdfTransfer.ts',{}),digest=async s=>crypto.createHash('sha256').update(s).digest('hex');
function fixture(){const rows=new Map(),written=[],journal=[];let failIndex=1,metadata;
 const edition=moduleFor('edition.ts',{'firebase/firestore':{serverTimestamp:()=> 'server-time'},'firebase/storage':{},'../lib/firebase':{auth:{currentUser:{uid:'manager'}}},'./actions':{approvedUser:async()=>({id:'manager'})},'./model':{},'./pdfTransfer':transfer,'./firestorePdf':{
  pdfRequest:async()=>metadata?{fields:{uploadState:{stringValue:metadata.uploadState},uploadedBy:{stringValue:'manager'}}}:null,
  pdfReceipts:async()=>[...rows.values()].map(({data,...r})=>r),chunkDigest:digest,
  savePdfDraft:async(id,m)=>{metadata=m;journal.push(m.uploadState)},
  commitPdfChunks:async(id,chunks,totalChunks,totalSize)=>{for(const c of chunks){if(c.index===failIndex){failIndex=-1;throw Error('offline');}written.push(c.index);rows.set(c.index,{index:c.index,sha256:await digest(c.data),totalChunks,totalSize,data:c.data});}},
 }});
 const bytes=Buffer.alloc(transfer.PDF_CHUNK_BYTES*3+2,73);bytes.write('%PDF-1.7\n');const source=()=>transfer.stringPdfSource(transfer.PDF_PREFIX+bytes.toString('base64'));
 return {rows,written,journal,edition,source,bytes,getMetadata:()=>metadata};
}
test('closing/reopening a partial draft resumes only verified missing chunks, keeping the live pointer untouched',async()=>{const f=fixture(),progress=[];const config={id:'draft',uploadedBy:'manager',editionTitle:'Newsletter'};
 await assert.rejects(f.edition.stageEdition(config,f.source(),()=>{}),/offline/);assert.equal(f.getMetadata().uploadState,'uploading');const before=new Map(f.written.map(i=>[i,f.written.filter(v=>v===i).length]));
 await f.edition.stageEdition(config,f.source(),p=>progress.push(p));for(const [index,count] of before)assert.equal(f.written.filter(i=>i===index).length,count);assert.equal(progress.at(-1),100);assert.equal(f.getMetadata().uploadState,'uploaded');assert.equal(f.getMetadata().sourceBytes,f.bytes.length);
 assert.deepEqual(Buffer.from([...f.rows.values()].sort((a,b)=>a.index-b.index).map(r=>r.data).join('').slice(transfer.PDF_PREFIX.length),'base64'),f.bytes);assert.ok(!f.journal.includes('published'));
});
test('wrong original PDF fails hash verification before any retained bytes or metadata are changed',async()=>{const f=fixture(),config={id:'draft',uploadedBy:'manager'};await assert.rejects(f.edition.stageEdition(config,f.source(),()=>{}));const before=f.written.length,states=f.journal.length;f.bytes[50]=12;
 await assert.rejects(f.edition.stageEdition(config,f.source(),()=>{}),/not the original PDF/);assert.equal(f.written.length,before);assert.equal(f.journal.length,states);
});
