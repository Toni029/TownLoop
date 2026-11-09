const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{createRequire}=require('node:module'),path=require('node:path');
const req=createRequire(path.resolve(__dirname,'../../functions/package.json')),{initializeApp,deleteApp}=req('firebase-admin/app'),{getFirestore}=req('firebase-admin/firestore');
const {operate,memberPath}=require('../../functions/inbox-groups.cjs'),host=process.env.FIRESTORE_EMULATOR_HOST,project='demo-townloop-inbox-regression';
if(!/^127\.0\.0\.1:\d+$/.test(host||''))throw Error('Loopback emulator required');
let app,db;const call=(uid,data)=>operate(db,uid,data,{enabled:true});
const encode=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
function token(uid){const now=Math.floor(Date.now()/1000);return `${encode({alg:'none',typ:'JWT'})}.${encode({iss:`https://securetoken.google.com/${project}`,aud:project,sub:uid,user_id:uid,iat:now,exp:now+3600,auth_time:now,firebase:{sign_in_provider:'custom',identities:{}}})}.`;}
async function clientRead(uid,file){return fetch(`http://${host}/v1/projects/${project}/databases/(default)/documents/${file}`,{headers:{Authorization:`Bearer ${token(uid)}`}});}
before(async()=>{
 app=initializeApp({projectId:project},'messaging-regression');db=getFirestore(app);
 assert.equal((await fetch(`http://${host}/emulator/v1/projects/${project}/databases/(default)/documents`,{method:'DELETE'})).status,200);
 const rules=fs.readFileSync(path.resolve(__dirname,'../account-deletion/firestore.default.candidate.rules'),'utf8');
 assert.equal((await fetch(`http://${host}/emulator/v1/projects/${project}:securityRules`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({rules:{files:[{name:'firestore.rules',content:rules}]}})})).status,200);
 for(const [uid,role]of [['residentA','resident'],['residentB','resident'],['admin','admin'],['vip','vip'],['crew','crew'],['outsider','resident']])await db.doc(`users/${uid}`).set({approved:true,name:uid,role});
});
after(async()=>{await deleteApp(app);});
test('private create/send/reply cut over email-shaped legacy IDs without losing history or admitting outsiders',async()=>{
 const old=db.doc('resident_chats/a@example.test_vs_b@example.test');await old.set({identityVersion:2,participantIds:['residentA','residentB'],subject:'Synthetic contact',messages:[{id:'prior',senderId:'residentA',senderName:'residentA',senderRole:'resident',body:'Synthetic prior',createdAt:1}]});
 const {conversationId:id}=await call('residentA',{op:'create',type:'private',recipientIds:['residentB']});
 await call('residentA',{op:'send',conversationId:id,messageId:'play',body:'Synthetic Play'});await call('residentB',{op:'send',conversationId:id,messageId:'preview',body:'Synthetic Preview reply'});
 assert.equal((await clientRead('residentB',`inbox_conversations/${id}/messages/prior`)).status,200);assert.equal((await clientRead('outsider',`inbox_conversations/${id}/messages/play`)).status,403);
 assert.equal((await old.get()).data().messages.length,1);assert.equal((await old.get()).data().groupConversationId,id);
});
test('fresh Office preserves unverified history; joins expose only messages after membership and leaving revokes reads',async()=>{
 const old=db.doc('office_chats/protected-history'),data={residentId:'residentA',messages:[{id:'historic',senderId:'admin',body:'Protected synthetic history',createdAt:1}]};await old.set(data);
 await assert.rejects(call('residentA',{op:'create',type:'office',recipientIds:['admin']}),/failed-precondition/);
 const {conversationId:id}=await call('residentA',{op:'createFresh',type:'office',recipientIds:['admin']});assert.deepEqual((await old.get()).data(),data);assert.equal((await db.doc(`inbox_conversations/${id}/messages/historic`).get()).exists,false);
 await call('residentA',{op:'send',conversationId:id,messageId:'before',body:'Before current join'});await call('residentA',{op:'add',conversationId:id,recipientIds:['vip']});await call('admin',{op:'send',conversationId:id,messageId:'after',body:'After current join'});
 assert.equal((await clientRead('vip',`inbox_conversations/${id}/messages/before`)).status,403);assert.equal((await clientRead('vip',`inbox_conversations/${id}/messages/after`)).status,200);
 assert.equal((await call('residentA',{op:'create',type:'office',recipientIds:['admin']})).conversationId,id);
 await call('vip',{op:'leave',conversationId:id});assert.equal((await clientRead('vip',`inbox_conversations/${id}/messages/after`)).status,403);
});
test('fresh shared Crew conversation retains protected legacy records and never silently rejoins a departed crew member',async()=>{
 const old=db.doc('maintenance_chats/legacy'),data={residentId:'residentB',messages:[]};await old.set(data);
 const {conversationId:id}=await call('residentB',{op:'createFresh',type:'maintenance'});await call('crew',{op:'send',conversationId:id,messageId:'crew',body:'Synthetic Crew reply'});
 await call('crew',{op:'leave',conversationId:id});await call('residentB',{op:'sync',conversationId:id});assert.equal((await db.doc(memberPath(id,'crew')).get()).data().status,'left');assert.deepEqual((await old.get()).data(),data);
});

