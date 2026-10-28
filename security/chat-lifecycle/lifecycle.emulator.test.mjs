// Synthetic fixtures and mocked Firebase Auth claims on a loopback emulator only.
import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
const host=process.env.FIRESTORE_EMULATOR_HOST;
if(!/^127\.0\.0\.1:\d+$/.test(host||''))throw Error('Loopback emulator required');
const project='demo-townloop-chat-lifecycle',base=`http://${host}`,documents=`${base}/v1/projects/${project}/databases/(default)/documents`;
const require=createRequire(new URL('../../native/package.json',import.meta.url)),ts=require('typescript'),sdk=require('firebase/firestore'),apps=require('firebase/app');
const instances=new Map(),profiles=Object.fromEntries(['Alice','Bob','Other','Admin','Pending'].map(uid=>[uid,{id:uid,name:uid,role:uid==='Admin'?'admin':'resident',approved:uid!=='Pending',avatarUrl:''}]));
function db(uid){if(!instances.has(uid)){const app=apps.initializeApp({projectId:project,apiKey:'demo'},uid),store=sdk.getFirestore(app);sdk.connectFirestoreEmulator(store,'127.0.0.1',Number(host.split(':')[1]),{mockUserToken:{sub:uid}});instances.set(uid,{app,store});}return instances.get(uid).store;}
function compile(file,modules={}){
 const url=new URL(file,import.meta.url),exports={};
 const source=process.env.CHAT_LIFECYCLE_BASELINE&&!file.endsWith('privateChatLifecycle.ts')
   ? execFileSync('git',['show',process.env.CHAT_LIFECYCLE_BASELINE+':'+url.pathname.split('/TownLoop/')[1]],{encoding:'utf8'}) : readFileSync(url,'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('exports','require',compiled)(exports,name=>{if(!(name in modules))throw Error('Unmocked module '+name);return modules[name];});return exports;
}
const permissions=compile('../../src/utils/permissions.ts');
function model(){const modules={'../../../src/utils/permissions.ts':permissions};try{modules['../../../src/services/privateChatLifecycle.ts']=compile('../../src/services/privateChatLifecycle.ts');}catch(e){if(e.code!=='ENOENT')throw e;}return compile('../../native/src/profile/model.ts',modules);}
function native(uid){return compile('../../native/src/profile/data.ts',{'react':{},'firebase/firestore':sdk,'expo-image-picker':{},'expo-image-manipulator':{},'../../../src/utils/permissions':permissions,'../lib/firebase':{db:db(uid),auth:{currentUser:{uid}}},'../news/actions':{approvedUser:async()=>{if(!profiles[uid]?.approved)throw Error('not approved');return profiles[uid];}},'../lib/liveCollection':{},'../lib/profile':{},'../lib/subscription':{},'../notifications/device':{refreshBadge:async()=>{}},'./model':model()});}
function marketplace(){return compile('../../src/services/marketplaceChatProtocol.ts',{'firebase/firestore':sdk,'./marketplaceChatIdentity':compile('../../src/services/marketplaceChatIdentity.ts')});}
const value=x=>Array.isArray(x)?{arrayValue:{values:x.map(value)}}:x&&typeof x==='object'?{mapValue:{fields:fields(x)}}:typeof x==='boolean'?{booleanValue:x}:typeof x==='number'?{integerValue:String(x)}:{stringValue:x};
const fields=x=>Object.fromEntries(Object.entries(x).map(([k,v])=>[k,value(v)]));
const message={id:'original',senderId:'Alice',senderName:'Alice',senderRole:'resident',senderAvatar:'',body:'Synthetic fixture',createdAt:1,time:'Now'};
const peer=id=>({id,identityVersion:2,participantIds:['Alice','Bob'],participants:[profiles.Alice,profiles.Bob],subject:'Fixture',messages:[message],lastMessage:message.body,updatedAt:1,unreadBy:['Bob']});
const market=id=>({id,itemId:'listing',sellerId:'Alice',buyerId:'Bob',participantIds:['Alice','Bob'],messages:[{id:'original',senderId:'Alice',senderName:'Alice',senderAvatar:'',text:'Fixture',createdAt:1,timestamp:'Now'}],lastMessage:'Fixture',lastMessageTime:'Now',updatedAt:1,unreadForBuyer:true,unreadForSeller:false});
const seed=async(path,data)=>{const r=await fetch(`${documents}/${path}`,{method:'PATCH',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify({fields:fields(data)})});assert.equal(r.status,200,await r.text());};
const ref=(uid,col,id)=>sdk.doc(db(uid),col,id);
const thread=(uid,id)=>({id,category:'friend',data:peer(id),recipient:profiles[uid==='Alice'?'Bob':'Alice'],messages:[message],subject:'Fixture'});
before(async()=>{const r=await fetch(`${base}/emulator/v1/projects/${project}:securityRules`,{method:'PUT',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify({rules:{files:[{name:'firestore.rules',content:readFileSync(new URL('./firestore.chat-lifecycle.rules',import.meta.url),'utf8')}]}})});assert.equal(r.status,200,await r.text());for(const [uid,p]of Object.entries(profiles))await seed('users/'+uid,p);});
after(async()=>{for(const {app,store}of instances.values()){await sdk.terminate(store);await apps.deleteApp(app);}});
test('Marketplace first leave preserves history; the remaining participant permanently deletes the live document; retries are safe',async()=>{
 const id='market-sequence';await seed('marketplace_chats/'+id,market(id));const p=marketplace();
 await assert.rejects(()=>sdk.deleteDoc(ref('Alice','marketplace_chats',id)),/permission/);
 await p.mutateMarketChat(db('Alice'),'Alice',id,'leave','','leave-a');const first=(await sdk.getDoc(ref('Bob','marketplace_chats',id))).data();assert.equal(first.sellerLeft,true);assert.equal(first.messages.length,2);assert.equal(first.messages[0].text,'Fixture');
 await assert.rejects(()=>sdk.deleteDoc(ref('Other','marketplace_chats',id)),/permission/);
 await p.mutateMarketChat(db('Bob'),'Bob',id,'leave','','leave-b');assert.equal((await sdk.getDoc(ref('Bob','marketplace_chats',id))).exists(),false);await p.mutateMarketChat(db('Bob'),'Bob',id,'leave');
});
test('private Inbox first leave is visible to the peer; both reply directions close; only the remaining participant can purge',async()=>{
 const id='peer-sequence';await seed('resident_chats/'+id,peer(id));
 await native('Alice').deleteThread(thread('Alice',id));const first=(await sdk.getDoc(ref('Bob','resident_chats',id))).data();assert.equal(first.leftBy?.Alice,true);assert.equal(first.messages.length,2);assert.equal(first.messages[1].type,'leave');assert.equal(first.messages[0].body,'Synthetic fixture');
 assert.equal(model().readThread('friend',id,first,profiles.Alice),null);assert.equal(model().readThread('friend',id,first,profiles.Bob).otherLeft,true);
 for(const uid of ['Alice','Bob'])await assert.rejects(()=>native(uid).sendMessage('friend',profiles[uid==='Alice'?'Bob':'Alice'],'Fixture','Reply',thread(uid,id)),/left/);
 for(const uid of ['Alice','Bob']){const reply={...message,id:'after-leave-'+uid,senderId:uid,senderName:uid};await assert.rejects(()=>sdk.updateDoc(ref(uid,'resident_chats',id),{messages:[...first.messages,reply],lastMessage:reply.body,updatedAt:1,subject:'Fixture',unreadBy:[uid==='Alice'?'Bob':'Alice']}),/permission/);}

 await assert.rejects(()=>sdk.deleteDoc(ref('Alice','resident_chats',id)),/permission/);await assert.rejects(()=>sdk.deleteDoc(ref('Admin','resident_chats',id)),/permission/);
 await native('Bob').deleteThread(thread('Bob',id));assert.equal((await sdk.getDoc(ref('Bob','resident_chats',id))).exists(),false);await native('Bob').deleteThread(thread('Bob',id));
});
test('unilateral deletion, third parties, legacy hidden cursors, forged leave markers and history rewrites cannot authorize purging',async()=>{
 const id='peer-secure';await seed('resident_chats/'+id,{...peer(id),hiddenBy:{Alice:1,Bob:1}});
 for(const uid of ['Alice','Other','Pending','Admin'])await assert.rejects(()=>sdk.deleteDoc(ref(uid,'resident_chats',id)),/permission/);
 const bad={...message,id:'forged',type:'leave',isSystem:true,actorId:'Bob',senderId:'system',senderName:'System',senderRole:'system',body:'Bob left the conversation.'};
 await assert.rejects(()=>sdk.updateDoc(ref('Bob','resident_chats',id),{leftBy:{Alice:true},messages:[message,bad],lastMessage:bad.body,updatedAt:2,unreadBy:['Alice']}),/permission/);
 await native('Bob').deleteThread(thread('Bob',id));const first=(await sdk.getDoc(ref('Alice','resident_chats',id))).data();assert.equal(first.leftBy?.Bob,true);assert.equal(first.leftBy?.Alice,undefined);assert.equal(first.messages[0].body,message.body);
 await assert.rejects(()=>sdk.updateDoc(ref('Alice','resident_chats',id),{messages:[]}),/permission/);
});

test('concurrent removals converge safely; repeated first leave cannot duplicate a system notice',async()=>{
 const id='peer-concurrent';await seed('resident_chats/'+id,peer(id));
 await Promise.all([native('Alice').deleteThread(thread('Alice',id)),native('Bob').deleteThread(thread('Bob',id))]);
 assert.equal((await sdk.getDoc(ref('Bob','resident_chats',id))).exists(),false);
 const repeat='peer-repeat';await seed('resident_chats/'+repeat,peer(repeat));await native('Alice').deleteThread(thread('Alice',repeat));await native('Alice').deleteThread(thread('Alice',repeat));assert.equal((await sdk.getDoc(ref('Bob','resident_chats',repeat))).data().messages.length,2);
});

test('normal private messages and read receipts still work; staff threads remain hide-only',async()=>{
 const id='peer-normal';await seed('resident_chats/'+id,peer(id));await native('Bob').sendMessage('friend',profiles.Alice,'Fixture','New fixture',thread('Bob',id));await native('Alice').markRead(thread('Alice',id));const data=(await sdk.getDoc(ref('Bob','resident_chats',id))).data();assert.equal(data.messages.length,2);assert.equal(data.readBy.Alice,2);
 for(const [category,collection]of [['office','office_chats'],['maintenance','maintenance_chats']]){const id='staff-hide';await seed(collection+'/'+id,{id,residentId:'Bob',messages:[message],subject:'Fixture'});await native('Bob').deleteThread({id,category});const saved=(await sdk.getDoc(ref('Bob',collection,id))).data();assert.equal(saved.hiddenBy.Bob,1);assert.equal(saved.leftBy,undefined);await assert.rejects(()=>sdk.deleteDoc(ref('Bob',collection,id)),/permission/);}
});
test('simultaneous Marketplace leave actions remove the chat without deleting it unilaterally',async()=>{
 const id='market-concurrent';await seed('marketplace_chats/'+id,market(id));const p=marketplace();await Promise.all([p.mutateMarketChat(db('Alice'),'Alice',id,'leave','','a-leave'),p.mutateMarketChat(db('Bob'),'Bob',id,'leave','','b-leave')]);assert.equal((await sdk.getDoc(ref('Bob','marketplace_chats',id))).exists(),false);
});
