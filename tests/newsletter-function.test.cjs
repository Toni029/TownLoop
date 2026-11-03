const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {provision}=require('../security/newsletter-api/provision.cjs');
// Pure packaging/authorization tests run on a clean checkout. Install isolated dependencies to enable runtime/PDF integration checks.
const runtimeInstalled=fs.existsSync('.release/newsletter-api/node_modules/firebase-functions');
const pdfInstalled=fs.existsSync('.release/newsletter-api/node_modules/pdfjs-dist');
test.before(async()=>{await require('../security/newsletter-api/prepare.cjs').prepare();});
test('setup without approval does not read credentials or call cloud APIs',()=>{
 const r=spawnSync(process.execPath,['security/newsletter-api/provision.cjs'],{encoding:'utf8',env:{PATH:process.env.PATH}});assert.equal(r.status,0);assert.match(r.stdout,/Nothing changed/);
});
test('provisioning imports the existing key in the HTTPS body and grants only this secret to the dedicated identity',async()=>{
 const calls=[];const api=async(url,body,missing)=>{calls.push({url,body});if(missing)return null;if(url.includes('/versions?'))return {versions:[]};if(url.includes(':getIamPolicy'))return {etag:'fixture-etag',version:3,bindings:[{role:'roles/viewer',members:['user:existing@example.test'],condition:{expression:'true'}}]};return {};};
 const result=await provision(api,async()=> 'fixture-gemini-key');assert.equal(result.deployed,false);assert.equal(result.secretVersionAdded,true);assert.ok(calls.every(c=>!c.url.includes('fixture-gemini-key')));
 const version=calls.find(c=>c.url.endsWith(':addVersion'));assert.equal(Buffer.from(version.body.payload.data,'base64').toString(),'fixture-gemini-key');
 const policy=calls.find(c=>c.url.endsWith(':setIamPolicy'));assert.match(policy.url,/secrets\/GEMINI_API_KEY:/);assert.equal(policy.body.policy.etag,'fixture-etag');assert.deepEqual(policy.body.policy.bindings[0].members,['user:existing@example.test']);assert.deepEqual(policy.body.policy.bindings[1],{role:'roles/secretmanager.secretAccessor',members:['serviceAccount:townloop-newsletter-api@cc-livingcommunity-app.iam.gserviceaccount.com']});
 assert.ok(calls.every(c=>!c.url.includes('firestore')&&!c.url.includes('cloudfunctions')));
});
test('existing enabled secret and access policy are reused without reading or replacing key material',async()=>{
 const writes=[];await provision(async(url,body)=>{if(body)writes.push(url);if(url.includes('/versions?'))return {versions:[{state:'ENABLED'}]};if(url.includes(':getIamPolicy'))return {bindings:[{role:'roles/secretmanager.secretAccessor',members:['serviceAccount:townloop-newsletter-api@cc-livingcommunity-app.iam.gserviceaccount.com']}]};return {};},()=>{throw Error('Must not read local credentials');});assert.deepEqual(writes,[]);
});
test('isolated function exports only newsletterApi with bound secret, low concurrency, and no scheduled workers',()=>{
 const m={exports:{}};new Function('require','module','exports',fs.readFileSync('security/newsletter-api/index.cjs','utf8'))(id=>id==='firebase-functions/v2/https'?{onRequest:(options,app)=>({options,app})}:id==='firebase-functions/params'?{defineSecret:name=>({name})}:{app:'fixture-app'},m,m.exports);
 assert.deepEqual(Object.keys(m.exports),['newsletterApi']);const o=m.exports.newsletterApi.options;assert.equal(o.memory,'2GiB');assert.equal(o.concurrency,1);assert.equal(o.maxInstances,2);assert.equal(o.secrets[0].name,'GEMINI_API_KEY');assert.match(o.serviceAccount,/^townloop-newsletter-api@/);
 const config=JSON.parse(fs.readFileSync('firebase.newsletter-api.json'));assert.equal(config.functions.length,1);assert.equal(config.functions[0].codebase,'newsletter-api');assert.equal(config.firestore,undefined);assert.equal(config.hosting,undefined);
});
test('prepared package excludes local secrets/website/workers, and app targets the deterministic function URL',()=>{
 const out='.release/newsletter-api';assert.deepEqual(fs.readdirSync(out).filter(n=>n!=='node_modules').sort(),['index.cjs','lib','package-lock.json','package.json']);const code=fs.readFileSync(path.join(out,'lib/native-app.cjs'),'utf8');assert.ok(code.includes('extractNewsletterContent'));assert.ok(code.includes('retainedNativePdf'));assert.ok(!code.includes('onSchedule'));assert.ok(!code.includes('dotenv.config'));
 const config=JSON.parse(fs.readFileSync('native/newsletter-api.json'));assert.equal(config.url,'https://us-central1-cc-livingcommunity-app.cloudfunctions.net/newsletterApi');assert.equal(config.deploymentStatus,'deployed');
});
test('packaged function rejects unauthenticated inference without contacting Gemini',{skip:!runtimeInstalled},async()=>{
 const http=require('node:http'),handler=require('../.release/newsletter-api/index.cjs').newsletterApi;
 const server=http.createServer(handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{const url='http://127.0.0.1:'+server.address().port;const r=await fetch(url+'/api/newsletter/native/extract-content',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({newsletterId:'fixture',isNewUpload:true})});assert.equal(r.status,401);const health=await fetch(url+'/api/newsletter/native/health');assert.equal((await health.json()).service,'townloop-native-api');}
 finally{await new Promise(r=>server.close(r));}
});
test('packaged PDF.js and native canvas parse/render a synthetic PDF, independent of root dependencies',{skip:!pdfInstalled},async()=>{
 const {getDocument}=await import('../.release/newsletter-api/node_modules/pdfjs-dist/legacy/build/pdf.mjs');
 const stream='BT /F1 12 Tf 20 100 Td (TownLoop synthetic newsletter fixture for dependency verification.) Tj ET';
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 160] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
 let pdf='%PDF-1.7\n',offsets=[0];objects.forEach((o,i)=>{offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${o}\nendobj\n`;});const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 6\n0000000000 65535 f \n`+offsets.slice(1).map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
 const task=getDocument({data:new Uint8Array(Buffer.from(pdf)),useSystemFonts:true});
 try{const doc=await task.promise;assert.equal(doc.numPages,1);const page=await doc.getPage(1),text=await page.getTextContent();assert.match(text.items.map(i=>i.str).join(''),/TownLoop synthetic newsletter/);const viewport=page.getViewport({scale:1}),surface=doc.canvasFactory.create(viewport.width,viewport.height);try{await page.render({canvasContext:surface.context,viewport}).promise;assert.ok(surface.canvas.toBuffer('image/png').length>100);}finally{doc.canvasFactory.destroy(surface);page.cleanup();}}
 finally{await task.destroy();}
});
test('packaged function rejects oversized Framework-preparsed bodies before any inference',{skip:!runtimeInstalled},async()=>{
 const http=require('node:http'),handler=require('../.release/newsletter-api/index.cjs').newsletterApi;
 const server=http.createServer((req,res)=>{req.rawBody=Buffer.alloc(65537);handler(req,res);});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{const r=await fetch('http://127.0.0.1:'+server.address().port+'/api/newsletter/native/extract-content',{method:'POST'});assert.equal(r.status,413);assert.match((await r.json()).error,/retained newsletter reference/);}
 finally{await new Promise(r=>server.close(r));}
});
