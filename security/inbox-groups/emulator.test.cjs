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
 const request={op:'leaveLegacy',source:'office_chats',legacyId:'leave-fixture'};
 await assert.rejects(operate(db,'admin',request,{enabled:true}),/failed-precondition/);
 assert.deepEqual((await source.get()).data(),old);
 const {hash}=require('../../functions/inbox-groups.cjs');
 await db.doc(`inbox_legacy_authorizations/${hash('office_chats/leave-fixture')}`).set({sourceHash:hash(JSON.stringify((await source.get()).data())),participantIds:['leaveResident','admin','vip'],reviewedBy:'admin',evidenceReference:'verified_local_fixture',expiresAt:Date.now()+60000});
 const result=await operate(db,'admin',request,{enabled:true});assert.equal(result.left,true);
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