test('Play/Preview private compose after legacy and current departures creates one new history without restoring old reads',async()=>{
 const admin='recreateAdmin',resident='recreateResident';
 for(const [uid,role]of [[admin,'admin'],[resident,'resident']])await db.doc(`users/${uid}`).set({approved:true,name:uid,role});
 const legacy=db.doc('resident_chats/recreate@example.test'),old={identityVersion:2,participantIds:[admin,resident],leftBy:{[admin]:true,[resident]:true},messages:[{id:'legacyPast',senderId:resident,body:'Synthetic retained history',createdAt:1}]};await legacy.set(old);
 const {conversationId:first}=await call(admin,{op:'create',type:'private',recipientIds:[resident]});
 await call(admin,{op:'send',conversationId:first,messageId:'play',body:'Play to Preview'});
 assert.equal((await clientRead(resident,`inbox_conversations/${first}/messages/play`)).status,200);
 assert.equal((await call(resident,{op:'create',type:'private',recipientIds:[admin]})).conversationId,first);
 await call(resident,{op:'send',conversationId:first,messageId:'preview',body:'Preview to Play'});
 assert.equal((await clientRead(admin,`inbox_conversations/${first}/messages/preview`)).status,200);
 await Promise.all([admin,resident].map(uid=>call(uid,{op:'leave',conversationId:first})));
 const retained=(await db.doc(`inbox_conversations/${first}`).get()).data(),cleanup=(await db.doc(`inbox_cleanup_requests/${first}`).get()).data();
 const fresh=await Promise.all([call(admin,{op:'create',type:'private',recipientIds:[resident]}),call(resident,{op:'create',type:'private',recipientIds:[admin]})]);
 assert.equal(fresh[0].conversationId,fresh[1].conversationId);assert.notEqual(fresh[0].conversationId,first);
 assert.deepEqual((await legacy.get()).data(),old);assert.deepEqual((await db.doc(`inbox_conversations/${first}`).get()).data(),retained);assert.deepEqual((await db.doc(`inbox_cleanup_requests/${first}`).get()).data(),cleanup);
 for(const uid of [admin,resident])assert.equal((await clientRead(uid,`inbox_conversations/${first}/messages/play`)).status,403);
 await call(resident,{op:'send',conversationId:fresh[0].conversationId,messageId:'fresh',body:'Fresh conversation'});
 assert.equal((await clientRead(admin,`inbox_conversations/${fresh[0].conversationId}/messages/fresh`)).status,200);
 assert.equal((await clientRead('outsider',`inbox_conversations/${fresh[0].conversationId}/messages/fresh`)).status,403);
 assert.equal((await db.doc(`inbox_conversations/${fresh[0].conversationId}/messages/play`).get()).exists,false);
 const routes=await db.collection('inbox_conversation_routes').where('conversationId','==',fresh[0].conversationId).get();assert.equal(routes.size,1);
 assert.equal((await clientRead(admin,routes.docs[0].ref.path)).status,403);
 const forged=await fetch(`http://${host}/v1/projects/${project}/databases/(default)/documents/${routes.docs[0].ref.path}`,{method:'PATCH',headers:{Authorization:`Bearer ${token(admin)}`,'Content-Type':'application/json'},body:JSON.stringify({fields:{conversationId:{stringValue:first}}})});assert.equal(forged.status,403);
});
for(const type of ['office','maintenance'])test(`${type} recreation preserves old generations and authorization`,async()=>{
 const resident=`new_${type}`,staff=type==='office'?'admin':'crew',input={op:'create',type,...(type==='office'?{recipientIds:[staff]}:{})};
 await db.doc(`users/${resident}`).set({approved:true,name:resident,role:'resident'});
 const {conversationId:old}=await call(resident,input);await call(resident,{op:'send',conversationId:old,messageId:'prior',body:'Previous generation'});
 await call(resident,{op:'leave',conversationId:old});const snapshot=(await db.doc(`inbox_conversations/${old}`).get()).data();
 const {conversationId:fresh}=await call(resident,input);assert.notEqual(fresh,old);assert.deepEqual((await db.doc(`inbox_conversations/${old}`).get()).data(),snapshot);
 assert.equal((await clientRead(resident,`inbox_conversations/${old}/messages/prior`)).status,403);assert.equal((await clientRead(staff,`inbox_conversations/${old}/messages/prior`)).status,200);
 await call(staff,{op:'send',conversationId:fresh,messageId:'staff',body:'New authorized reply'});
 assert.equal((await clientRead(resident,`inbox_conversations/${fresh}/messages/staff`)).status,200);
 assert.equal((await db.doc(`inbox_conversations/${fresh}/messages/prior`).get()).exists,false);
 await assert.rejects(call('outsider',{...input,residentId:resident}),/permission-denied/);
});
