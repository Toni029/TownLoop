const {test,before,after}=require('node:test'),assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');const {createRequire}=require('node:module');const path=require('node:path');
const host=process.env.FIRESTORE_EMULATOR_HOST;
if(!/^127\.0\.0\.1:\d+$/.test(host||''))throw Error('Disposable loopback Firestore emulator required.');
const requireAdmin=createRequire(path.resolve(__dirname,'../../functions/package.json'));
const {initializeApp,deleteApp}=requireAdmin('firebase-admin/app'),{getFirestore}=requireAdmin('firebase-admin/firestore');
const {operate,memberPath}=require('../../functions/inbox-groups.cjs');
const project='demo-townloop-inbox-groups',base=`http://${host}`,documents=`${base}/v1/projects/${project}/databases/(default)/documents`;
const app=initializeApp({projectId:project},'inbox-group-emulator'),db=getFirestore(app);
const encode=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
function token(uid){const now=Math.floor(Date.now()/1000);return`${encode({alg:'none',typ:'JWT'})}.${encode({iss:`https://securetoken.google.com/${project}`,aud:project,auth_time:now,user_id:uid,sub:uid,iat:now,exp:now+3600,firebase:{sign_in_provider:'custom',identities:{}}})}.`;}
async function read(uid,file){const r=await fetch(`${documents}/${file}`,{headers:uid?{Authorization:`Bearer ${token(uid)}`}:{}});return{status:r.status,body:await r.text()};}
async function queryMessages(uid,id,key,unfiltered=false){const r=await fetch(`${documents}/inbox_conversations/${id}:runQuery`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token(uid)}`},body:JSON.stringify({structuredQuery:{from:[{collectionId:'messages'}],...(!unfiltered?{where:{fieldFilter:{field:{fieldPath:'visibility'},op:'ARRAY_CONTAINS',value:{stringValue:key}}}}:{}),orderBy:[{field:{fieldPath:'sequence'},direction:'DESCENDING'}]}})});return{status:r.status,body:await r.text()};}
async function forgedWrite(uid,file,fields){const r=await fetch(`${documents}/${file}`,{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token(uid)}`},body:JSON.stringify({fields})});return{status:r.status,body:await r.text()};}
const ok=r=>assert.equal(r.status,200,r.body),denied=r=>assert.equal(r.status,403,r.body);
let id;
before(async()=>{
 const cleared=await fetch(`${base}/emulator/v1/projects/${project}/databases/(default)/documents`,{method:'DELETE',headers:{Authorization:'Bearer owner'}});assert.equal(cleared.status,200,await cleared.text());
 const rules=readFileSync(path.resolve(__dirname,'../../.release/inbox-groups/firestore.rules'),'utf8');
 const r=await fetch(`${base}/emulator/v1/projects/${project}:securityRules`,{method:'PUT',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify({rules:{files:[{name:'firestore.rules',content:rules}]}})});assert.equal(r.status,200,await r.text());
 for(const [uid,role]of [['resident','resident'],['admin','admin'],['vip','vip'],['crew','crew'],['outsider','resident']])await db.doc(`users/${uid}`).set({approved:true,role,name:uid});
 ({conversationId:id}=await operate(db,'resident',{op:'create',type:'office',recipientIds:['admin']},{enabled:true}));
 await operate(db,'resident',{op:'send',conversationId:id,messageId:'old',body:'Old private fixture'},{enabled:true});
 await operate(db,'resident',{op:'add',conversationId:id,recipientIds:['vip']},{enabled:true});
 await operate(db,'admin',{op:'send',conversationId:id,messageId:'new',body:'New fixture'},{enabled:true});
});
after(async()=>{await deleteApp(app);});
test('real Firestore transactions and rules allow the intended epoch query, deny historical gets/unfiltered queries',async()=>{
 const response=await queryMessages('vip',id,'vip:1');ok(response);assert(!response.body.includes('Old private fixture'));assert(response.body.includes('New fixture'));
 denied(await read('vip',`inbox_conversations/${id}/messages/old`));ok(await read('admin',`inbox_conversations/${id}/messages/old`));
 denied(await queryMessages('vip',id,'vip:1',true));denied(await queryMessages('vip',id,'admin:1'));
 denied(await read('outsider',`inbox_conversations/${id}`));denied(await read('',`inbox_conversations/${id}`));
});
test('client cannot forge messages, membership, timestamps, system events or read someone else membership',async()=>{
 denied(await forgedWrite('vip',memberPath(id,'vip'),{epoch:{integerValue:'0'},status:{stringValue:'active'}}));
 denied(await forgedWrite('vip',`inbox_conversations/${id}/messages/forged`,{type:{stringValue:'join'},body:{stringValue:'Forged'}}));
 denied(await read('vip',memberPath(id,'admin')));ok(await read('vip',memberPath(id,'vip')));
});
test('live role changes and leaving revoke direct database reads and message queries',async()=>{
 await db.doc('users/vip').update({role:'resident'});denied(await queryMessages('vip',id,'vip:1'));denied(await read('vip',`inbox_conversations/${id}/messages/new`));
 await db.doc('users/vip').update({role:'vip'});await operate(db,'vip',{op:'leave',conversationId:id},{enabled:true});
 denied(await queryMessages('vip',id,'vip:1'));denied(await read('vip',`inbox_conversations/${id}`));
 ok(await read('admin',`inbox_conversations/${id}/messages/new`));
});
test('legacy migration fences archived history from new members and all client writes',async()=>{
 const old={identityVersion:2,participantIds:['resident','outsider'],participants:[{id:'resident',name:'Resident'},{id:'outsider',name:'Other'}],messages:[{id:'legacy',senderId:'resident',senderName:'Resident',senderRole:'resident',body:'Original fixture',createdAt:1}],subject:'Legacy',updatedAt:1};
 await db.doc('resident_chats/legacy').set(old);
 const result=await operate(db,'resident',{op:'upgradeLegacy',source:'resident_chats',legacyId:'legacy'},{enabled:true});
 ok(await read('resident','resident_chats/legacy'));
 denied(await forgedWrite('resident','resident_chats/legacy',{groupConversationId:{stringValue:'fake'}}));
 await operate(db,'resident',{op:'leave',conversationId:result.conversationId},{enabled:true});
 denied(await read('resident','resident_chats/legacy'));ok(await read('outsider','resident_chats/legacy'));
});
test('server read watermark uses the displayed sequence and a real authorized visibility query',async()=>{
 await operate(db,'resident',{op:'read',conversationId:id,sequence:1},{enabled:true});
 const m=(await db.doc(memberPath(id,'resident')).get()).data();assert.equal(m.readSequence,1);
 assert.equal(m.readAt,(await db.doc(`inbox_conversations/${id}/messages/old`).get()).data().createdAt);
});
test('legacy team-write mismatch is denied; authorized atomic individual leave succeeds after the prepared rollout',async()=>{
 const oldRules=readFileSync(path.resolve(__dirname,'../inbox-push/firestore-replies.candidate.rules'),'utf8');
 async function rules(content){const r=await fetch(`${base}/emulator/v1/projects/${project}:securityRules`,{method:'PUT',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify({rules:{files:[{name:'firestore.rules',content}]}})});assert.equal(r.status,200,await r.text());}
 await rules(oldRules);
 await db.doc('users/leaveResident').set({approved:true,role:'resident',name:'Resident Fixture'});
 const source=db.doc('office_chats/leave-fixture'),old={residentId:'leaveResident',residentName:'Resident Fixture',messages:[{id:'original',senderId:'leaveResident',senderName:'Resident Fixture',senderRole:'resident',body:'Fixture history',createdAt:1}],lastMessage:'Fixture history',updatedAt:1,subject:'Fixture'};
 await source.set(old);
 const deniedTeamWrite=await fetch(`${documents}/office_chats/leave-fixture?updateMask.fieldPaths=sideLeft`,{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token('admin')}`},body:JSON.stringify({fields:{sideLeft:{mapValue:{fields:{team:{booleanValue:true}}}}}})});
 assert.equal(deniedTeamWrite.status,403,await deniedTeamWrite.text());
 await rules(readFileSync(path.resolve(__dirname,'../../.release/inbox-groups/firestore.rules'),'utf8'));
 const request={op:'upgradeLegacy',source:'office_chats',legacyId:'leave-fixture'};
 await assert.rejects(operate(db,'admin',request,{enabled:true}),/failed-precondition/);
 assert.deepEqual((await source.get()).data(),old);
 const {hash}=require('../../functions/inbox-groups.cjs');
 await db.doc(`inbox_legacy_authorizations/${hash('office_chats/leave-fixture')}`).set({sourceHash:hash(JSON.stringify((await source.get()).data())),participantIds:['leaveResident','admin','vip'],reviewedBy:'admin',evidenceReference:'verified_local_fixture',expiresAt:Date.now()+60000});
 await operate(db,'admin',request,{enabled:true});
 const result=await operate(db,'admin',{...request,op:'leaveLegacy'},{enabled:true});assert.equal(result.left,true);
 assert.equal((await db.doc(memberPath(result.conversationId,'admin')).get()).data().status,'left');
 assert.equal((await db.doc(memberPath(result.conversationId,'vip')).get()).data().status,'active');
 assert.deepEqual((await source.get()).data().messages,old.messages);assert.equal((await source.get()).data().sideLeft,undefined);
 denied(await read('admin',`inbox_conversations/${result.conversationId}`));ok(await read('vip',`inbox_conversations/${result.conversationId}`));
 const leaveEvents=await db.collection(`inbox_conversations/${result.conversationId}/messages`).where('type','==','leave').get();assert.equal(leaveEvents.size,1);assert.equal(leaveEvents.docs[0].data().body,'admin left the conversation.');
 await operate(db,'leaveResident',{op:'leave',conversationId:result.conversationId},{enabled:true});
 const final=await operate(db,'vip',{op:'leave',conversationId:result.conversationId},{enabled:true});assert.equal(final.cleanupPending,true);
 assert((await db.doc(`inbox_conversations/${result.conversationId}`).get()).exists);assert((await source.get()).exists);
 assert.equal((await db.doc(`inbox_cleanup_requests/${result.conversationId}`).get()).data().status,'awaiting_separate_approval');
});
test('legacy individual leave without manifest revokes only the caller, preserves history and denies spoofing',async()=>{
 for(const [source,actor,other]of [['office_chats','admin','vip'],['maintenance_chats','crew','crew2'],['resident_chats','resident','outsider']]){
  await db.doc('users/crew2').set({approved:true,role:'crew',name:'Crew Fixture'});
  const old={id:`self-${source}`,residentId:'resident',residentName:'Resident Fixture',identityVersion:2,participantIds:['resident','outsider'],participants:[{id:'resident'},{id:'outsider'}],messages:[{id:'old:unmodeled',senderId:'historical_alias',body:'Kept fixture',createdAt:1,legacyExtra:'preserved'}],subject:'Fixture',updatedAt:1};
  const ref=db.doc(`${source}/self-leave`);await ref.set(old);
  const request={op:'leaveLegacy',source,legacyId:'self-leave'};
  const result=await operate(db,actor,request,{enabled:true});assert.equal(result.left,true);
  const next=(await ref.get()).data();assert.deepEqual(next.messages.slice(0,-1),old.messages);assert.equal(next.leftBy[actor],true);assert.equal(next.groupConversationId,undefined);assert.equal(next.sideLeft,undefined);
  denied(await read(actor,`${source}/self-leave`));ok(await read(other,`${source}/self-leave`));
  denied(await forgedWrite(other,`${source}/self-leave`,{leftBy:{mapValue:{fields:{[other]:{booleanValue:true}}}}}));
  const response=await operate(db,actor,request,{enabled:true});assert.equal(response.unchanged,true);assert.equal((await ref.get()).data().messages.length,2);
 }
});
test('legacy remaining private participant can read/ack but cannot send; remaining Office staff can still reply',async()=>{
 const field=value=>value===null?{nullValue:null}:typeof value==='string'?{stringValue:value}:typeof value==='boolean'?{booleanValue:value}:typeof value==='number'?{integerValue:String(value)}:Array.isArray(value)?{arrayValue:{values:value.map(field)}}:{mapValue:{fields:Object.fromEntries(Object.entries(value).map(([k,v])=>[k,field(v)]))}};
 async function write(uid,source,data){return forgedWrite(uid,source,field(data).mapValue.fields);}
 await db.doc('resident_chats/guard').set({id:'guard',identityVersion:2,participantIds:['resident','outsider'],participants:[{id:'resident'},{id:'outsider'}],messages:[],subject:'Fixture',lastMessage:'',updatedAt:1,unreadBy:[]});
 await operate(db,'resident',{op:'leaveLegacy',source:'resident_chats',legacyId:'guard'},{enabled:true});
 let old=(await db.doc('resident_chats/guard').get()).data();ok(await write('outsider','resident_chats/guard',{...old,readBy:{outsider:old.messages.length}}));
 const makeMessage=uid=>({id:'new',senderId:uid,senderName:uid,senderRole:uid==='vip'?'vip':'resident',senderAvatar:'',body:'Fixture reply',createdAt:Date.now(),time:'Fixture'});
 const privateMessage=makeMessage('outsider');old=(await db.doc('resident_chats/guard').get()).data();
 denied(await write('outsider','resident_chats/guard',{...old,messages:[...old.messages,privateMessage],lastMessage:privateMessage.body,updatedAt:privateMessage.createdAt,unreadBy:['resident']}));
 await db.doc('office_chats/guard').set({id:'guard',residentId:'resident',messages:[],subject:'Fixture',lastMessage:'',updatedAt:1,unreadByResident:false,unreadByVip:true});
 await operate(db,'admin',{op:'leaveLegacy',source:'office_chats',legacyId:'guard'},{enabled:true});
 old=(await db.doc('office_chats/guard').get()).data();const reply=makeMessage('vip');
 ok(await write('vip','office_chats/guard',{...old,messages:[...old.messages,reply],lastMessage:reply.body,updatedAt:reply.createdAt,unreadByResident:true,unreadByVip:false}));
 denied(await write('admin','office_chats/guard',{...old,messages:[...old.messages,{...reply,senderId:'admin',senderName:'admin',senderRole:'admin'}],lastMessage:reply.body,updatedAt:reply.createdAt,unreadByResident:true,unreadByVip:false}));
});
