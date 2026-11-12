const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{webcrypto,createHash}=require('node:crypto');
const root=path.resolve(__dirname,'../..'),read=n=>fs.readFileSync(path.join(__dirname,n),'utf8');
test('privacy discloses verified unpaid Gemini processing and keeps personal safety contact off public pages',()=>{
 const html=fs.readFileSync(path.join(root,'public/privacy.html'),'utf8'),verification=JSON.parse(read('gemini-readonly-verification.json'));
 assert.equal(verification.keyProjectBilling.billingEnabled,false);assert.equal(verification.serviceTier.paidGeminiProject,false);
 for(const text of ['without enabled billing','human reviewers','not submit personal, sensitive or confidential','does not claim paid-tier'])assert(html.includes(text),text);
 for(const name of ['privacy.html','terms.html','child-safety.html'])assert.doesNotMatch(fs.readFileSync(path.join(root,'public',name),'utf8'),/Cecil[\s_-]*Pines|Antonio|Merlano/i);
 const safety=fs.readFileSync(path.join(root,'public/child-safety.html'),'utf8');assert(safety.includes('Seeds4Clix Safety Team'));assert(safety.includes('owner has confirmed'));assert(safety.includes('support@seeds4clix.com'));
});
test('retirement plan accounts for every current manifest item and protects Firebase associations',()=>{
 const plan=JSON.parse(read('retirement/plan.json')),snapshot=JSON.parse(read('hosting-readonly-snapshot.json'));
 assert.equal(plan.deployed,false);assert.equal(plan.backendRulesAuthNativeChanges,false);
 const actions=[...plan.publishLegalPaths,...Object.keys(plan.replace),...plan.omitFromNewRelease,...plan.preserveFromCurrentVersion];
 for(const f of snapshot.files)assert(actions.includes(f.path),f.path);
 const second=JSON.parse(read('default-site-readonly-verification.json'));for(const f of second.files)assert(actions.includes(f.path),f.path);
 assert.deepEqual(plan.sitesRequiringFinalApproval.map(s=>s.site),['townloop','cc-livingcommunity-app']);assert.equal(plan.authDomainMustRemain,'cc-livingcommunity-app.firebaseapp.com');
 assert(plan.preserveFromCurrentVersion.includes('/.well-known/assetlinks.json'));assert(plan.preserveFromCurrentVersion.includes('/__/firebase/init.json'));
 for(const name of ['index.html','404.html','sw.js'])assert.doesNotMatch(read('retirement/'+name),/Cecil[\s_-]*Pines|Antonio|Merlano|id="root"/i);
});
test('proposed retirement worker clears only exact old shell paths, preserves PDFs, other origins/caches and never handles fetch',async()=>{
 const listeners={},deleted=[];let claimed=false,unregistered=false;const origin='https://townloop.web.app';
 const requests=['/','/index.html','/privacy.html','/cecil-pines-logo.svg','/assets/index-C_3tBUcg.js','/newsletter.pdf','/unrelated','https://other.example/index.html'].map(p=>({url:p.startsWith('https:')?p:origin+p}));
 const cache={keys:async()=>requests,delete:async req=>{deleted.push(req.url);return true;}};
 vm.runInNewContext(read('retirement/sw.js'),{URL,TextEncoder,Uint8Array,crypto:webcrypto,caches:{keys:async()=>['townloop-cache-v3','townloop-pdf-cache-v1','other-cache'],open:async name=>{assert.equal(name,'townloop-cache-v3');return cache;}},self:{location:{origin},skipWaiting:async()=>{},clients:{claim:async()=>{claimed=true;}},registration:{unregister:async()=>{unregistered=true;}},addEventListener:(type,handler)=>{listeners[type]=handler;}}});
 assert.equal(listeners.fetch,undefined);let complete;listeners.activate({waitUntil:p=>{complete=p;}});await complete;
 assert.deepEqual(deleted,requests.slice(0,5).map(r=>r.url));assert(claimed&&unregistered);
});
