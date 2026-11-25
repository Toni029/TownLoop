import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {after, test} from 'node:test';
import { initializeApp, deleteApp } from 'firebase/app';
import { connectFirestoreEmulator, doc, getDocFromServer, getDocsFromServer, getFirestore, setDoc, terminate, updateDoc } from 'firebase/firestore';
import { marketChatId, marketplaceChatQuery, mutateMarketChat, sendMarketInquiry } from '../../src/services/marketplaceChatProtocol';

const host = process.env.FIRESTORE_EMULATOR_HOST ?? '';
assert.match(host, /^127\.0\.0\.1:\d+$/, 'An isolated loopback Firestore emulator is required.');
const port = Number(host.split(':')[1]);
const deployedBaseline = execFileSync('git',['show','2b60949:security/database-cleanup/firestore.rules'],{encoding:'utf8'});
assert.equal(createHash('sha256').update(deployedBaseline).digest('hex'),'8d105d51885783e5b98993ca185d0ac968abf4d1eb423f53d78710e78dcc9047');
const candidateRules = readFileSync(new URL('../database-cleanup/firestore.rules',import.meta.url),'utf8');
const roles = ['crew','resident','vip','admin'] as const;
const denied = {code:'permission-denied'};
const done: (()=>Promise<void>)[] = [];
after(async()=>{for(const close of done)await close();});

function fixture(project:string) {
 const emulator = `http://${host}`;
 const documents = `${emulator}/v1/projects/${project}/databases/(default)/documents`;
 const headers = {Authorization:'Bearer owner','Content-Type':'application/json'};
 function encode(value:any):any {
  if(value===null)return {nullValue:null};
  if(Array.isArray(value))return {arrayValue:{values:value.map(encode)}};
  if(typeof value==='object')return {mapValue:{fields:fields(value)}};
  if(typeof value==='boolean')return {booleanValue:value};
  if(typeof value==='number')return {integerValue:String(value)};
  return {stringValue:String(value)};
 }
 const fields = (object:Record<string,any>)=>Object.fromEntries(Object.entries(object).map(([key,val])=>[key,encode(val)]));
 async function seed(path:string,data:Record<string,any>){
  const r=await fetch(`${documents}/${path}`,{method:'PATCH',headers,body:JSON.stringify({fields:fields(data)})});
  assert.equal(r.status,200,await r.text());
 }
 async function rules(file:string){
  const content=file==='./exact-live.rules'?deployedBaseline:candidateRules;
  const r=await fetch(`${emulator}/emulator/v1/projects/${project}:securityRules`,{
   method:'PUT',headers,body:JSON.stringify({rules:{files:[{name:'firestore.rules',content}]}}),
  });
  assert.equal(r.status,200,await r.text());
 }
 function client(uid:string){
  const app=initializeApp({projectId:project,apiKey:'demo'},project+'/'+uid);
  const db=getFirestore(app);
  connectFirestoreEmulator(db,'127.0.0.1',port,{mockUserToken:{sub:uid}});
  done.push(async()=>{await terminate(db);await deleteApp(app);});
  return db;
 }
 async function setupUser(uid:string,role:string,approved=true){
  const profile={approved,name:uid,role};
  await seed('users/'+uid,profile);
  await seed('resident_directory/'+uid,profile);
  return client(uid);
 }
 const listing=(id:string,seller:string)=>seed('marketplace_posts/'+id,{storageDraft:false,userId:seller,title:'Synthetic chair',price:'FREE'});
 const setControls=(on:boolean)=>seed('security_controls/abuse_limits',{protocolVersion:1,prepareClients:on,enforceWrites:on});
 return {seed,rules,client,setupUser,listing,setControls};
}

