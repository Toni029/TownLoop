const test = require('node:test');
const assert = require('node:assert/strict');
const { build } = require('esbuild');
const path = require('node:path');
async function bundle(entry, mocks = {}) {
 const result = await build({entryPoints:[path.resolve(__dirname,'..',entry)],bundle:true,platform:'node',format:'cjs',write:false,plugins:[{name:'synthetic',setup(b){
  b.onResolve({filter:/.*/}, a => a.path in mocks ? {path:a.path,namespace:'mock'} : null);
  b.onLoad({filter:/.*/,namespace:'mock'}, a => ({contents:mocks[a.path]}));
 }}]});
 const m={exports:{}};new Function('module','exports','require',result.outputFiles[0].text)(m,m.exports,require);return m.exports;
}
const bucket = require('../firebase-applet-config.json').storageBucket;
const cloud = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/newsletters%2Fedition%2Fdocument.pdf?alt=media&token=public-token`;
test('PDF validation rejects non-PDF/malformed encoding and oversized encoded bytes before decoding', async () => {
 const {decodePdf,MAX_NEWSLETTER_PDF_BYTES}=await bundle('server/newsletterPdfSecurity.ts');
 assert.equal(decodePdf('data:application/pdf;base64,JVBERi0xLjcK').toString(),'%PDF-1.7\n');
 for(const value of ['', 'SGVsbG8=', 'JVBERi0x L j c K', 'JVBERi0===', 'data:text/plain;base64,JVBERi0xLjcK', 'file:///etc/passwd']) assert.throws(()=>decodePdf(value));
 assert.throws(()=>decodePdf('A'.repeat(Math.ceil(MAX_NEWSLETTER_PDF_BYTES/3)*4+4)),e=>e.status===413);
});
test('PDF fetch allowlist rejects arbitrary hosts, ports, credentials, other buckets and paths without a network call',async()=>{
 const {fetchNewsletterPdf,newsletterStorageUrl}=await bundle('server/newsletterPdfSecurity.ts');let calls=0;
 assert.equal(newsletterStorageUrl(`gs://${bucket}/newsletters/edition/document.pdf`),cloud.split('&token=')[0]);
 const fake=async()=>{calls++;throw Error('unexpected call');};
 for (const url of ['http://localhost/a.pdf','https://127.0.0.1/a.pdf','https://[::1]/a.pdf','https://169.254.169.254/a.pdf','file:///tmp/x','https://example.test/x',cloud.replace(bucket,'other-bucket'),cloud.replace('newsletters%2Fedition','users%2Fedition'),cloud.replace('googleapis.com','googleapis.com.evil.test'),cloud.replace('https://','https://user:pass@'),cloud.replace('.com/', '.com:444/'),cloud+'#x'])
  await assert.rejects(fetchNewsletterPdf(url,'Bearer fixture',fake));
 assert.equal(calls,0);
});
test('own-bucket fetch strips download tokens, authenticates, forbids redirects, checks MIME and caps declared/stream bytes',async()=>{
 const {fetchNewsletterPdf,MAX_NEWSLETTER_PDF_BYTES}=await bundle('server/newsletterPdfSecurity.ts');
 const output=await fetchNewsletterPdf(cloud,'Bearer fixture',async(url,options)=>{
  assert.equal(new URL(url).search,'?alt=media');assert.equal(options.headers.Authorization,'Bearer fixture');assert.equal(options.redirect,'error');
  return new Response('%PDF-1.7\n',{headers:{'Content-Type':'application/pdf'}});
 });assert.equal(output.toString(),'%PDF-1.7\n');
 for(const response of [new Response('bad',{headers:{'Content-Type':'text/html'}}),new Response('bad',{headers:{'Content-Type':'application/pdf','Content-Length':String(MAX_NEWSLETTER_PDF_BYTES+1)}}),new Response('',{status:302,headers:{Location:'http://127.0.0.1/'}})])
  await assert.rejects(fetchNewsletterPdf(cloud,'Bearer fixture',async()=>response));
 let cancelled=false;
 const stream=new ReadableStream({pull(c){c.enqueue(new Uint8Array(1024*1024));},cancel(){cancelled=true;}});
 await assert.rejects(fetchNewsletterPdf(cloud,'Bearer fixture',async()=>new Response(stream,{headers:{'Content-Type':'application/pdf'}})),e=>e.status===413);
 assert.equal(cancelled,true);
});
test('approved resident may read but cannot write; pending/deleting/disabled identities and query tokens fail closed',async()=>{
 const {requireNewsletterReader,requireNewsletterManager}=await bundle('server/newsletterAuth.ts');
 const original=global.fetch;
 try {
  for(const state of [{approved:true,allowed:true},{approved:false},{approved:true,deletionPending:true},{approved:true,disabled:true}]){
   let call=0,passed=false;
   global.fetch=async()=>({ok:true,json:async()=>++call===1?{users:[{localId:'synthetic',disabled:state.disabled}]}:{fields:{role:{stringValue:'resident'},approved:{booleanValue:state.approved},deletionPending:{booleanValue:!!state.deletionPending}}}});
   const res={status(n){this.code=n;return this;},json(){}};
   await requireNewsletterReader({headers:{authorization:'Bearer fixture'}},res,()=>passed=true);
   assert.equal(passed,!!state.allowed);
  }
  global.fetch=async()=>{throw Error('No query token may reach authentication');};
  const res={status(n){this.code=n;return this;},json(){}};
  await requireNewsletterReader({headers:{},query:{token:'fixture'}},res,()=>assert.fail());assert.equal(res.code,401);
  let call=0;
  global.fetch=async()=>({ok:true,json:async()=>++call===1?{users:[{localId:'synthetic'}]}:{fields:{role:{stringValue:'resident'},approved:{booleanValue:true}}}});
  await requireNewsletterManager({headers:{authorization:'Bearer fixture'}},res,()=>assert.fail());assert.equal(res.code,403);
 }finally{global.fetch=original;}
});
test('registered newsletter/translation routes authenticate before their bounded JSON parsers',async()=>{
 global.__h10Routes=[];global.__h10Parsers=[];
 await bundle('server.ts',{
  express:`const app={use(){},get(p,...h){global.__h10Routes.push({method:'GET',p,h});},post(p,...h){global.__h10Routes.push({method:'POST',p,h});},delete(p,...h){global.__h10Routes.push({method:'DELETE',p,h});},listen(){}};function express(){return app;}express.json=o=>{const parser=()=>{};parser.limit=o.limit;global.__h10Parsers.push(parser);return parser;};export default express;`,
  fs:`export default {existsSync:()=>true};`,
  dotenv:`export default {config(){}};`,
  vite:`export const createServer=async()=>({middlewares(){}});`,
  './server/newsletterExtractor.ts':`export const extractNewsletterContent=async()=>{throw Error('No AI call expected')};`,
  './server/translation.ts':`export const translateWorkOrderContent=async()=>{throw Error('No AI call expected')};`,
 });
 assert.equal(global.__h10Parsers.length,2);
 const res={status(n){this.code=n;return this;},json(){}};
 for(const route of global.__h10Routes.filter(r=>r.method==='POST')) {
  const parserIndex=route.h.findIndex(h=>h.limit);assert.ok(parserIndex>0,route.p);
  let reachedParser=false;
  const run=async i=>{if(i===parserIndex){reachedParser=true;return;}await route.h[i]({headers:{},ip:'synthetic'},res,()=>run(i+1));};
  await run(0);assert.equal(res.code,401);assert.equal(reachedParser,false);
 }
 for(const p of ['/api/newsletter/current','/api/newsletter/pdf/:filename']) {
  const route=global.__h10Routes.find(r=>r.p===p&&r.method==='GET');
  await route.h[0]({headers:{}},res,()=>assert.fail());assert.equal(res.code,401);
 }
 assert.equal(global.__h10Routes.find(r=>r.p==='/api/translate').h.find(h=>h.limit).limit,'256kb');
});

