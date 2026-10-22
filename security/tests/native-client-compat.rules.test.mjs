// Local emulator only. Reproduces the deployed-client query shapes; creates no Auth accounts.
import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const host=process.env.FIRESTORE_EMULATOR_HOST||'127.0.0.1:8898';
if(!/^(127\.0\.0\.1|localhost):\d+$/.test(host))throw Error('Loopback emulator required');
const project='demo-townloop-client-compat',root=`http://${host}`,base=`${root}/v1/projects/${project}/databases/(default)/documents`;
const roles=['admin','vip','crew','resident'];
const uid=role=>`${role}MixedCaseUid`;
function token(id){const b=x=>Buffer.from(JSON.stringify(x)).toString('base64url'),now=Math.floor(Date.now()/1000);return `${b({alg:'none',typ:'JWT'})}.${b({sub:id,user_id:id,aud:project,iss:`https://securetoken.google.com/${project}`,iat:now,exp:now+3600,email:`${id}@example.invalid`,firebase:{sign_in_provider:'custom'}})}.`;}
function val(x){if(Array.isArray(x))return{arrayValue:{values:x.map(val)}};if(x&&typeof x==='object')return{mapValue:{fields:fields(x)}};return typeof x==='boolean'?{booleanValue:x}:typeof x==='number'?{integerValue:String(x)}:{stringValue:x};}
function fields(x){return Object.fromEntries(Object.entries(x).map(([k,v])=>[k,val(v)]));}
async function request(url,{id,body,method='GET',owner=false}={}){const r=await fetch(url,{method,headers:{'Content-Type':'application/json',...(owner?{Authorization:'Bearer owner'}:id?{Authorization:`Bearer ${token(id)}`}:{})},...(body?{body:JSON.stringify(body)}:{})});return{status:r.status,body:await r.json()};}
const seed=(path,data)=>request(`${base}/${path}`,{method:'PATCH',owner:true,body:{fields:fields(data)}});
const q=(collection,id,filters=[])=>request(base+':runQuery',{id,method:'POST',body:{structuredQuery:{from:[{collectionId:collection}],...(filters.length?{where:filters.length===1?filters[0]:{compositeFilter:{op:'AND',filters}}}:{})}}});
const filter=(fieldPath,op,stringValue)=>({fieldFilter:{field:{fieldPath},op,value:typeof stringValue==='number'?{integerValue:String(stringValue)}:{stringValue}}});
before(async()=>{
 const content=await readFile(process.env.RULES_FILE||'security/release/firestore.client-compatibility.rules','utf8');
 const r=await request(`${root}/emulator/v1/projects/${project}:securityRules`,{method:'PUT',owner:true,body:{rules:{files:[{name:'firestore.rules',content}]}}});assert.equal(r.status,200);
 await request(`${root}/emulator/v1/projects/${project}/databases/(default)/documents`,{method:'DELETE',owner:true});
 for(const role of [...roles,'pending']){const id=uid(role);await seed('users/'+id,{id,name:'Synthetic '+role,email:`${id}@example.invalid`,role:role==='pending'?'resident':role,approved:role!=='pending'});await seed('resident_chats/'+role,{identityVersion:2,participantIds:[id,'PeerMixedCaseUid'],participants:[{id},{id:'PeerMixedCaseUid'}],messages:[],subject:'Synthetic',lastMessage:'',updatedAt:1,unreadBy:[]});}
 await seed('users/PeerMixedCaseUid',{id:'PeerMixedCaseUid',name:'Synthetic peer',email:'peer@example.invalid',role:'resident',approved:true});
 await seed('resident_directory/PeerMixedCaseUid',{uid:'PeerMixedCaseUid',name:'Synthetic peer',role:'resident',approved:true,avatarUrl:''});
 await seed('discussion_feed/post',{userId:uid('resident'),storageDraft:false,createdAt:1});
});
for(const role of roles)test(`${role}: approved deployed-client feed, directory and canonical Inbox queries work`,async()=>{
 const id=uid(role);const result=await Promise.all([q('discussion_feed',id),q('resident_directory',id),q('resident_chats',id,[filter('participantIds','ARRAY_CONTAINS',id),filter('identityVersion','EQUAL',2)])]);
 assert.deepEqual(result.map(x=>x.status),[200,200,200],`${role} sees permission-denied in directory/Inbox despite a valid canonical role`);
});
test('pending and unauthenticated users cannot read directory or Inbox',async()=>{
 for(const id of [undefined,uid('pending')]){assert.equal((await q('resident_directory',id)).status,403);assert.equal((await q('resident_chats',id,[filter('participantIds','ARRAY_CONTAINS',uid('pending')),filter('identityVersion','EQUAL',2)])).status,403);}
});
test('canonical membership never grants another resident access to a conversation',async()=>{
 assert.equal((await request(base+'/resident_chats/admin',{id:uid('resident')})).status,403);
});

test('Admin/VIP retain moderation access without elevating Crew/Resident',async()=>{
 for(const role of roles)assert.equal((await q('moderation_reports',uid(role))).status,['admin','vip'].includes(role)?200:403);
});
test('all approved roles may append their own messages and receipts, never edit history or impersonate',async()=>{
 for(const role of roles){
  const id=uid(role),url=base+'/resident_chats/'+role;
  const old=(await request(url,{id})).body.fields;
  const message={id:'message-'+role,senderId:id,senderName:'Synthetic '+role,senderRole:role,senderAvatar:'',body:'Synthetic message',createdAt:2,time:'Now'};
  const after={...old,messages:val([message]),lastMessage:val(message.body),updatedAt:val(2),unreadBy:val(['PeerMixedCaseUid'])};
  assert.equal((await request(url,{id,method:'PATCH',body:{fields:after}})).status,200);
  assert.equal((await request(url,{id,method:'PATCH',body:{fields:{...after,readBy:val({[id]:1})}}})).status,200);
  assert.equal((await request(url,{id,method:'PATCH',body:{fields:{...after,messages:val([{...message,body:'Changed history'}])}}})).status,403);
  assert.equal((await request(url,{id,method:'PATCH',body:{fields:{...after,messages:val([message,{...message,id:'forged',senderId:'PeerMixedCaseUid'}])}}})).status,403);
 }
});
test('profile edits remain bounded owner-only requests, not direct privilege changes',async()=>{
 for(const role of roles){const id=uid(role);const proposal={status:'pending',requestedBy:id,previous:{},changes:{phone:'Synthetic phone'}};
 const r=await request(base+':commit',{id,method:'POST',body:{writes:[{update:{name:`projects/${project}/databases/(default)/documents/users/${id}`,fields:{profileUpdateRequest:val(proposal)}},updateMask:{fieldPaths:['profileUpdateRequest']},updateTransforms:[{fieldPath:'profileUpdateRequest.requestedAt',setToServerValue:'REQUEST_TIME'}]}]}});
 assert.equal(r.status,200);}
 const id=uid('resident'),old=(await request(base+'/users/'+id,{id})).body.fields;
 assert.equal((await request(base+'/users/'+id,{id,method:'PATCH',body:{fields:{...old,role:val('admin')}}})).status,403);
});
