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
