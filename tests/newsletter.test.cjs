const test = require('node:test');
const assert = require('node:assert/strict');
const { build } = require('esbuild');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
async function bundle(entry, mocks = {}) {
 const result = await build({entryPoints:[path.join(root,entry)],bundle:true,platform:'node',format:'cjs',write:false,plugins:[{name:'mocks',setup(b){
  b.onResolve({filter:/.*/}, args => args.path in mocks ? {path:args.path,namespace:'mock'} : null);
  b.onLoad({filter:/.*/,namespace:'mock'}, args => ({contents:mocks[args.path]}));
 }}]});
 const module={exports:{}};new Function('module','exports','require',result.outputFiles[0].text)(module,module.exports,require);return module.exports;
}
const event = (overrides = {}) => ({title:'Fall Festival', date:'October 31', time:'5 PM', location:'Pavilion', description:'Bring a side dish.', requiresRsvp:true, rsvpDetails:'RSVP by Monday, October 26th',sourcePage:10,...overrides});
const sdk = `export const Type={OBJECT:'OBJECT',ARRAY:'ARRAY',STRING:'STRING',BOOLEAN:'BOOLEAN',INTEGER:'INTEGER'}; export class GoogleGenAI {models={generateContent: async (args)=>{global.__model=args.model;return {text:JSON.stringify(global.__newsletter)}}}}`;
test('actual extraction excludes ordinary events, requires evidence, preserves event date and reports model',async()=>{
 const {extractNewsletterContent}=await bundle('server/newsletterExtractor.ts',{'@google/genai':sdk});
 process.env.GEMINI_API_KEY='test-only';
 global.__newsletter={monthEdition:'October 2026',events:[event(),event({title:'Open House',requiresRsvp:false}),event({title:'Unsubstantiated Event',rsvpDetails:''})], highlights:[]};
 const out=await extractNewsletterContent({base64Data:'x'.repeat(60)});
 assert.deepEqual(out.events.map(e=>e.title),['Fall Festival']);
 assert.equal(out.rsvp_events[0].day,'31');
 assert.equal(out.rsvp_events[0].deadline,'RSVP by Monday, October 26th');
 assert.equal(out.sourceModel,'gemini-3.8-flash');
 assert.equal(global.__model,out.sourceModel);
});
test('unknown dates/locations stay unknown; ISO dates and next-month events keep their actual month',async()=>{
 const {extractNewsletterContent}=await bundle('server/newsletterExtractor.ts',{'@google/genai':sdk});
 global.__newsletter={monthEdition:'Unknown',events:[event({date:'',time:'',location:''}),event({title:'Registration Workshop',date:'2026-11-02'})],highlights:[]};
 const out=await extractNewsletterContent({base64Data:'x'.repeat(60)});
 assert.equal(out.rsvp_events[0].day,'');assert.equal(out.rsvp_events[0].month,'');assert.equal(out.rsvp_events[0].location,'');
 assert.equal(out.rsvp_events[1].day,'02');assert.equal(out.rsvp_events[1].month,'NOV');
});
test('an empty document result stays empty, without invented highlights',async()=>{
 const {extractNewsletterContent}=await bundle('server/newsletterExtractor.ts',{'@google/genai':sdk});
 global.__newsletter={monthEdition:'October 2026',events:[],highlights:[]};
 const out=await extractNewsletterContent({base64Data:'x'.repeat(60)});
 assert.deepEqual(out.rsvp_events,[]);assert.deepEqual(out.pinned_highlights,[]);
 delete process.env.GEMINI_API_KEY;
 await assert.rejects(extractNewsletterContent({base64Data:'x'.repeat(60)}),/key is not configured/);
});
test('browser calls authenticated local endpoint without needing a Gemini key and surfaces server errors',async()=>{
 const {extractNewsletter}=await bundle('src/services/geminiNewsletter.ts',{'../firebase':`export const auth={currentUser:{getIdToken:async()=> 'test-id-token'}};`});
 const original=global.fetch;
 try {
 global.fetch=async(url,options)=>{
  assert.equal(url,'/api/newsletter/extract-content');assert.equal(options.headers.Authorization,'Bearer test-id-token');
  assert.equal(JSON.parse(options.body).monthEdition,'October 2026');
  return {ok:false,json:async()=>({error:'Gemini quota reached'})};
 };
 await assert.rejects(extractNewsletter({base64Data:'x'.repeat(60),mimeType:'application/pdf',monthEditionHint:'October 2026'}),/Gemini quota reached/);
 }finally{global.fetch=original;}
});
test('server rejects unauthenticated and unapproved users before any Gemini call',async()=>{
 const {requireNewsletterManager}=await bundle('server/newsletterAuth.ts');
 const response={status(n){this.code=n;return this;},json(value){this.body=value;}};
 let passed=false;await requireNewsletterManager({headers:{}},response,()=>passed=true);assert.equal(response.code,401);assert.equal(passed,false);
 const original=global.fetch;
 try {
 let calls=0;
 global.fetch=async()=>({ok:true,json:async()=>++calls===1?{users:[{localId:'test-user'}]}:{fields:{role:{stringValue:'admin'},approved:{booleanValue:false}}}});
 await requireNewsletterManager({headers:{authorization:'Bearer test-token'}},response,()=>passed=true);
 assert.equal(response.code,403);assert.equal(passed,false);
 }finally{global.fetch=original;}
});
test('server accepts an approved manager profile from the configured database',async()=>{
 const {requireNewsletterManager}=await bundle('server/newsletterAuth.ts');
 const original=global.fetch;let calls=0,passed=false;
 try {global.fetch=async(url)=>{if(++calls===2)assert.match(url,/databases\/\(default\)\/documents\/users\/test-user/);return {ok:true,json:async()=>calls===1?{users:[{localId:'test-user'}]}:{fields:{role:{stringValue:'admin'},approved:{booleanValue:true}}}};};
 await requireNewsletterManager({headers:{authorization:'Bearer test-token'}},{status(){throw new Error('Unexpected denial')}},()=>passed=true);assert.equal(passed,true);
 }finally{global.fetch=original;}
});

