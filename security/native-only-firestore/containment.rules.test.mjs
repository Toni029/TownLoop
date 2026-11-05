// Synthetic loopback emulator only. No live Firebase accounts or resident records.
import {before,test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const host=process.env.FIRESTORE_EMULATOR_HOST;
if(!/^127\.0\.0\.1:\d+$/.test(host||''))throw Error('Explicit loopback emulator required.');
const base=`http://${host}`,legacy='demo-townloop-retired-named',native='demo-townloop-retained-native';
const roles={Resident:'resident',Peer:'resident',Crew:'crew',Admin:'admin',Vip:'vip',Pending:'resident'};
const principals=[undefined,'Pending','Resident','Crew','Admin','Vip'];
const paths=['users/Resident','resident_directory/Resident','resident_chats/chat','office_chats/chat','maintenance_chats/chat','marketplace_chats/chat','work_orders/order','inbox_conversations/group/messages/old','unknown/private/records/nested'];
const b=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const token=(project,uid)=>{const now=Math.floor(Date.now()/1000);return `${b({alg:'none',typ:'JWT'})}.${b({iss:`https://securetoken.google.com/${project}`,aud:project,sub:uid,user_id:uid,email:`${uid}@example.invalid`,iat:now,exp:now+3600,firebase:{sign_in_provider:'custom'}})}.`;};
const value=x=>Array.isArray(x)?{arrayValue:{values:x.map(value)}}:x&&typeof x==='object'?{mapValue:{fields:fields(x)}}:typeof x==='boolean'?{booleanValue:x}:typeof x==='number'?{integerValue:String(x)}:{stringValue:x};
const fields=x=>Object.fromEntries(Object.entries(x).map(([k,v])=>[k,value(v)]));
async function req(project,p,{uid,owner=false,method='GET',data}={}){
 const response=await fetch(`${base}/v1/projects/${project}/databases/(default)/documents/${p}`,{method,headers:{'Content-Type':'application/json',...(owner?{Authorization:'Bearer owner'}:uid?{Authorization:`Bearer ${token(project,uid)}`}:{})},...(data?{body:JSON.stringify({fields:fields(data)})}:{})});
 return {status:response.status,body:await response.text()};
}
async function allow(result){const r=await result;assert.ok(r.status>=200&&r.status<300,r.body);return r;}
async function deny(result){const r=await result;assert.equal(r.status,403,r.body);}
const seed=(project,p,data)=>allow(req(project,p,{owner:true,method:'PATCH',data}));
before(async()=>{
 for(const[project,file]of [[legacy,process.env.CONTAINMENT_RULES||new URL('./firestore.named.rules',import.meta.url)],[native,new URL('../account-deletion/firestore.default.candidate.rules',import.meta.url)]]){
  const content=await readFile(file,'utf8');
  const response=await fetch(`${base}/emulator/v1/projects/${project}:securityRules`,{method:'PUT',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify({rules:{files:[{name:'firestore.rules',content}]}})});
  assert.equal(response.status,200,await response.text());
  for(const[uid,role]of Object.entries(roles))await seed(project,`users/${uid}`,{id:uid,name:uid,email:`${uid}@example.invalid`,role,approved:uid!=='Pending'});
 }
 for(const p of paths.filter(p=>!p.startsWith('users/')))await seed(legacy,p,{userId:'Resident',residentId:'Resident',participantIds:['Resident','Peer'],messages:[],body:'Synthetic retained history'});
 for(const p of ['discussion_feed/post','marketplace_posts/listing','work_orders/order','community_events/event','community_highlights/story','newsletters/current'])await seed(native,p,{userId:'Resident',storageDraft:false,status:'Queued',title:'Synthetic',comments:[],likes:0});
 await seed(native,'resident_directory/Resident',{id:'Resident',name:'Resident',role:'resident',approved:true});
 await seed(native,'resident_chats/chat',{identityVersion:2,participantIds:['Resident','Peer'],participants:[{id:'Resident'},{id:'Peer'}],messages:[],subject:'Synthetic',lastMessage:'',updatedAt:1,unreadBy:[]});
 await seed(native,'inbox_conversations/group',{type:'office',residentId:'Resident',memberRefs:{Resident:'resident-membership',Admin:'admin-membership'},memberIds:['Resident','Admin']});
 await seed(native,'inbox_memberships/resident-membership',{uid:'Resident',status:'active',epoch:2});
 await seed(native,'inbox_memberships/admin-membership',{uid:'Admin',status:'active',epoch:1});
 await seed(native,'inbox_conversations/group/messages/old',{body:'Earlier synthetic history',visibility:['Admin:1']});
 await seed(native,'inbox_conversations/group/messages/new',{body:'Current synthetic history',visibility:['Resident:2','Admin:1']});
});
test('retired named database denies every client role, pending and anonymous reads including own profiles and nested records',async()=>{
 for(const uid of principals)for(const p of paths){await deny(req(legacy,p,{uid}));await deny(req(legacy,p.split('/').slice(0,-1).join('/'),{uid}));}
});
test('retired named database denies client create, replacement and deletion without changing historical bytes',async()=>{
 for(const uid of principals)for(const p of ['users/Resident','resident_chats/chat']){
  await deny(req(legacy,p,{uid,method:'PATCH',data:{name:'Forged',messages:[]}}));await deny(req(legacy,p,{uid,method:'DELETE'}));
 }
 await deny(req(legacy,'users/New',{uid:'Resident',method:'PATCH',data:{id:'New',approved:true,role:'admin'}}));
 const before=await allow(req(legacy,'resident_chats/chat',{owner:true}));assert.match(before.body,/Synthetic retained history/);
});
test('server bypass still reads and writes retained named data; this is emulator bypass proof, not live service IAM proof',async()=>{
 await seed(legacy,'account_access_revocations/synthetic',{uid:'synthetic',jobId:'synthetic'});
 await allow(req(legacy,'account_access_revocations/synthetic',{owner:true}));
 await allow(req(legacy,'account_access_revocations/synthetic',{owner:true,method:'DELETE'}));
});
test('unchanged default database retains native role reads and Admin/VIP approval',async()=>{
 for(const uid of ['Resident','Crew','Admin','Vip'])for(const p of [`users/${uid}`,'resident_directory/Resident','discussion_feed/post','marketplace_posts/listing','work_orders/order','community_events/event','community_highlights/story','newsletters/current'])await allow(req(native,p,{uid}));
 for(const uid of ['Admin','Vip']){await seed(native,'users/Pending',{id:'Pending',name:'Pending',email:'Pending@example.invalid',role:'resident',approved:false});await allow(req(native,'users/Pending',{uid,method:'PATCH',data:{id:'Pending',name:'Pending',email:'Pending@example.invalid',role:'resident',approved:true}}));}
 await seed(native,'users/Pending',{id:'Pending',name:'Pending',email:'Pending@example.invalid',role:'resident',approved:false});
});
test('unchanged native Inbox preserves own history, membership epochs, departed revocation and pending denial',async()=>{
 await allow(req(native,'resident_chats/chat',{uid:'Resident'}));await allow(req(native,'inbox_conversations/group/messages/new',{uid:'Resident'}));await allow(req(native,'inbox_conversations/group/messages/old',{uid:'Admin'}));
 await deny(req(native,'inbox_conversations/group/messages/old',{uid:'Resident'}));await deny(req(native,'resident_chats/chat',{uid:'Crew'}));await deny(req(native,'users/Resident',{uid:'Pending'}));
 await seed(native,'inbox_memberships/resident-membership',{uid:'Resident',status:'left',epoch:2});await deny(req(native,'inbox_conversations/group/messages/new',{uid:'Resident'}));
 await allow(req(native,'inbox_conversations/group/messages/new',{uid:'Admin'}));
});
