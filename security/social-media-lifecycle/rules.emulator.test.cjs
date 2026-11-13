'use strict';
const {before,test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {guard}=require('./prepare-rules.cjs');
const host=process.env.FIRESTORE_EMULATOR_HOST,project='demo-townloop-social-rules';
if(!/^127\.0\.0\.1:\d+$/.test(host||''))throw Error('Explicit loopback emulator required');
const token=uid=>{const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url'),now=Math.floor(Date.now()/1000);return `${enc({alg:'none',typ:'JWT'})}.${enc({iss:`https://securetoken.google.com/${project}`,aud:project,sub:uid,user_id:uid,iat:now,exp:now+3600,email:`${uid}@example.invalid`,firebase:{sign_in_provider:'custom'}})}.`;};
function val(x){return typeof x==='boolean'?{booleanValue:x}:{stringValue:x};}
async function request(path,{uid='resident',admin=false,method='GET',data}={}){return fetch(`http://${host}/v1/projects/${project}/databases/(default)/documents/${path}`,{method,headers:{Authorization:`Bearer ${admin?'owner':token(uid)}`,'Content-Type':'application/json'},...(data?{body:JSON.stringify({fields:Object.fromEntries(Object.entries(data).map(([k,v])=>[k,val(v)]))})}:{})});}
async function seed(path,data){const r=await request(path,{admin:true,method:'PATCH',data});assert.equal(r.status,200,await r.text());}
before(async()=>{
 const baseline=fs.readFileSync(require('node:path').join(__dirname,'../../firestore.rules'),'utf8'),rules=guard(baseline);
 assert.equal(rules,fs.readFileSync(require('node:path').join(__dirname,'firestore.candidate.rules'),'utf8'));
 const result=await fetch(`http://${host}/emulator/v1/projects/${project}:securityRules`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({rules:{files:[{name:'firestore.rules',content:rules}]}})});
 assert.equal(result.status,200,await result.text());
 for(const role of ['resident','admin','vip'])await seed(`users/${role}`,{role,approved:true});
});
test('owner Admin and VIP retain deletion authorization; blocked fence denies writes while reads continue',async()=>{
 for(const collection of ['marketplace_posts','discussion_feed'])for(const uid of ['resident','admin','vip']){
  const path=`${collection}/${uid}`;await seed(path,{userId:'resident',storageDraft:false,title:'Synthetic'});
  assert.equal((await request(path,{uid,method:'DELETE'})).status,200);
  await seed(path,{userId:'resident',storageDraft:false,title:'Synthetic'});await seed('social_media_control/active',{blocked:true});
  assert.equal((await request(path,{uid,method:'DELETE'})).status,403);
  assert.equal((await request(path,{uid})).status,200);
  await seed('social_media_control/active',{blocked:false});
 }
});
test('clients cannot read or alter server-only jobs, attempts or control state',async()=>{
 for(const collection of ['social_media_control','social_media_jobs','social_media_deletion_attempts'])for(const uid of ['resident','admin','vip']){
  const path=`${collection}/a`;await seed(path,{blocked:false});
  assert.equal((await request(path,{uid})).status,403);
  assert.equal((await request(path,{uid,method:'PATCH',data:{blocked:false}})).status,403);
 }
});
test('every candidate mutation is fenced and all baseline read predicates preserved',()=>{
 const source=fs.readFileSync(require('node:path').join(__dirname,'../../firestore.rules'),'utf8'),candidate=guard(source);
 const declarations=s=>[...s.matchAll(/allow\s+([a-z,\s]+):\s*if\s+([^;]+);/g)];
 const readPredicates=s=>declarations(s).flatMap(m=>{const reads=m[1].split(',').map(x=>x.trim()).filter(x=>['read','get','list'].includes(x));return reads.length?[[reads.join(','),m[2]]]:[];});
 assert.deepEqual(readPredicates(candidate).slice(3),readPredicates(source));
 for(const rule of declarations(candidate))if(rule[1].split(',').some(op=>['write','create','update','delete'].includes(op.trim()))&&!/false\s*$/.test(rule[2]))assert.match(rule[2],/^socialMediaWriteAllowed\(\) && /);
});
