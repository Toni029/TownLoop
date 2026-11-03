const {test}=require('node:test'),assert=require('node:assert/strict'),{build}=require('esbuild'),path=require('node:path');
async function load(entry){const result=await build({entryPoints:[path.resolve(entry)],bundle:true,platform:'node',format:'cjs',write:false});const m={exports:{}};new Function('module','exports','require',result.outputFiles[0].text)(m,m.exports,require);return m.exports;}
const prefix='data:application/pdf;base64,',data=prefix+Buffer.from('%PDF-1.7\n').toString('base64');
function fixture({partial=false,badIndex=false,oversize=false,denied=false}={}){const calls=[];return {calls,fetch:async(url,options)=>{calls.push({url,options});if(denied)return new Response('{}',{status:403});if(!url.includes('/chunks'))return new Response('{}',{status:404});if(!url.includes('/chunks'))return new Response('{}',{status:404});if(url.includes('/chunks/0?'))return Response.json({fields:{totalChunks:{integerValue:partial?'2':'1'},totalSize:{integerValue:String(oversize?70000000:data.length)}}});return Response.json({documents:[{fields:{index:{integerValue:badIndex?'1':'0'},data:{stringValue:data},totalChunks:{integerValue:partial?'2':'1'},totalSize:{integerValue:String(data.length)}}}]});}};}
test('retained PDF is fetched with resident Firebase authorization from default database only; exact bytes reused',async()=>{
 const {retainedNativePdf}=await load('server/nativeNewsletter.ts'),f=fixture();const result=await retainedNativePdf('retained','Bearer fixture',true,f.fetch);assert.equal(Buffer.from(result,'base64').toString(),'%PDF-1.7\n');assert.equal(f.calls.length,3);for(const c of f.calls){assert.match(c.url,/cc-livingcommunity-app\/databases\/\(default\)/);assert.equal(c.options.headers.Authorization,'Bearer fixture');assert.equal(c.options.redirect,'error');}
});
test('incomplete, inconsistent, oversized and unauthorized retained uploads never reach extraction',async()=>{
 const {retainedNativePdf}=await load('server/nativeNewsletter.ts');for(const flags of [{partial:true},{badIndex:true},{oversize:true},{denied:true}]){const f=fixture(flags);await assert.rejects(retainedNativePdf('retained','Bearer fixture',true,f.fetch));}
 const f=fixture();await assert.rejects(retainedNativePdf('../outside','Bearer fixture',true,f.fetch));assert.equal(f.calls.length,0);
});
test('capabilities declare separate Gemini limit and expose no credentials',async()=>{
 const api=await load('server/nativeNewsletter.ts');const old=process.env.GEMINI_API_KEY;try{process.env.GEMINI_API_KEY='fixture-secret';const caps=api.nativeNewsletterCapabilities();assert.equal(caps.database,'(default)');assert.equal(caps.maxPdfBytes,50000000);assert.equal(caps.configured,true);assert.ok(!JSON.stringify(caps).includes('fixture-secret'));}finally{if(old===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=old;}
});
test('native manager authorization checks (default), rejects unapproved/deleting/nonmanager accounts',async()=>{
 const {requireNativeNewsletterManager}=await load('server/newsletterAuth.ts');const saved=global.fetch;
 try{for(const role of ['admin','vip','resident','crew','unapproved','deleting']){const calls=[];global.fetch=async(url)=>{calls.push(String(url));return Response.json(String(url).includes('accounts:lookup')?{users:[{localId:'fixture-user',providerUserInfo:[{providerId:'password'}]}]}:{fields:{role:{stringValue:['unapproved','deleting'].includes(role)?'admin':role},approved:{booleanValue:role!=='unapproved'},deletionPending:{booleanValue:role==='deleting'}}});};let next=false,status;await requireNativeNewsletterManager({headers:{authorization:'Bearer fixture'}},{status:n=>({json(){status=n;}})},()=>{next=true;});assert.equal(next,['admin','vip'].includes(role));assert.match(calls[1],/databases\/\(default\)\/documents\/users\/fixture-user/);if(!next)assert.equal(status,403);}}
 finally{global.fetch=saved;}
});
test('81 complete chunks remain valid when Firestore returns only one document per requested eight-document page',async()=>{
 const {retainedNativePdf}=await load('server/nativeNewsletter.ts');const chunks=Array.from({length:81},(_,i)=>(i===0?prefix:'')+Buffer.from(i===0?'%PDF-1.7\n': 'abc').toString('base64')),size=chunks.reduce((n,s)=>n+s.length,0);let pages=0;
 const fetcher=async url=>{if(!url.includes('/chunks'))return new Response('{}',{status:404});if(url.includes('/chunks/0?'))return Response.json({fields:{totalChunks:{integerValue:'81'},totalSize:{integerValue:String(size)}}});const page=Number(new URL(url).searchParams.get('pageToken')||0);pages++;return Response.json({documents:[{fields:{index:{integerValue:String(page)},data:{stringValue:chunks[page]},totalChunks:{integerValue:'81'},totalSize:{integerValue:String(size)}}}],...(page<80?{nextPageToken:String(page+1)}:{})});};
 const actual=await retainedNativePdf('complete-81','Bearer fixture',true,fetcher);assert.equal(actual,chunks.join('').slice(prefix.length));assert.equal(pages,81);
});
function pagedFixture({perPage=3,hashes=true,mutate=()=>{},manifestMutation=()=>{},emptyFirst=false}={}){
 const {createHash}=require('node:crypto');const chunks=Array.from({length:81},(_,i)=>{const data=(i===0?prefix:'')+Buffer.from(i===0?'%PDF-1.7\n':'abc').toString('base64');return {index:{integerValue:String(i)},data:{stringValue:data},...(hashes?{sha256:{stringValue:createHash('sha256').update(data).digest('hex')}}:{})};});const size=chunks.reduce((n,c)=>n+c.data.stringValue.length,0);for(const c of chunks){c.totalChunks={integerValue:'81'};c.totalSize={integerValue:String(size)};}const manifest={id:{stringValue:'complete-81'},totalChunks:{integerValue:'81'},totalSize:{integerValue:String(size)},sourceBytes:{integerValue:String(Buffer.from(chunks.map(c=>c.data.stringValue).join('').slice(prefix.length),'base64').length)}};manifestMutation(manifest);mutate(chunks);let pages=0;
 const fetcher=async url=>{if(url.includes('/chunks/0?'))return Response.json({fields:{totalChunks:{integerValue:'81'},totalSize:{integerValue:String(size)}}});if(!url.includes('/chunks'))return Response.json({fields:manifest});const page=Number(new URL(url).searchParams.get('pageToken')||0);pages++;const start=(page-(emptyFirst?1:0))*perPage,end=start+perPage;return Response.json({documents:start<0?[]:chunks.slice(start,end).map(fields=>({fields})),...(end<81?{nextPageToken:String(page+1)}:{})});};
 return {fetcher,manifest,chunks,getPages:()=>pages};
}
test('actual 27-page/three-chunk response verifies all hashes and matches the completion manifest',async()=>{const api=await load('server/nativeNewsletter.ts'),f=pagedFixture();const result=await api.retainedNativePdf('complete-81','Bearer fixture',true,f.fetcher);assert.equal(f.getPages(),27);assert.equal(Buffer.from(result,'base64').length,Number(f.manifest.sourceBytes.integerValue));assert.equal(api.NATIVE_PDF_LOADER_VERSION,2);assert.equal(api.nativeNewsletterCapabilities().version,1);});
test('empty continuation pages are followed; malformed repeated tokens remain bounded',async()=>{const api=await load('server/nativeNewsletter.ts'),f=pagedFixture({emptyFirst:true});await api.retainedNativePdf('complete-81','Bearer fixture',true,f.fetcher);assert.equal(f.getPages(),28);
 const repeat=pagedFixture();let pages=0;await assert.rejects(api.retainedNativePdf('complete-81','Bearer fixture',true,async url=>{const r=await repeat.fetcher(url);if(!url.includes('/chunks?'))return r;pages++;return Response.json({documents:[],nextPageToken:'repeated'});}),/repeated/);assert.equal(pages,2);
});
test('tampered chunks, mixed/missing hashes, duplicate indexes and incorrect completion metadata remain rejected',async()=>{const api=await load('server/nativeNewsletter.ts');for(const options of [
 {mutate:rows=>rows[40].data.stringValue='AAAA'},
 {mutate:rows=>delete rows[40].sha256},
 {mutate:rows=>rows[40].index.integerValue='39'},
 {mutate:rows=>rows.pop()},
 {manifestMutation:m=>m.sourceBytes.integerValue='999'},
 {manifestMutation:m=>m.totalChunks.integerValue='80'},
 {manifestMutation:m=>m.totalSize.integerValue='999'},
 {manifestMutation:m=>m.isRemoved={booleanValue:true}},
 ]){const f=pagedFixture(options);await assert.rejects(api.retainedNativePdf('complete-81','Bearer fixture',true,f.fetcher));}
 const legacy=pagedFixture({hashes:false});await api.retainedNativePdf('complete-81','Bearer fixture',true,legacy.fetcher);
});
