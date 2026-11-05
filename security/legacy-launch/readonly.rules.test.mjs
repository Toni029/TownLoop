import {before,test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const host=process.env.FIRESTORE_EMULATOR_HOST;
if(!/^127\.0\.0\.1:\d+$/.test(host||''))throw Error('Disposable loopback emulator only.');
const project='demo-townloop-legacy-launch-readonly',base=`http://${host}`,root=`${base}/v1/projects/${project}/databases/(default)/documents`;
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
 const content=await readFile(new URL('./firestore.named.readonly.rules',import.meta.url),'utf8');
 const r=await fetch(`${base}/emulator/v1/projects/${project}:securityRules`,{method:'PUT',headers:owner,body:JSON.stringify({rules:{files:[{name:'firestore.rules',content}]}})});assert.equal(r.status,200,await r.text());
 for(const uid of ['Alice','Bob','Crew','Admin','Vip','Pending'])await seed('users/'+uid,profile(uid));
 const data={authorizationEpoch:'fixture-v1',participantIds:['Alice','Bob'],messages:[message('Alice')],lastMessage:'Synthetic private message',updatedAt:1};
 await seed('resident_chats/verified',data);await seed(authPath('resident_chats','verified'),authorization('resident_chats','verified',data,['Alice','Bob']));
});
test('secure fallback preserves attested participant/owner reads while denying all client mutation and broad/private access',async()=>{
 await allow(read('users/Pending','Pending'));await allow(read('resident_chats/verified','Alice'));await allow(read('resident_chats/verified','Bob'));
 for(const uid of ['Crew','Admin','Vip','Pending',undefined])await deny(read('resident_chats/verified',uid));
 for(const uid of ['Alice','Bob','Crew','Admin','Vip','Pending']){
  await deny(write('users/'+uid,uid,{...profile(uid),name:'Changed'}));
  await deny(write('resident_chats/verified',uid,{participantIds:['Alice','Bob'],messages:[]}));
  await deny(req('resident_chats/verified',{uid,method:'DELETE'}));
  await deny(write(authPath('resident_chats','verified'),uid,{status:'verified',memberIds:[uid]}));
 }
 await deny(read('users','Pending'));await deny(read('users/Alice','Pending'));await deny(read('resident_chats','Alice'));
});
