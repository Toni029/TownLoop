import {before,test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const host=process.env.FIRESTORE_EMULATOR_HOST;
if(!/^127\.0\.0\.1:\d+$/.test(host||''))throw Error('Disposable loopback emulator only.');
const project='demo-townloop-legacy-launch',base=`http://${host}`,root=`${base}/v1/projects/${project}/databases/(default)/documents`;
const owner={Authorization:'Bearer owner','Content-Type':'application/json'};
const profiles={Alice:{role:'resident',approved:true},Bob:{role:'resident',approved:true},Mallory:{role:'resident',approved:true},Crew:{role:'crew',approved:true},Crew2:{role:'crew',approved:true},Admin:{role:'admin',approved:true},Vip:{role:'vip',approved:true},Pending:{role:'resident',approved:false},Alias:{role:'staff',approved:true,isAdmin:true},Frozen:{role:'resident',approved:true,deletionPending:true},Revoked:{role:'resident',approved:true}};
const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
function token(uid){const now=Math.floor(Date.now()/1000);return `${encode({alg:'none',typ:'JWT'})}.${encode({aud:project,iss:`https://securetoken.google.com/${project}`,sub:uid,user_id:uid,email:`${uid}@example.invalid`,iat:now,exp:now+3600,firebase:{sign_in_provider:'custom'}})}.`;}
function value(x){if(x instanceof Date)return{timestampValue:x.toISOString()};if(x===null)return{nullValue:null};if(Array.isArray(x))return{arrayValue:{values:x.map(value)}};if(typeof x==='object')return{mapValue:{fields:fields(x)}};if(typeof x==='boolean')return{booleanValue:x};if(typeof x==='number')return{integerValue:String(x)};return{stringValue:x};}
function fields(x){return Object.fromEntries(Object.entries(x).map(([k,v])=>[k,value(v)]));}
async function req(path,{uid,data,admin=false,method='GET'}={}){const r=await fetch(`${root}/${path}`,{method,headers:admin?owner:{'Content-Type':'application/json',...(uid?{Authorization:'Bearer '+token(uid)}:{})},...(data===undefined?{}:{body:JSON.stringify({fields:fields(data)})})});return{status:r.status,body:await r.text()};}
const allow=async p=>{const r=await p;assert.ok(r.status>=200&&r.status<300,r.body);return r;};
const deny=async p=>{const r=await p;assert.equal(r.status,403,r.body);};
const seed=(p,d)=>allow(req(p,{admin:true,method:'PATCH',data:d}));
const write=(p,uid,d)=>req(p,{uid,method:'PATCH',data:d});
const read=(p,uid)=>req(p,{uid});
const profile=uid=>({id:uid,name:uid,email:`${uid}@example.invalid`,...profiles[uid]});
const message=(uid,id='initial',body='Synthetic private message')=>({id,senderId:uid,senderName:uid,senderRole:profiles[uid].role,senderAvatar:'',body,createdAt:1,time:'Now'});
const chats={resident_chats:{participantIds:['Alice','Bob'],identityVersion:2},office_chats:{residentId:'Alice'},maintenance_chats:{residentId:'Alice'},marketplace_chats:{sellerId:'Alice',buyerId:'Bob',participantIds:['Alice','Bob']}};
const identity=(source,data)=>source==='resident_chats'?{participantIds:data.participantIds}:source==='marketplace_chats'?{sellerId:data.sellerId,buyerId:data.buyerId}:{residentId:data.residentId};
const authorization=(source,id,data,members)=>({source,recordId:id,identity:identity(source,data),memberIds:members,epoch:data.authorizationEpoch||'fixture-v1',status:'verified',reviewedBy:'Admin',reviewedAt:new Date('2026-11-05'),evidenceReference:'synthetic-only',historicalMessageIds:(data.messages||[]).map(m=>m.id),historyLength:(data.messages||[]).length});
const authPath=(source,id)=>`legacy_record_authorizations/${source}/records/${id}`;
before(async()=>{
 const content=await readFile(process.env.LEGACY_LAUNCH_RULES||new URL('./firestore.named.rules',import.meta.url),'utf8');
 const r=await fetch(`${base}/emulator/v1/projects/${project}:securityRules`,{method:'PUT',headers:owner,body:JSON.stringify({rules:{files:[{name:'firestore.rules',content}]}})});assert.equal(r.status,200,await r.text());
 await fetch(`${base}/emulator/v1/projects/${project}/databases/(default)/documents`,{method:'DELETE',headers:owner});
 for(const uid of Object.keys(profiles))await seed('users/'+uid,profile(uid));
 await seed('account_access_revocations/Revoked',{uid:'Revoked'});
 await seed('resident_directory/Alice',{id:'Alice',name:'Alice',role:'resident'});
 for(const[source,extra]of Object.entries(chats)){
  const data={id:'verified',authorizationEpoch:'fixture-v1',...extra,messages:[message('Alice')],lastMessage:'Synthetic private message',updatedAt:1,subject:'Fixture',readBy:{},hiddenBy:{}};
  await seed(`${source}/verified`,data);
  await seed(authPath(source,'verified'),authorization(source,'verified',data,source==='office_chats'?['Alice','Admin','Vip']:source==='maintenance_chats'?['Alice','Crew']:['Alice','Bob']));
  await seed(`${source}/unverified`,{...data,id:'unverified',participantIds:['Mallory','Alice'],residentId:'Mallory',sellerId:'Mallory'});
 }
 const order={userId:'Alice',title:'Synthetic request',status:'Queued',comments:[],createdAt:new Date('2026-11-05')};
 await seed('work_orders/verified',order);
 await seed(authPath('work_orders','verified'),{source:'work_orders',recordId:'verified',identity:{userId:'Alice'},ownerId:'Alice',status:'verified',reviewedBy:'Admin',reviewedAt:new Date('2026-11-05'),evidenceReference:'synthetic-only'});
});
test('pending signup gets own profile only; full profiles and directory require appropriate approval',async()=>{
 await allow(read('users/Pending','Pending'));await allow(read('users/Alice','Alice'));await deny(read('users','Alice'));
 for(const uid of ['Bob','Crew','Pending','Alias',undefined]){await deny(read('users/Alice',uid));await deny(read('users',uid));}
 for(const uid of ['Admin','Vip']){await allow(read('users/Alice',uid));await allow(read('users',uid));}
 for(const uid of ['Alice','Crew','Admin','Vip'])await allow(read('resident_directory/Alice',uid));
 for(const uid of ['Pending','Alias','Frozen','Revoked',undefined])await deny(read('resident_directory/Alice',uid));
});
test('profile access fields, identity and deletion fences cannot be self-assigned or manager-cleared',async()=>{
 await allow(write('users/Alice','Alice',{...profile('Alice'),name:'Updated'}));await seed('users/Alice',profile('Alice'));
 for(const patch of [{role:'admin'},{approved:true,isAdmin:true},{email:'other@example.invalid'},{deletionPending:false,isVip:true}])await deny(write('users/Alice','Alice',{...profile('Alice'),...patch}));
 for(const uid of ['Admin','Vip']){await allow(write('users/Pending',uid,{...profile('Pending'),role:'resident',approved:true}));await seed('users/Pending',profile('Pending'));await deny(write('users/Frozen',uid,{...profile('Frozen'),deletionPending:false}));}
 for(const uid of ['Crew','Alice','Pending','Alias'])await deny(write('users/Pending',uid,{...profile('Pending'),approved:true}));
 for(const uid of ['Frozen','Revoked'])await deny(write('users/'+uid,uid,{...profile(uid),name:'Changed'}));
 await deny(write('users/Admin','Admin',{...profile('Admin'),role:'vip'}));
});
test('signup permits only own unapproved legacy-empty or resident role and never privilege flags',async()=>{
 for(const [uid,role]of [['NewLegacy',''],['NewCurrent','resident']])await allow(write('users/'+uid,uid,{id:uid,name:uid,email:`${uid}@example.invalid`,role,approved:false}));
 for(const [uid,patch]of [['NewAdmin',{role:'admin'}],['NewApproved',{approved:true}],['NewFlag',{isAdmin:true}],['NewFence',{deletionPending:false}]])await deny(write('users/'+uid,uid,{id:uid,name:uid,email:`${uid}@example.invalid`,role:'resident',approved:false,...patch}));
});
test('each chat type requires independent attestation; forged historical identity and client verification markers never grant access',async()=>{
 for(const source of Object.keys(chats)){
  for(const uid of ['Alice','Mallory','Crew','Admin','Vip','Pending','Frozen','Revoked',undefined])await deny(read(`${source}/unverified`,uid));
  for(const uid of ['Alice','Mallory','Crew','Admin','Vip']){await deny(write(authPath(source,'unverified'),uid,authorization(source,'unverified',chats[source],[uid])));await deny(write(`${source}/unverified`,uid,{...chats[source],verified:true}));await deny(req(`${source}/verified`,{uid,method:'DELETE'}));}
  await deny(read(authPath(source,'verified'),'Admin'));
 }
});
test('attested private and Marketplace history is participant-only including against Admin/VIP; service history excludes unassigned staff',async()=>{
 for(const source of ['resident_chats','marketplace_chats']){for(const uid of ['Alice','Bob'])await allow(read(`${source}/verified`,uid));for(const uid of ['Mallory','Crew','Admin','Vip','Pending','Alias','Frozen','Revoked',undefined])await deny(read(`${source}/verified`,uid));}
 for(const[source,yes,no]of [['office_chats',['Alice','Admin','Vip'],['Bob','Mallory','Crew','Pending']],['maintenance_chats',['Alice','Crew'],['Crew2','Bob','Mallory','Admin','Vip','Pending']]]){for(const uid of yes)await allow(read(`${source}/verified`,uid));for(const uid of no)await deny(read(`${source}/verified`,uid));}
 for(const source of Object.keys(chats))await deny(read(source,'Admin'));
});
test('only canonical actor can append one immutable message; own cursor cannot alter other readers, identities or history',async()=>{
 for(const[source,actor]of [['resident_chats','Bob'],['office_chats','Vip'],['maintenance_chats','Crew'],['marketplace_chats','Bob']]){
  const old=JSON.parse((await allow(read(`${source}/verified`,'Alice'))).body),decode=v=>v.mapValue?Object.fromEntries(Object.entries(v.mapValue.fields||{}).map(([k,x])=>[k,decode(x)])):v.arrayValue?(v.arrayValue.values||[]).map(decode):v.integerValue!==undefined?Number(v.integerValue):v.booleanValue!==undefined?v.booleanValue:v.stringValue;
  const data=Object.fromEntries(Object.entries(old.fields).map(([k,v])=>[k,decode(v)]));
  const added={...message(actor,`legacy_fixture-v1_${actor}_1`,'Real reply'),operationId:'reply-op'};if(source==='marketplace_chats'){added.text=added.body;delete added.body;}
  const next={...data,messages:[...data.messages,added],lastMessage:'Real reply',updatedAt:1};
  await allow(write(`${source}/verified`,actor,next));
  await deny(write(`${source}/verified`,actor,{...next,messages:[message(actor,'replace','Forged history')]}));
  await deny(write(`${source}/verified`,actor,{...next,messages:[...next.messages,{...added,id:`legacy_fixture-v1_${actor}_2`,operationId:'spoof-op',senderId:'Alice'}]}));
  await deny(write(`${source}/verified`,actor,{...next,messages:[...next.messages,{...added,id:`legacy_fixture-v1_${actor}_2`,operationId:'role-op',senderRole:'forged'}]}));
  await deny(write(`${source}/verified`,actor,{...next,messages:[...next.messages,{...added,operationId:'duplicate-id-op'}]}));
  await deny(write(`${source}/verified`,actor,{...next,unreadBy:['Alice']}));
  await deny(write(`${source}/verified`,actor,{...next,participantIds:['Mallory',actor],residentId:'Mallory'}));
  await allow(write(`${source}/verified`,actor,{...next,readBy:{[actor]:2}}));
  await deny(write(`${source}/verified`,actor,{...next,readBy:{Alice:2}}));
 }
});
test('attestation binds existing identity and live role/leave state, rather than trusting a tampered historical UID',async()=>{
 const data={id:'tampered',residentId:'Mallory',messages:[message('Alice')],subject:'Fixture',lastMessage:'Synthetic private message',updatedAt:1};
 await seed('office_chats/tampered',data);await seed(authPath('office_chats','tampered'),authorization('office_chats','tampered',{residentId:'Alice'},['Alice','Admin']));
 for(const uid of ['Alice','Mallory','Admin'])await deny(read('office_chats/tampered',uid));
 await seed('users/Crew',{...profile('Crew'),role:'resident'});await deny(read('maintenance_chats/verified','Crew'));await seed('users/Crew',profile('Crew'));
 const office={id:'left',residentId:'Alice',messages:[],leftBy:{Alice:true}};await seed('office_chats/left',office);await seed(authPath('office_chats','left'),authorization('office_chats','left',office,['Alice','Admin']));await deny(read('office_chats/left','Alice'));
});
test('work orders require verified owner identity; unrelated residents and pending accounts cannot read; histories and owners are immutable',async()=>{
 for(const uid of ['Alice','Crew','Crew2','Admin','Vip'])await allow(read('work_orders/verified',uid));
 for(const uid of ['Bob','Mallory','Pending','Alias','Frozen','Revoked',undefined])await deny(read('work_orders/verified',uid));
 await seed('work_orders/unverified',{userId:'Mallory',status:'Queued',comments:[]});for(const uid of ['Mallory','Crew','Admin'])await deny(read('work_orders/unverified',uid));
 const order={userId:'Alice',title:'Synthetic request',status:'Queued',comments:[],createdAt:new Date('2026-11-05')};
 await allow(write('work_orders/verified','Alice',{...order,title:'Updated request'}));
 for(const uid of ['Alice','Crew','Admin','Vip']){await deny(write('work_orders/verified',uid,{...order,userId:'Mallory'}));await deny(write('work_orders/verified',uid,{...order,comments:[{authorId:'Alice',text:'forged'}]}));await deny(req('work_orders/verified',{uid,method:'DELETE'}));}
 await allow(write('work_orders/verified','Crew',{...order,status:'In Progress'}));
 await deny(write('work_orders/verified','Alice',{...order,status:'Done'}));
 await seed('work_orders/tampered',{...order,userId:'Mallory'});await seed(authPath('work_orders','tampered'),{source:'work_orders',recordId:'tampered',status:'verified',identity:{userId:'Alice'},ownerId:'Alice'});await deny(read('work_orders/tampered','Mallory'));
});
test('content-free mailboxes and public projection are server-only and scoped to the approved owner',async()=>{
 await seed('legacy_private_mailboxes/Alice/records/office_verified',{source:'office_chats',recordId:'verified'});
 await allow(read('legacy_private_mailboxes/Alice/records','Alice'));
 for(const uid of ['Bob','Crew','Admin','Vip','Pending',undefined])await deny(read('legacy_private_mailboxes/Alice/records',uid));
 for(const uid of ['Alice','Crew','Admin','Vip']){await deny(write('legacy_private_mailboxes/Alice/records/forged',uid,{source:'office_chats',recordId:'unverified'}));await deny(write('resident_directory/forged',uid,{id:'forged',phone:'not-public'}));}
 const data={residentId:'Alice',messages:[]};await seed('office_chats/namespace',data);
 await seed(authPath('office_chats','namespace'),{...authorization('office_chats','namespace',data,['Alice','Admin']),source:'maintenance_chats'});
 await deny(read('office_chats/namespace','Alice'));await deny(read('office_chats/namespace','Admin'));
 const collision={authorizationEpoch:'fixture-v1',participantIds:['Alice','Bob'],messages:[message('Alice','legacy_fixture-v1_Alice_1')],subject:'Held collision',lastMessage:'Synthetic private message',updatedAt:1};
 await seed('resident_chats/collision',collision);await seed(authPath('resident_chats','collision'),authorization('resident_chats','collision',collision,['Alice','Bob']));
 await deny(write('resident_chats/collision','Alice',{...collision,messages:[...collision.messages,{...message('Alice','legacy_fixture-v1_Alice_1','New reply'),operationId:'new-op'}],lastMessage:'New reply'}));
});
test('privileged history rewrite contract freezes the grant and requires a fresh reviewed epoch before resuming',async()=>{
 const source='resident_chats',id='rewrite-fixture',original={authorizationEpoch:'old-epoch',participantIds:['Alice','Bob'],messages:[message('Alice','historical')],lastMessage:'Synthetic private message',updatedAt:1};
 await seed(`${source}/${id}`,original);await seed(authPath(source,id),authorization(source,id,original,['Alice','Bob']));
 const sent={...original,messages:[...original.messages,{...message('Bob','legacy_old-epoch_Bob_1','Before rewrite'),operationId:'before'}],lastMessage:'Before rewrite'};
 await allow(write(`${source}/${id}`,'Bob',sent));
 await seed(authPath(source,id),{...authorization(source,id,original,['Alice','Bob']),status:'rewrite_hold'});
 const rewritten={...original,authorizationEpoch:'new-epoch',messages:[]};await seed(`${source}/${id}`,rewritten);
 for(const uid of ['Alice','Bob']){await deny(read(`${source}/${id}`,uid));await deny(write(`${source}/${id}`,uid,{...rewritten,messages:[{...message(uid,`legacy_new-epoch_${uid}_0`),operationId:'held'}]}));}
 // Simulates an independent server review; current deletion workers do NOT implement this contract.
 await seed(authPath(source,id),authorization(source,id,rewritten,['Alice','Bob']));
 await allow(read(`${source}/${id}`,'Bob'));
 const reply={...message('Bob','legacy_new-epoch_Bob_0','After independent review'),operationId:'after'};
 await allow(write(`${source}/${id}`,'Bob',{...rewritten,messages:[reply],lastMessage:reply.body}));
});
test('legacy service side-left flags revoke the departed side only and cannot be cleared by clients',async()=>{
 for(const[source,staff]of [['office_chats','Admin'],['maintenance_chats','Crew']])for(const side of ['resident','team']){
  const id=`left-${side}`,data={authorizationEpoch:'fixture-v1',residentId:'Alice',messages:[],sideLeft:{[side]:true}};
  await seed(`${source}/${id}`,data);await seed(authPath(source,id),authorization(source,id,data,['Alice',staff]));
  await deny(read(`${source}/${id}`,side==='resident'?'Alice':staff));
  await allow(read(`${source}/${id}`,side==='resident'?staff:'Alice'));
  for(const uid of ['Alice',staff])await deny(write(`${source}/${id}`,uid,{...data,sideLeft:{resident:false,team:false}}));
 }
});
test('reviewed Work Order completion keeps canonical Crew resolution and server timestamps',async()=>{
 const note={id:'resolution',authorId:'Crew',author:'Crew',role:'Maintenance Crew',kind:'resolution',text:'Fixed fixture',timestamp:'Now',photoUrl:''};
 const done={userId:'Alice',title:'Synthetic request',status:'Done',comments:[note],createdAt:new Date('2026-11-05'),completedBy:'Crew',retentionVersion:1,resolutionNote:'Fixed fixture',resolutionCommentId:'resolution',resolutionCommentIndex:0,resolutionAuthorId:'Crew'};
 async function complete(uid,data){const r=await fetch(`${root}:commit`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token(uid)},body:JSON.stringify({writes:[{update:{name:`projects/${project}/databases/(default)/documents/work_orders/verified`,fields:fields(data)},updateTransforms:[{fieldPath:'completedAt',setToServerValue:'REQUEST_TIME'},{fieldPath:'updatedAt',setToServerValue:'REQUEST_TIME'}]}]})});return{status:r.status,body:await r.text()};}
 for(const uid of ['Alice','Admin','Vip','Pending'])await deny(complete(uid,done));
 await deny(complete('Crew',{...done,comments:[{...note,authorId:'Alice'}]}));
 await allow(complete('Crew',done));
});
test('deletion revocations remain hidden/server-only and block a previously attested member immediately',async()=>{
 await seed('account_access_revocations/Alice',{uid:'Alice'});
 for(const path of ['users/Alice','office_chats/verified','resident_chats/verified','marketplace_chats/verified','work_orders/verified'])await deny(read(path,'Alice'));
 for(const uid of ['Alice','Admin','Vip'])for(const method of ['GET','PATCH','DELETE'])await deny(req('account_access_revocations/Alice',{uid,method,...(method==='PATCH'?{data:{uid:'Alice'}}:{})}));
});
