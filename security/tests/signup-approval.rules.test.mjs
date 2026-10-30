// Disposable emulator only. Set TOWNLOOP_SIGNUP_RULES to a read-only deployed-rule snapshot to verify live policy.
import {before,test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const host=process.env.FIRESTORE_EMULATOR_HOST;
if(!/^127\.0\.0\.1:\d+$/.test(host||''))throw Error('Loopback Firestore emulator required.');
const project='demo-townloop-signup-approval',base=`http://${host}`,documents=`${base}/v1/projects/${project}/databases/(default)/documents`;
const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const token=uid=>{const now=Math.floor(Date.now()/1000);return `${encode({alg:'none',typ:'JWT'})}.${encode({aud:project,iss:`https://securetoken.google.com/${project}`,sub:uid,user_id:uid,iat:now,exp:now+3600,auth_time:now,firebase:{sign_in_provider:'custom'}})}.`;};
const fields=d=>Object.fromEntries(Object.entries(d).map(([k,v])=>[k,typeof v==='boolean'?{booleanValue:v}:{stringValue:v}]));
async function seed(path,data){const r=await fetch(`${documents}/${path}`,{method:'PATCH',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify({fields:fields(data)})});assert.equal(r.status,200,await r.text());}
async function approve(uid,target){return fetch(`${documents}/users/${target}?updateMask.fieldPaths=approved`,{method:'PATCH',headers:{Authorization:`Bearer ${token(uid)}`,'Content-Type':'application/json'},body:JSON.stringify({fields:{approved:{booleanValue:true}}})});}
before(async()=>{
 const rules=await readFile(process.env.TOWNLOOP_SIGNUP_RULES||new URL('../account-deletion/firestore.default.candidate.rules',import.meta.url),'utf8');
 const r=await fetch(`${base}/emulator/v1/projects/${project}:securityRules`,{method:'PUT',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify({rules:{files:[{name:'firestore.rules',content:rules}]}})});assert.equal(r.status,200,await r.text());
 await fetch(`${base}/emulator/v1/projects/${project}/databases/(default)/documents`,{method:'DELETE',headers:{Authorization:'Bearer owner'}});
 for(const role of ['admin','vip','resident','crew'])await seed(`users/${role}`,{id:role,email:`${role}@example.invalid`,name:role,role,approved:true});
 await seed('users/pending-admin',{id:'pending-admin',email:'pending@example.invalid',role:'admin',approved:false});
});
test('deployed policy grants approved Admin and VIP normal signup approval; denies Resident, Crew and unapproved staff',async()=>{
 for(const role of ['admin','vip','resident','crew','pending-admin']){
  const id=`signup-${role}`;await seed(`users/${id}`,{id,email:`${id}@example.invalid`,role:'resident',approved:false});
  const r=await approve(role,id);assert.equal(r.status,['admin','vip'].includes(role)?200:403,await r.text());
 }
});
test('Admin and VIP cannot resurrect a deletion-frozen or revoked resident',async()=>{
 for(const role of ['admin','vip'])for(const state of ['deleting','revoked']){
  const id=`${state}-${role}`;await seed(`users/${id}`,{id,email:`${id}@example.invalid`,role:'resident',approved:false,...(state==='deleting'?{deletionPending:true}:{})});
  if(state==='revoked')await seed(`account_access_revocations/${id}`,{uid:id});
  const r=await approve(role,id);assert.equal(r.status,403,await r.text());
 }
});
