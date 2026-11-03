const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('../node_modules/typescript');
const moduleUnderTest={exports:{}};
new Function('exports','module',ts.transpileModule(fs.readFileSync('native/src/news/pdfTransfer.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(moduleUnderTest.exports,moduleUnderTest);
const {transferPdf,newUploadResume,stringPdfSource,PDF_PREFIX,PDF_CHUNK_BYTES}=moduleUnderTest.exports;
function source(size){const bytes=Buffer.alloc(size,73);bytes.write('%PDF-1.7\n');return {bytes,source:stringPdfSource(PDF_PREFIX+bytes.toString('base64'))};}
const pause=ms=>new Promise(r=>setTimeout(r,ms));
test('bounded batches preserve every PDF byte and count only confirmed bytes',async()=>{
 const {bytes,source:pdf}=source(PDF_CHUNK_BYTES*17+2),chunks=[],progress=[];let active=0,max=0;
 const metrics=await transferPdf({source:pdf,key:'draft',resume:newUploadResume(),check(){},progress:p=>progress.push(p),async commit(batch){assert.equal(batch.length,1);max=Math.max(max,++active);await pause(2);chunks.push(...batch);active--;}});
 assert.equal(max,2);assert.equal(metrics.commits,18);assert.equal(progress[0].percent,0);assert.equal(progress.at(-1).percent,100);assert.equal(progress.at(-1).confirmedBytes,bytes.length);
 assert.deepEqual(Buffer.from(chunks.sort((a,b)=>a.index-b.index).map(c=>c.data).join('').slice(PDF_PREFIX.length),'base64'),bytes);
 assert.ok(progress.every((p,i)=>!i||p.percent>=progress[i-1].percent));
});
test('retry reuses confirmed batches after a failed commit',async()=>{
 const {source:pdf}=source(PDF_CHUNK_BYTES*9),resume=newUploadResume(),calls=new Map();let fail=true;
 const input={source:pdf,key:'draft',resume,check(){},progress(){},async commit(batch){const id=batch[0].index;calls.set(id,(calls.get(id)||0)+1);if(id===4&&fail){fail=false;throw Error('offline');}}};
 await assert.rejects(transferPdf(input));await transferPdf(input);
 assert.equal(calls.get(0),1);assert.equal(calls.get(4),2);assert.equal(calls.get(8),1);
});
test('pause keeps pending confirmations and retry never sends them twice',async()=>{
 const {source:pdf}=source(PDF_CHUNK_BYTES*9),resume=newUploadResume(),controller=new AbortController();let release,calls=0;
 const gate=new Promise(r=>release=r),input={source:pdf,key:'draft',resume,check(){},progress(){},async commit(){calls++;await gate;}};
 const first=transferPdf({...input,signal:controller.signal});await pause(5);controller.abort();await assert.rejects(first,/paused/);assert.equal(calls,2);
 release();await transferPdf(input);assert.equal(calls,9);
});
test('changed identity is stopped before further writes',async()=>{
 const {source:pdf}=source(PDF_CHUNK_BYTES*9);let authorized=true,calls=0;
 await assert.rejects(transferPdf({source:pdf,key:'draft',resume:newUploadResume(),check(){if(!authorized)throw Error('account changed');},progress(){},async commit(){calls++;authorized=false;}}),/account changed|paused/);assert.ok(calls<=2);
});
test('42 MiB fixture: serial baseline versus bounded batched confirmations (synthetic 10ms RTT)',async()=>{
 const {source:pdf}=source(42*1024*1024);const oldWrites=Math.ceil((PDF_PREFIX.length+Math.ceil(pdf.size/3)*4)/(650*1024));let start=performance.now();for(let i=0;i<oldWrites;i++)await pause(10);const baseline=performance.now()-start;
 const result=await transferPdf({source:pdf,key:'benchmark',resume:newUploadResume(),check(){},progress(){},async commit(){await pause(10);}});
 console.log(JSON.stringify({synthetic:true,bytes:pdf.size,oldSerialWrites:oldWrites,oldConfirmationMs:Math.round(baseline),newBatchCommits:result.commits,newElapsedMs:Math.round(result.elapsedMs),rangeReadMs:Math.round(result.readMs)}));
 assert.ok(result.elapsedMs<baseline*0.75);
});
test('confirmation timeout does not blindly resend a pending batch',async()=>{
 const {source:pdf}=source(1000),resume=newUploadResume();let release,calls=0;
 const pending=new Promise(r=>release=r),input={source:pdf,key:'timeout',resume,check(){},progress(){},async commit(){calls++;await pending;}};
 await assert.rejects(transferPdf({...input,confirmationTimeoutMs:5}),/timed out/);assert.equal(calls,1);
 release();await transferPdf(input);assert.equal(calls,1);
});
test('raw range reads and commit waits are measured independently',async()=>{
 const {source:pdf}=source(1000);let clock=0;
 const result=await transferPdf({source:{...pdf,async readBase64(...args){clock+=7;return pdf.readBase64(...args);}},key:'metrics',resume:newUploadResume(),check(){},progress(){},now:()=>clock,async commit(){clock+=31;}});
 assert.equal(result.readMs,7);assert.equal(result.commitMs,31);assert.equal(result.elapsedMs,38);
});