test('compare identical legacy and prepared-client paths for each role against exact live and candidate rules', async()=>{
 const results:Record<string,Record<string,string>>={};
 const candidate='patched';
 for(const variant of ['exact-live',candidate]) {
  const f=fixture('demo-townloop-market-compare-'+candidate+'-'+variant);
  await f.rules('./'+variant+'.rules');
  await f.seed('database_cleanup_control/active',{referenceWritesBlocked:false});
  results[variant]={};
  const seller=await f.setupUser('seller','resident'),buyers:Record<string,ReturnType<typeof f.client>>={};
  for(const role of roles)buyers[role]=await f.setupUser(role,role);
  for(const phase of ['legacy','prepared','enforced']){
   const isEnforced=phase==='enforced';
   await f.seed('security_controls/abuse_limits',{protocolVersion:1,prepareClients:phase!=='legacy',enforceWrites:isEnforced});
   for(const role of roles){
    const listing=phase+'-'+role,buyer=buyers[role],id=marketChatId(listing,role);
    await f.listing(listing,'seller');
    try {
     await sendMarketInquiry(buyer,role,listing,'Is it available?',phase+'-first');
    } catch(error){
     assert.equal((error as {code?:string}).code,'permission-denied');
     results[variant][phase+'/'+role]='create-denied';continue;
    }
    await mutateMarketChat(seller,'seller',id,'read');
    try {
     await mutateMarketChat(seller,'seller',id,'reply','Yes.',phase+'-reply');
     await sendMarketInquiry(buyer,role,listing,'Thank you.',phase+'-followup');
    } catch(error){
     assert.equal((error as {code?:string}).code,'permission-denied');
     results[variant][phase+'/'+role]='reply-denied';continue;
    }
    const chat=(await getDocFromServer(doc(buyer,'marketplace_chats',id))).data();
    assert.equal(chat?.messages.length,3);
    results[variant][phase+'/'+role]='pass';
   }
  }
 }
 console.log(JSON.stringify(results));
 for(const role of roles){
  for(const phase of ['legacy','prepared','enforced'])assert.equal(results[candidate][phase+'/'+role],'pass');
 }
 assert(Object.entries(results['exact-live']).some(([key,status])=>key.startsWith('enforced/')&&status!=='pass'));
});

for(const enforcing of [true,false])test(`candidate: all role pairs create, read, reply and reuse with enforcement ${enforcing?'on':'off'}`,async()=>{
 const mode=enforcing?'enabled':'disabled';
 const f=fixture('demo-townloop-patched-market-'+mode);
 await f.rules('./patched.rules');
 await f.seed('database_cleanup_control/active',{referenceWritesBlocked:false});
 await f.setControls(enforcing);
 const outsider=await f.setupUser('outsider','resident'),pending=await f.setupUser('pending','resident',false);
 for(const [index,buyerRole] of roles.entries()){
  console.log('matrix role',mode,buyerRole);
  const sellerRole=roles[(index+1)%roles.length];
  const buyerId='buy-'+buyerRole,sellerId='sell-'+sellerRole;
  const buyer=await f.setupUser(buyerId,buyerRole),seller=await f.setupUser(sellerId,sellerRole);
  const listing='seat-'+buyerRole;
  await f.listing(listing,sellerId);
  const id=marketChatId(listing,buyerId),buyerDoc=doc(buyer,'marketplace_chats',id),sellerDoc=doc(seller,'marketplace_chats',id);
  assert.equal(await sendMarketInquiry(buyer,buyerId,listing,'Is this chair available?','first'),id);
  const created=(await getDocFromServer(sellerDoc)).data()!;
  assert.deepEqual(created.participantIds,[sellerId,buyerId]);
  assert.equal(created.unreadForSeller,true);
  assert.equal(created.messages.length,1);
  const own=(await getDocsFromServer(marketplaceChatQuery(buyer,buyerId))).docs.map(row=>row.id);
  assert.ok(own.includes(id));
  assert.equal((await getDocsFromServer(marketplaceChatQuery(outsider,'outsider'))).size,0);
  for(const outsiderDb of [outsider,pending]) {
   await assert.rejects(getDocFromServer(doc(outsiderDb,'marketplace_chats',id)),denied);
   await assert.rejects(updateDoc(doc(outsiderDb,'marketplace_chats',id),{unreadForBuyer:false}),denied);
  }
  const rawId=marketChatId(listing,'outsider');
  const raw={...created,id:rawId,buyerId:'outsider',buyerName:'outsider',participantIds:[sellerId,'outsider'],messages:[{...created.messages[0],senderId:'outsider',senderName:'outsider'}]};
  if(enforcing)await assert.rejects(setDoc(doc(outsider,'marketplace_chats',rawId),raw),denied);
  await mutateMarketChat(seller,sellerId,id,'read');
  assert.equal((await getDocFromServer(buyerDoc)).data()?.unreadForSeller,false);
  await mutateMarketChat(seller,sellerId,id,'reply','Available.','second');
  assert.equal((await getDocFromServer(buyerDoc)).data()?.unreadForBuyer,true);
  await mutateMarketChat(buyer,buyerId,id,'read');
  assert.equal((await getDocFromServer(sellerDoc)).data()?.unreadForBuyer,false);
  assert.equal(await sendMarketInquiry(buyer,buyerId,listing,'Thanks!','third'),id);
  assert.equal(await sendMarketInquiry(buyer,buyerId,listing,'Thanks!','third'),id);
  await mutateMarketChat(buyer,buyerId,id,'reply','See you soon.','fourth');
  assert.deepEqual((await getDocFromServer(sellerDoc)).data()?.messages.map((m:{id:string})=>m.id),['first','second','third','fourth']);
  const buyerBudget=(await getDocFromServer(doc(buyer,'safety_limits',buyerId))).data();
  if(enforcing){
   assert.equal(buyerBudget?.activity.inquiries.dayCount,1);
   assert.equal(buyerBudget?.activity.messages.dayCount,2);
  }else assert.equal(buyerBudget,undefined);
  await f.seed('user_blocks/'+sellerId+'/targets/'+buyerId,{ownerUid:sellerId});
  await assert.rejects(mutateMarketChat(buyer,buyerId,id,'reply','Blocked reply','blocked'),denied);
  // Revocation hides even the most recent server history from its old participant.
  await f.seed('account_access_revocations/'+buyerId,{uid:buyerId,jobId:'disposable-fixture'});
  await assert.rejects(getDocFromServer(buyerDoc),denied);
  await assert.rejects(updateDoc(buyerDoc,{unreadForBuyer:false}),denied);
  assert.equal((await getDocFromServer(sellerDoc)).data()?.messages.length,4);
 }
});

