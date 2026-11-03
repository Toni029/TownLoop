/** Disposable local fixtures only. Exercises the real resume + REST implementation. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('../node_modules/typescript');
const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!/^127\.0\.0\.1:\d+$/.test(host || '')) throw Error('Local Firestore emulator required.');
const project = 'demo-townloop-news-resume';
const base = `http://${host}/v1/projects/${project}/databases/(default)/documents`;
function load(name, modules, fetcher) {
 const m = {exports: {}};
 const code = ts.transpileModule(fs.readFileSync(`native/src/news/${name}`, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText;
 new Function('require', 'module', 'exports', 'fetch', code)(id => modules[id], m, m.exports, fetcher);
 return m.exports;
}
function token(uid) {
 const enc = x => Buffer.from(JSON.stringify(x)).toString('base64url');
 const now = Math.floor(Date.now()/1000);
 return enc({alg:'none',typ:'JWT'})+'.'+enc({iss:`https://securetoken.google.com/${project}`,aud:project,sub:uid,user_id:uid,iat:now,exp:now+3600,auth_time:now,firebase:{sign_in_provider:'password'}})+'.';
}
(async () => {
 const rules = await fetch(`http://${host}/emulator/v1/projects/${project}:securityRules`, {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({rules:{files:[{name:'firestore.rules',content:fs.readFileSync('firestore.rules','utf8')}]}})});
 assert.equal(rules.ok, true, await rules.text());
 const n = value => ({integerValue:String(value)}), s = value => ({stringValue:value});
 async function seed(path, fields) {
  const response = await fetch(`${base}/${path}`, {method:'PATCH',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify({fields})});
  assert.equal(response.ok,true,await response.text());
 }
 for (const role of ['admin','vip','pending']) await seed(`users/${role}`,{role:s(role==='pending'?'resident':role),approved:{booleanValue:role!=='pending'}});
 await seed('newsletters/current',{id:s('active')});
 await seed('newsletters/retained',{id:s('retained'),uploadState:s('uploaded')});
 await seed('newsletters/retained/chunks/0',{index:n(0),totalChunks:n(1),totalSize:n(100),updatedAt:{timestampValue:'2026-11-03T19:00:00Z'}});
 for (const role of ['admin','vip','pending']) {
  const requests = [];
  const auth = {currentUser:{uid:role,getIdToken:async()=>token(role)}};
  const rest = load('firestorePdf.ts',{'../lib/firebase':{auth},'../../firebase-config.json':{projectId:project},'expo-crypto':{}},async(url, options)=>{
   const u = new URL(url); assert.equal(u.hostname,'firestore.googleapis.com');
   const response = await fetch(base+u.pathname.split('/documents')[1]+u.search,options);
   requests.push({path:u.pathname,status:response.status,query:u.search});
   return response;
  });
  const drafts = load('drafts.ts',{'./actions':{approvedUser:async()=>({id:role})},'./firestorePdf':rest,'./pdfTransfer':{PDF_PREFIX:'data:application/pdf;base64,',PDF_CHUNK_BYTES:480*1024}});
  if (role==='pending') {
   await assert.rejects(drafts.retainedEditions(),/not authorized/);
   assert.equal(requests.filter(r=>r.status===200).length,0);
  } else {
   assert.deepEqual((await drafts.retainedEditions()).map(r=>r.id),['retained']);
   assert.equal(requests[0].status,403);
   assert.match(requests[0].query,/showMissing=true/);
   assert.equal(requests[1].status,200);
   assert.doesNotMatch(requests[1].query,/showMissing/);
   assert.equal(requests[2].status,200);
  }
  console.log(`${role}: real resume authorization checks passed`);
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
