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
const event = (overrides = {}) => ({title:'Fall Festival', date:'October 31', time:'5 PM', location:'Pavilion', description:'Bring a side dish.', requiresRsvp:true, isRecurring:false, rsvpDetails:'RSVP by Monday, October 26th',sourcePage:10,...overrides});
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

test('special events qualify but recurring activities are excluded even with RSVP',async()=>{
 const {extractNewsletterContent}=await bundle('server/newsletterExtractor.ts',{'@google/genai':sdk});
 process.env.GEMINI_API_KEY='test-only';
 global.__newsletter={monthEdition:'October 2026',events:[event({title:'Autumn Garden Tour',date:'October 20',rsvpDetails:'RSVP by Friday, October 9th'}),event({title:'Bingo',isRecurring:true,requiresRsvp:true,rsvpDetails:'RSVP to the office'})],highlights:[]};
 const out=await extractNewsletterContent({base64Data:'x'.repeat(60)});
 assert.deepEqual(out.events.map(e=>e.title),['Autumn Garden Tour']);
 assert.equal(out.rsvp_events[0].day,'20');
 delete process.env.GEMINI_API_KEY;
});

test('PDF storage rejects removed editions, incomplete chunks, and stale tails from a larger previous PDF',async()=>{
 const sdkMock = `
 export const runTransaction=async()=>{};export const collection=(...args)=>args;export const doc=(...args)=>args;
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

test('native analysis saves selected drafts once without overwriting RSVP records and rejects changed editions', async()=>{
 const config={id:'edition-one',editionTitle:'October',monthEdition:'October 2026',uploadedAt:1};
 global.__aiCurrent=config; global.__aiExists=false; global.__aiWrites=[];
 const mocks={
 'react-native':`export const Platform={OS:'web'};`,
 '../lib/firebase':`export const db={};export const auth={currentUser:{getIdToken:async()=> 'test-token'}};`,
 './actions':`export const approvedUser=async()=>({id:'admin',role:'admin'});`,
 './edition':`export const activeEdition=async()=>global.__aiCurrent;export const loadPdfData=async()=> 'data:application/pdf;base64,JVBERi0=';`,
 'firebase/firestore':`export const doc=(_db,c,id)=>({c,id});export const runTransaction=async(_db,fn)=>fn({get:async ref=>({exists:()=>ref.id==='current'||global.__aiExists,data:()=>global.__aiCurrent}),set:(ref,data)=>global.__aiWrites.push({ref,data}),update:()=>{}});`,
 };
 const {applyAnalysis}=await bundle('native/src/news/ai.ts',mocks);
 const {analysisItems}=await bundle('native/src/news/analysisModel.ts');
 const result={sourceModel:'gemini',rsvp_events:[{title:'Festival',month:'OCT',day:31,deadline:'RSVP by Oct 25'}],pinned_highlights:[]};
 const selected=analysisItems(result,config).map(item=>item.id);
 await applyAnalysis(result,config,selected);assert.equal(global.__aiWrites.length,1);
 global.__aiExists=true;await applyAnalysis(result,config,selected);assert.equal(global.__aiWrites.length,1);
 global.__aiCurrent={...config,id:'another'};await assert.rejects(applyAnalysis(result,config,selected),/newsletter changed/);assert.equal(global.__aiWrites.length,1);
});

test('native upload stages PDF before review and atomically publishes approved items afterward', async()=>{
 global.__stageWrites=[];global.__publishWrites=[];global.__currentEdition=null;
 const {stageEdition,finishEdition}=await bundle('native/src/news/edition.ts',{
 '../lib/firebase':`export const db={};export const storage={};`,
 './actions':`export const approvedUser=async()=>({id:'admin'});`,
 'firebase/storage':`export const ref=()=>{};export const deleteObject=async()=>{};`,
 'firebase/firestore':`export const collection=()=>{};export const deleteDoc=async()=>{};export const getDocFromServer=async()=>{};export const getDocsFromServer=async()=>{};export const writeBatch=()=>{};export const serverTimestamp=()=>1;export const doc=(_db,...parts)=>parts.join('/');export const setDoc=async(ref,data)=>global.__stageWrites.push({ref,data});export const runTransaction=async(_db,fn)=>fn({get:async()=>({exists:()=>!!global.__currentEdition,data:()=>global.__currentEdition}),set:(ref,data)=>global.__publishWrites.push({ref,data})});`,
 });
 const {editionKey}=await bundle('native/src/news/model.ts');
 const config={id:'draft',editionTitle:'October',monthEdition:'October 2026',uploadedAt:1};
 const staged=await stageEdition(config,'data:application/pdf;base64,JVBERi0xLjcK',()=>{});
 assert.equal(global.__stageWrites.length,1);assert.equal(global.__publishWrites.length,0);
 const items=[{id:'event',collection:'community_events',data:{title:'Reviewed event'}}];
 await finishEdition(staged,editionKey(null),items);
 assert.deepEqual(global.__publishWrites.map(w=>w.ref),['community_events/event','newsletters/draft','newsletters/current']);
 global.__publishWrites=[];global.__currentEdition={...config,id:'newer'};
 await assert.rejects(finishEdition(staged,editionKey(null),items),/Another administrator/);
 assert.equal(global.__publishWrites.length,0);
});

test('unavailable primary moves directly to PDF-capable fallback with bounded HTTP requests', async()=>{
 global.__attempts=[];
 const mock=`export const Type={OBJECT:'OBJECT',ARRAY:'ARRAY',STRING:'STRING',BOOLEAN:'BOOLEAN',INTEGER:'INTEGER'};export class GoogleGenAI{models={generateContent:async args=>{global.__attempts.push({model:args.model,timeout:args.config.httpOptions.timeout,abort:!!args.config.abortSignal});if(args.model==='gemini-3.8-flash')throw Object.assign(new Error('503 UNAVAILABLE'),{status:503});return {text:JSON.stringify(global.__newsletter)};}}}`;
 const {extractNewsletterContent}=await bundle('server/newsletterExtractor.ts',{'@google/genai':mock});
 process.env.GEMINI_API_KEY='test-only';global.__newsletter={monthEdition:'October 2026',events:[event()],highlights:[]};
 const result=await extractNewsletterContent({base64Data:'x'.repeat(60)});
 assert.equal(result.sourceModel,'gemini-3-flash-preview');assert.deepEqual(global.__attempts.map(a=>a.model),['gemini-3.8-flash','gemini-3-flash-preview']);
 assert.ok(global.__attempts.every(a=>a.timeout===40000&&a.abort));
 global.__attempts=[];await extractNewsletterContent({base64Data:'x'.repeat(60),isReanalysis:true});assert.deepEqual(global.__attempts.map(a=>a.model),['gemini-3-flash-preview']);
 delete process.env.GEMINI_API_KEY;
});

test('large PDF uploads once, reuses file across fallbacks, and cleans up after success or failure',async()=>{
 const mock=`export const Type={OBJECT:'OBJECT',ARRAY:'ARRAY',STRING:'STRING',BOOLEAN:'BOOLEAN',INTEGER:'INTEGER'};export class GoogleGenAI{files={upload:async()=>{global.__uploads++;return{name:'files/test',uri:'https://example.invalid/file',state:'ACTIVE'}},delete:async()=>{global.__deletes++}};models={generateContent:async args=>{global.__largeAttempts.push(args);if(global.__allFail||args.model==='gemini-3.1-flash-lite')throw Object.assign(new Error('503 UNAVAILABLE'),{status:503});return{text:JSON.stringify({monthEdition:'October 2026',events:[],highlights:[]})}}}}`;
 const run=async fail=>{global.__uploads=0;global.__deletes=0;global.__largeAttempts=[];global.__allFail=fail;process.env.GEMINI_API_KEY='test-only';const {extractNewsletterContent}=await bundle('server/newsletterExtractor.ts',{'@google/genai':mock});return extractNewsletterContent({base64Data:'A'.repeat(12*1024*1024),mimeType:'application/pdf'});};
 const result=await run(false);assert.equal(result.sourceModel,'gemini-3-flash-preview');assert.equal(global.__uploads,1);assert.equal(global.__deletes,1);assert.ok(global.__largeAttempts.every(a=>a.contents[0].parts[0].fileData && !a.contents[0].parts[0].inlineData && a.config.httpOptions.timeout===60000));
 await assert.rejects(run(true),/503/);assert.equal(global.__uploads,1);assert.equal(global.__deletes,1);delete process.env.GEMINI_API_KEY;
});

test('file-service failure falls back to page-labelled text instead of resending a large inline PDF',async()=>{
 const mock=`export const Type={OBJECT:'OBJECT',ARRAY:'ARRAY',STRING:'STRING',BOOLEAN:'BOOLEAN',INTEGER:'INTEGER'};export class GoogleGenAI{files={upload:async()=>{throw Object.assign(new Error('404'),{status:404})}};models={generateContent:async args=>{global.__textParts=args.contents[0].parts;return{text:JSON.stringify({monthEdition:'October 2026',events:[],highlights:[]})}}}}`;
 const {extractNewsletterContent}=await bundle('server/newsletterExtractor.ts',{'@google/genai':mock,'./newsletterPdfText.ts':`export class NewsletterPdfError extends Error {}; export const newsletterPdfText=async()=> '=== PDF PAGE 1 === Test document facts';`});
 process.env.GEMINI_API_KEY='test-only';await extractNewsletterContent({base64Data:'A'.repeat(12*1024*1024),mimeType:'application/pdf'});assert.match(global.__textParts[0].text,/PDF PAGE 1/);assert.equal(global.__textParts[0].inlineData,undefined);delete process.env.GEMINI_API_KEY;
});


test('image-only PDF uses labelled page images when file upload and text extraction fail', async()=>{
 const mock=`export const Type={OBJECT:'OBJECT',ARRAY:'ARRAY',STRING:'STRING',BOOLEAN:'BOOLEAN',INTEGER:'INTEGER'};export class GoogleGenAI{files={upload:async()=>{throw new Error('404')}};models={generateContent:async args=>{global.__visionParts=args.contents[0].parts;return{text:JSON.stringify({monthEdition:'October 2026',events:[],highlights:[]})}}}}`;
 const {extractNewsletterContent}=await bundle('server/newsletterExtractor.ts',{'@google/genai':mock,'./newsletterPdfText.ts':`export const newsletterPdfText=async()=>{throw new Error('image-only')};`,'./newsletterPdfImages.ts':`export const newsletterPdfImages=async()=>[{text:'PDF PAGE 1'},{inlineData:{mimeType:'image/jpeg',data:'page-image'}}];`});
 process.env.GEMINI_API_KEY='test-only';
 try {
  await extractNewsletterContent({base64Data:'A'.repeat(12*1024*1024),mimeType:'application/pdf'});
  assert.equal(global.__visionParts[0].text,'PDF PAGE 1');
  assert.deepEqual(global.__visionParts[1].inlineData,{mimeType:'image/jpeg',data:'page-image'});
  assert.ok(!global.__visionParts.some(p=>p.inlineData?.mimeType==='application/pdf'));
 } finally {delete process.env.GEMINI_API_KEY;}
});

test('visual batches retain successful pages across model fallback and cache only complete results',async()=>{
 const mock=`export const Type={OBJECT:'OBJECT',ARRAY:'ARRAY',STRING:'STRING',BOOLEAN:'BOOLEAN',INTEGER:'INTEGER'};export class GoogleGenAI{files={upload:async()=>{throw new Error('404')}};models={generateContent:async args=>{const labels=args.contents[0].parts.filter(p=>p.text?.startsWith('PAGE')).map(p=>p.text);const batch=labels.at(-1);global.__batchCalls.push({batch,model:args.model});if(batch==='PAGE 3'&&args.model==='gemini-3.1-flash-lite')throw new Error('503');return{text:JSON.stringify({monthEdition:'October 2026',events:[],highlights:[{title:batch,summary:'Verified page',category:'News'}]})}}}}`;
 const {extractNewsletterContent}=await bundle('server/newsletterExtractor.ts',{'@google/genai':mock,'./newsletterPdfText.ts':`export const newsletterPdfText=async()=>{throw new Error('scanned')}`,'./newsletterPdfImages.ts':`export const newsletterPdfImages=async()=>Array.from({length:3},(_,i)=>[{text:'PAGE '+(i+1)},{inlineData:{mimeType:'image/jpeg',data:'image'}}]).flat();`});
 process.env.GEMINI_API_KEY='test';global.__batchCalls=[];
 const payload={base64Data:'A'.repeat(12*1024*1024),mimeType:'application/pdf'};
 try {
 const result=await extractNewsletterContent(payload);
 assert.equal(result.highlights.length,3);
 assert.equal(global.__batchCalls.length,4);
 assert.equal(global.__batchCalls.filter(c=>c.batch==='PAGE 1').length,1);
 result.highlights.length=0;
 const again=await extractNewsletterContent(payload);
 assert.equal(again.highlights.length,3);
 assert.equal(global.__batchCalls.length,4);
 }finally{delete process.env.GEMINI_API_KEY;}
});


test('all Home reminder activities and potluck variants are excluded even if AI labels them non-recurring', async()=>{
 const {MONTHLY_ACTIVITIES_LIST}=await bundle('src/data/monthlyActivities.ts');
 const {extractNewsletterContent}=await bundle('server/newsletterExtractor.ts',{'@google/genai':sdk});
 process.env.GEMINI_API_KEY='test-only';
 const titles=[...MONTHLY_ACTIVITIES_LIST.map(a=>a.title),'October Potluck','Fried Chicken Potluck','Pot-luck Dinner','Pup Play Date','Coffee Klatch','On Site Dermatology'];
 global.__newsletter={monthEdition:'October 2026',events:[...titles.map(title=>event({title})),event({title:'Hallo-Wine & Cheese'}),event({title:'Ice Cream Social'}),event()],highlights:[]};
 try {
 const out=await extractNewsletterContent({base64Data:'r'.repeat(60)});
 assert.deepEqual(out.events.map(e=>e.title),['Hallo-Wine & Cheese','Ice Cream Social','Fall Festival']);
 assert.equal(out.rsvp_events.length,3);
 } finally {delete process.env.GEMINI_API_KEY;}
});