test('web reader sends ID tokens only to same-origin newsletter API and uses authenticated Storage for old token URLs/private identities', async()=>{
 const {fetchNewsletterResource}=await bundle('src/services/newsletterDownload.ts',{
  '../firebase':`export const auth={currentUser:{getIdToken:async()=> 'fixture'}};export const storage={app:{options:{storageBucket:${JSON.stringify(bucket)}}}};`,
  'firebase/storage':`export const ref=(_storage,path)=>path;export const getBlob=async(path,max)=>{global.__h10BlobRead={path,max};return new Blob(['%PDF-1.7']);};`,
 });
 const original=global.fetch,oldWindow=global.window;global.window={location:{origin:'https://townloop.example'}};
 try {
  let requests=0;
  global.fetch=async(url,options)=>{requests++;assert.equal(new URL(url).origin,'https://townloop.example');assert.equal(options.headers.get('Authorization'),'Bearer fixture');assert.equal(options.redirect,'error');return new Response('%PDF-1.7');};
  await fetchNewsletterResource('/api/newsletter/pdf/current_newsletter.pdf?v=1');
  await fetchNewsletterResource('/api/newsletter/current');
  await assert.rejects(fetchNewsletterResource('https://outside.invalid/api/newsletter/current'));
  await assert.rejects(fetchNewsletterResource('/api/other'));
  assert.equal(requests,2);
  for(const source of [cloud,`gs://${bucket}/newsletters/edition/document.pdf`]) {
   const response=await fetchNewsletterResource(source);assert.equal(await response.text(),'%PDF-1.7');
   assert.deepEqual(global.__h10BlobRead,{path:'newsletters/edition/document.pdf',max:32*1024*1024});
  }
  assert.equal(requests,2);
 }finally{global.fetch=original;global.window=oldWindow;}
});
test('native reader fallback rejects unknown hosts and resolves private Storage identities with authenticated byte limits',async()=>{
 const {downloadPdfBytes}=await bundle('native/src/news/download.ts',{
  '../lib/firebase':`export const auth={currentUser:{getIdToken:async()=> 'fixture'}};export const storage={app:{options:{storageBucket:${JSON.stringify(bucket)}}}};`,
  './edition':`export const MAX_PDF_BYTES=32*1024*1024;`,
  'firebase/storage':`export const ref=(_storage,path)=>path;export const getBytes=async(path,max)=>{global.__h10NativeRead={path,max};return new TextEncoder().encode('%PDF-1.7').buffer;};`,
 });
 const original=global.fetch,base=process.env.EXPO_PUBLIC_TOWNLOOP_API_URL;
 process.env.EXPO_PUBLIC_TOWNLOOP_API_URL='https://townloop.example';
 try {
  let requests=0;
  global.fetch=async(url,options)=>{requests++;assert.equal(new URL(url).origin,'https://townloop.example');assert.equal(options.headers.Authorization,'Bearer fixture');assert.equal(options.redirect,'error');return new Response('%PDF-1.7');};
  assert.equal(new TextDecoder().decode(await downloadPdfBytes('/api/newsletter/pdf/current_newsletter.pdf?v=1')),'%PDF-1.7');
  for(const url of ['https://evil.invalid/a.pdf','file:///tmp/a','http://127.0.0.1/a','/api/other'])await assert.rejects(downloadPdfBytes(url));
  for(const url of [cloud,`gs://${bucket}/newsletters/edition/document.pdf`]) assert.equal(new TextDecoder().decode(await downloadPdfBytes(url)),'%PDF-1.7');
  assert.equal(requests,1);assert.deepEqual(global.__h10NativeRead,{path:'newsletters/edition/document.pdf',max:32*1024*1024});
 }finally{global.fetch=original;if(base===undefined)delete process.env.EXPO_PUBLIC_TOWNLOOP_API_URL;else process.env.EXPO_PUBLIC_TOWNLOOP_API_URL=base;}
});
