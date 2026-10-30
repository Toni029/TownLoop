import {before,test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const host=process.env.FIRESTORE_EMULATOR_HOST||'127.0.0.1:8898';
if(!/^(127\.0\.0\.1|localhost):\d+$/.test(host))throw Error('Loopback emulator required');
const base='http://'+host,owner={Authorization:'Bearer owner','Content-Type':'application/json'};
const value=v=>v===null?{nullValue:null}:Array.isArray(v)?{arrayValue:{values:v.map(value)}}:typeof v==='object'?{mapValue:{fields:fields(v)}}:typeof v==='boolean'?{booleanValue:v}:typeof v==='number'?{integerValue:String(v)}:{stringValue:v};
const fields=d=>Object.fromEntries(Object.entries(d).map(([k,v])=>[k,value(v)]));
const token=(project,uid)=>{const b=v=>Buffer.from(JSON.stringify(v)).toString('base64url'),now=Math.floor(Date.now()/1000);return b({alg:'none',typ:'JWT'})+'.'+b({iss:'https://securetoken.google.com/'+project,aud:project,sub:uid,user_id:uid,iat:now,exp:now+3600,auth_time:now,email:uid+'@example.invalid',firebase:{sign_in_provider:'custom'}})+'.';};
const projects=[['demo-townloop-deletion-native','./firestore.default.candidate.rules'],['demo-townloop-deletion-website','./firestore.website.candidate.rules']];
async function request(project,path,{uid,data,admin=false,method='GET'}={}){return fetch(`${base}/v1/projects/${project}/databases/(default)/documents/${path}`,{method,headers:admin?owner:{'Content-Type':'application/json',...(uid?{Authorization:'Bearer '+token(project,uid)}:{})},...(data?{body:JSON.stringify({fields:fields(data)})}:{})});}
async function seed(project,path,data){const r=await request(project,path,{method:'PATCH',data,admin:true});assert.equal(r.status,200,await r.text());}
before(async()=>{
 for(const [project,file]of projects){
  const content=await readFile(new URL(file,import.meta.url),'utf8');
  const r=await fetch(`${base}/emulator/v1/projects/${project}:securityRules`,{method:'PUT',headers:owner,body:JSON.stringify({rules:{files:[{name:'firestore.rules',content}]}})});assert.equal(r.status,200,await r.text());
  await fetch(`${base}/emulator/v1/projects/${project}/databases/(default)/documents`,{method:'DELETE',headers:owner});
  for(const uid of ['resident','fenced','pending','admin','deleted'])await seed(project,'users/'+uid,{id:uid,name:uid,email:uid+'@example.invalid',role:uid==='admin'?'admin':'resident',approved:true,...(uid==='pending'?{deletionPending:true}:{})});
  for(const uid of ['fenced','deleted'])await seed(project,'account_access_revocations/'+uid,{uid,jobId:'fixture'});
  await request(project,'users/deleted',{admin:true,method:'DELETE'});
  if(project.endsWith('native')){await seed(project,'inbox_conversations/thread',{type:'private',memberRefs:{fenced:'fenced-member'},memberIds:['fenced','resident']});await seed(project,'inbox_memberships/fenced-member',{uid:'fenced',status:'active',epoch:1});}
  await seed(project,'discussion_feed/post',{userId:'resident',title:'Fixture',comments:[],likes:0});
 }
});
for(const [project]of projects){
 test(project+': deleting/fenced users cannot mutate their own profile or clear the deletion marker',async()=>{
  for(const uid of ['fenced','pending']){const r=await request(project,'users/'+uid,{uid,method:'PATCH',data:{id:uid,name:'Changed',email:uid+'@example.invalid',role:'resident',approved:true,deletionPending:false}});assert.equal(r.status,403,await r.text());}
 });
 test(project+': authenticated old session cannot recreate a profile after server erasure',async()=>{
  const r=await request(project,'users/deleted',{uid:'deleted',method:'PATCH',data:{id:'deleted',name:'Deleted',email:'deleted@example.invalid',role:project.endsWith('website')?'':'resident',approved:false,termsVersion:'2026-10-draft1'}});assert.equal(r.status,403,await r.text());
 });
 test(project+': fence is server-owned, hidden and blocks reads across Inbox paths',async()=>{
  for(const method of ['GET','PATCH','DELETE']){const r=await request(project,'account_access_revocations/fenced',{uid:'admin',method,...(method==='PATCH'?{data:{uid:'fenced'}}:{})});assert.equal(r.status,403,await r.text());}
  const blockedProfile=await request(project,'users/fenced',{uid:'admin',method:'PATCH',data:{id:'fenced',name:'Restore',email:'fenced@example.invalid',role:'resident',approved:true}});assert.equal(blockedProfile.status,403,await blockedProfile.text());
  if(project.endsWith('native')){for(const path of ['inbox_conversations/thread','inbox_memberships/fenced-member']){const response=await request(project,path,{uid:'fenced'});assert.equal(response.status,403,await response.text());}}
  const r=await request(project,'office_chats/anything',{uid:'fenced'});assert.equal(r.status,403,await r.text());
 });
 test(project+': legitimate account access and self-profile changes remain available',async()=>{
  const r=await request(project,'users/resident',{uid:'resident'});assert.equal(r.status,200,await r.text());
  const data={id:'resident',name:'Updated',email:'resident@example.invalid',role:'resident',approved:true};
  const changed=await request(project,'users/resident',{uid:'resident',method:'PATCH',data});assert.equal(changed.status,200,await changed.text());
 });
}
test('website: anonymous chat and social writes are denied on every formerly public path',async()=>{
 const p=projects[1][0];
 for(const c of ['office_chats','maintenance_chats','resident_chats','marketplace_chats']){const r=await request(p,c+'/anonymous',{method:'PATCH',data:{messages:[]}});assert.equal(r.status,403,await r.text());}
 const r=await request(p,'discussion_feed/post',{method:'PATCH',data:{userId:'resident',title:'Fixture',comments:[{text:'unauthenticated'}],likes:0}});assert.equal(r.status,403,await r.text());
});
test('website: approved accounts can continue ordinary chat writes; pending and revoked accounts cannot',async()=>{
 const p=projects[1][0];for(const c of ['office_chats','maintenance_chats','resident_chats','marketplace_chats']){
  const r=await request(p,c+'/valid',{uid:'resident',method:'PATCH',data:{residentId:'resident',messages:[]}});assert.equal(r.status,200,await r.text());
  for(const uid of ['pending','fenced']){const denied=await request(p,c+'/blocked-'+uid,{uid,method:'PATCH',data:{messages:[]}});assert.equal(denied.status,403,await denied.text());}
 }
});
