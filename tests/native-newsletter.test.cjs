const {test}=require('node:test'),assert=require('node:assert/strict'),{build}=require('esbuild'),path=require('node:path');
async function load(entry){const result=await build({entryPoints:[path.resolve(entry)],bundle:true,platform:'node',format:'cjs',write:false});const m={exports:{}};new Function('module','exports','require',result.outputFiles[0].text)(m,m.exports,require);return m.exports;}
const prefix='data:application/pdf;base64,',data=prefix+Buffer.from('%PDF-1.7\n').toString('base64');
function fixture({partial=false,badIndex=false,oversize=false,denied=false}={}){const calls=[];return {calls,fetch:async(url,options)=>{calls.push({url,options});if(denied)return new Response('{}',{status:403});if(url.includes('/chunks/0?'))return Response.json({fields:{totalChunks:{integerValue:partial?'2':'1'},totalSize:{integerValue:String(oversize?70000000:data.length)}}});return Response.json({documents:[{fields:{index:{integerValue:badIndex?'1':'0'},data:{stringValue:data},totalChunks:{integerValue:partial?'2':'1'},totalSize:{integerValue:String(data.length)}}}]});}};}
test('retained PDF is fetched with resident Firebase authorization from default database only; exact bytes reused',async()=>{
 const {retainedNativePdf}=await load('server/nativeNewsletter.ts'),f=fixture();const result=await retainedNativePdf('retained','Bearer fixture',true,f.fetch);assert.equal(Buffer.from(result,'base64').toString(),'%PDF-1.7\n');assert.equal(f.calls.length,2);for(const c of f.calls){assert.match(c.url,/cc-livingcommunity-app\/databases\/\(default\)/);assert.equal(c.options.headers.Authorization,'Bearer fixture');assert.equal(c.options.redirect,'error');}
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