test('reader refuses stale cached metadata and revokes an open PDF when the admin removes it',async()=>{
 global.__readerStates=[];global.__cacheReads=0;global.__cleared=0;
 const {useNewsletterPdf}=await bundle('src/hooks/useNewsletterPdf.ts',{
  'react':`export const useState=()=>[{},s=>global.__readerStates.push(s)];export const useEffect=f=>{global.__cleanup=f()};`,
  'firebase/firestore':`export const doc=()=>({});export const onSnapshot=(ref,options,callback)=>{global.__snapshot=callback;return ()=>{}};`,
  '../firebase':`export const db={};`,
  '../services/storage':`export const downloadNewsletterPdfFromFirestore=async()=>null;`,
  '../utils/pdfStorage':`export const convertDataUrlToBlobUrl=()=> 'blob:test-newsletter';export const getPdfFromStorage=async()=>{global.__cacheReads++;return 'data:application/pdf;base64,JVBERg=='};export const clearAllNewsletterPdfStorage=async()=>{global.__cleared++};`,
 });
 const original=URL.revokeObjectURL;const revoked=[];URL.revokeObjectURL=url=>revoked.push(url);
 try{
 useNewsletterPdf();
 const snap=(config,fromCache=false)=>({metadata:{fromCache},exists:()=>true,data:()=>config});
 await global.__snapshot(snap({id:'edition-1',pdfUrl:'indexeddb:current_newsletter_pdf'},true));
 assert.equal(global.__cacheReads,0);
 await global.__snapshot(snap({id:'edition-1',pdfUrl:'indexeddb:current_newsletter_pdf'}));
 assert.equal(global.__readerStates.at(-1).activePdfUrl,'blob:test-newsletter');
 const originalFetch=global.fetch;
 try {
  global.fetch=async()=>({ok:false,status:404});
  await global.__snapshot(snap({id:'edition-1',pdfUrl:'/api/newsletter/pdf/current_newsletter.pdf'}));
  assert.equal(global.__readerStates.at(-1).activePdfUrl,'blob:test-newsletter');
 }finally{global.fetch=originalFetch;}
 await global.__snapshot(snap({id:'edition-1',isRemoved:true}));
 assert.equal(global.__readerStates.at(-1).activePdfUrl,'');assert.deepEqual(revoked,['blob:test-newsletter','blob:test-newsletter']);assert.equal(global.__cleared,1);
 global.__cleanup();
 }finally{URL.revokeObjectURL=original;}
});

test('explicit RSVP overrides recurring activity names, while routine activities stay excluded',async()=>{
 const {extractNewsletterContent}=await bundle('server/newsletterExtractor.ts',{'@google/genai':sdk});
 process.env.GEMINI_API_KEY='test-only';
 global.__newsletter={monthEdition:'October 2026',events:[event({title:'October Potluck',date:'October 20',rsvpDetails:'RSVP by Friday, October 9th'}),event({title:'Bingo',requiresRsvp:false,rsvpDetails:''})],highlights:[]};
 const out=await extractNewsletterContent({base64Data:'x'.repeat(60)});
 assert.deepEqual(out.events.map(e=>e.title),['October Potluck']);
 assert.equal(out.rsvp_events[0].day,'20');
 delete process.env.GEMINI_API_KEY;
});

test('PDF storage rejects removed editions, incomplete chunks, and stale tails from a larger previous PDF',async()=>{
 const sdkMock = `
 export const collection=(...args)=>args;export const doc=(...args)=>args;
 export const getDoc=async(ref)=>({exists:()=>true,data:()=>ref.at(-1)==='current'?global.__active:{totalChunks:2}});
 export const getDocs=async()=>({empty:false,forEach:fn=>global.__chunks.forEach(c=>fn({data:()=>c}))});
 export const addDoc=()=>{};export const setDoc=()=>{};export const updateDoc=()=>{};export const arrayUnion=()=>{};
 export const deleteDoc=()=>{};export const writeBatch=()=>{};export const serverTimestamp=()=>{};
 `;
 const {getNewsletterPdfFromFirestore}=await bundle('src/services/firestoreSync.ts',{'firebase/firestore':sdkMock,'../firebase':`export const db={};export const auth={};export const isFirebaseConfigured=()=>true;`});
 global.__active={id:'october',totalChunks:2};global.__chunks=[{index:0,data:'PDF-'},{index:1,data:'CURRENT'},{index:2,data:'OLD-TAIL'}];
 assert.equal(await getNewsletterPdfFromFirestore('october'),'PDF-CURRENT');
 assert.equal(await getNewsletterPdfFromFirestore('september'),null);
 global.__chunks=[{index:0,data:'PDF-'}];assert.equal(await getNewsletterPdfFromFirestore('october'),null);
 global.__active.isRemoved=true;assert.equal(await getNewsletterPdfFromFirestore('current'),null);
});