test('candidate: enforcement-off legacy inquiry stays permitted with no quota or an unrelated quota document',async()=>{
 const f=fixture('demo-townloop-patched-market-legacy');
 await f.rules('./patched.rules');
 await f.seed('database_cleanup_control/active',{referenceWritesBlocked:false});
 await f.setControls(false);
 const crew=await f.setupUser('crew','crew');
 const seller=await f.setupUser('seller','resident');
 await f.listing('legacy','seller');
 const id=await sendMarketInquiry(crew,'crew','legacy','Does this work?','legacy-inquiry');
 await f.seed('safety_limits/crew',{unrelatedCounter:1});
 await mutateMarketChat(crew,'crew',id,'reply','Thanks.','legacy-reply');
 assert.equal((await getDocFromServer(doc(seller,'marketplace_chats',id))).data()?.messages.length,2);
});

test('Marketplace write guards retain global, category and individual record fences', async () => {
 const f=fixture('demo-townloop-market-fence-parity');
 await f.rules('./patched.rules');
 await f.setControls(true);
 const buyer=await f.setupUser('buyer','crew');
 await f.setupUser('seller','resident');
 await f.listing('guarded','seller');
 const id=marketChatId('guarded','buyer');
 const create=()=>sendMarketInquiry(buyer,'buyer','guarded','Synthetic inquiry','guarded-create');

 await f.seed('database_cleanup_control/active',{referenceWritesBlocked:true});
 await assert.rejects(create(),denied);
 await f.seed('database_cleanup_control/active',{referenceWritesBlocked:false,collections:['marketplace_chats']});
 await assert.rejects(create(),denied);
 await f.seed('database_cleanup_control/active',{referenceWritesBlocked:false,collections:['work_orders']});
 assert.equal(await create(),id);

 await f.seed('database_cleanup_fences/marketplace_chats/records/'+id,{jobId:'synthetic-hold'});
 const chat=doc(buyer,'marketplace_chats',id);
 assert.equal((await getDocFromServer(chat)).exists(),true);
 await assert.rejects(mutateMarketChat(buyer,'buyer',id,'reply','Denied while fenced','guarded-reply'),denied);
});
