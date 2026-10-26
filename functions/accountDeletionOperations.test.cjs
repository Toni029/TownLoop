const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {memoryFirestore}=require('./testSupport/memoryFirestore.cjs'),{DATABASES}=require('./accountDeletionScope.cjs'),{jobIdFor}=require('./accountDeletionPolicy.cjs'),r=require('./accountDeletionRetention.cjs');
function fixture(active=false){
 const id=jobIdFor('alice'),receipt=jobIdFor('resident_chats/legacy'),now=Date.now();
 const stores=DATABASES.map(()=>memoryFirestore());const {db,records}=stores[0];
 records.set('users/manager',{role:'admin',approved:true});records.set('users/vip',{role:'vip',approved:true});records.set('users/alice',{role:'resident',approved:true});
 records.set('deletion_policies/account',{ownerApproved:true,policyVersion:2,approvalReference:r.POLICY_ID,identityCoverageVerified:true,mediaCoverageVerified:true,databaseScopeVerified:true,retentionDays:60,reviewBusinessDays:3,escalationCalendarDays:7,completionCalendarDays:7,scopeWriteFreezeVerified:Object.fromEntries(DATABASES.map(d=>[d,true])),scopeRuleHashes:Object.fromEntries(DATABASES.map((id,i)=>[id,String(i+1).repeat(64)])),tokenDrainMs:3900000});
 records.set(`account_deletion_jobs/${id}`,{uid:'alice',phase:'requested',status:'approved_held',createdAt:new Date(now-86400000),review:{decision:'approved',reviewerId:'manager',processingAuthorized:false,policyReference:r.POLICY_ID}});
 const module={exports:{}};vm.runInNewContext(fs.readFileSync(require.resolve('./accountDeletionOperations.cjs'),'utf8'),{module,exports:module.exports,Date,process:{env:{TOWNLOOP_ACCOUNT_DELETION_ENABLED:active?'true':'false',TOWNLOOP_SCOPED_DELETION_ENABLED:active?'true':'false'}},require:name=>{if(name==='firebase-functions/v2/https')return {onCall:(_o,f)=>f,HttpsError:class extends Error{constructor(code,message){super(message);this.code=code;}}};if(name==='firebase-admin/firestore')return {getFirestore:(id='(default)')=>stores[DATABASES.indexOf(id)].db,FieldValue:{serverTimestamp:()=>new Date(now)}};if(name==='firebase-admin/auth')return {getAuth:()=>({getUser:async uid=>({uid}),verifyIdToken:async token=>({uid:token,auth_time:now/1000})})};return require(name);}});
 const request=(uid,data)=>({auth:{uid},rawRequest:{headers:{authorization:`Bearer ${uid}`}},data});
 return {...module.exports,stores,records,db,id,receipt,request};
}
test('processing authorization stays off by default and only independently approved Admin action can queue it',async()=>{
 const off=fixture();await assert.rejects(off.authorizeAccountDeletionProcessing(off.request('manager',{jobId:off.id,confirmation:'AUTHORIZE PROCESSING'})),e=>e.code==='failed-precondition');assert.equal(off.records.get(`account_deletion_jobs/${off.id}`).status,'approved_held');
 const on=fixture(true);await assert.rejects(on.authorizeAccountDeletionProcessing(on.request('vip',{jobId:on.id,confirmation:'AUTHORIZE PROCESSING'})),e=>e.code==='permission-denied');
 await on.authorizeAccountDeletionProcessing(on.request('manager',{jobId:on.id,confirmation:'AUTHORIZE PROCESSING'}));const job=on.records.get(`account_deletion_jobs/${on.id}`);assert.equal(job.processingProtocol,3);assert.equal(job.status,'queued');assert.ok(on.records.has('users/alice'));assert.equal(job.review.processingAuthorized,true);
});
test('exception review is Admin-only, preserves ambiguous records, and safely resumes after verified correction',async()=>{
 const h=fixture(),scope=h.stores[1],root=h.records.get(`account_deletion_jobs/${h.id}`);Object.assign(root,{processingProtocol:3,status:'needs_review'});root.review.processingAuthorized=true;
 scope.records.set(`account_deletion_scopes/${h.id}`,{uid:'alice',phase:'private',status:'needs_review'});scope.records.set(`account_deletion_scopes/${h.id}/inventory/${h.receipt}`,{path:'resident_chats/legacy',collection:'resident_chats',state:'needs_review',reason:'legacy_chat_identity'});
 scope.records.set('resident_chats/legacy',{residentId:'alice',participantIds:['legacy-name'],messages:[{senderId:'alice',body:'synthetic private body'}]});
 const data={jobId:h.id,databaseId:DATABASES[1],receiptId:h.receipt,confirmation:'RECHECK'};
 await assert.rejects(h.listAccountDeletionExceptions(h.request('vip',data)),e=>e.code==='permission-denied');
 const list=await h.listAccountDeletionExceptions(h.request('manager',data));assert.equal(list.exceptions.length,1);assert.equal(JSON.stringify(list).includes('synthetic private body'),false);
 await assert.rejects(h.recheckAccountDeletionException(h.request('manager',data)),e=>e.code==='failed-precondition');assert.equal(root.status,'needs_review');
 // Approved external identity correction is simulated only in this fixture, not performed by the API.
 Object.assign(scope.records.get('resident_chats/legacy'),{identityVersion:2,participantIds:['alice','bob']});
 await h.recheckAccountDeletionException(h.request('manager',data));await h.recheckAccountDeletionException(h.request('manager',data));assert.equal(h.records.get(`account_deletion_jobs/${h.id}`).status,'processing');assert.equal(scope.records.get(`account_deletion_scopes/${h.id}/inventory/${h.receipt}`).state,'pending_redaction');assert.equal(scope.records.get('resident_chats/legacy').messages[0].body,'synthetic private body');
});
test('scope-level recheck never guesses a conflicting profile and only resumes after exact UID correction',async()=>{
 const h=fixture(),root=h.records.get(`account_deletion_jobs/${h.id}`);Object.assign(root,{processingProtocol:3,status:'needs_review',phase:'requested',lastError:'profile_identity_conflict'});root.review.processingAuthorized=true;
 h.stores[1].records.set('users/alice',{id:'bob'});const data={jobId:h.id,confirmation:'RECHECK'};
 await assert.rejects(h.recheckAccountDeletionScope(h.request('manager',data)),e=>e.code==='failed-precondition');assert.equal(root.status,'needs_review');
 h.stores[1].records.set('users/alice',{id:'alice'});await h.recheckAccountDeletionScope(h.request('manager',data));assert.equal(h.records.get(`account_deletion_jobs/${h.id}`).status,'processing');assert.ok(h.records.has('users/alice'));assert.equal(h.stores[1].records.get('users/alice').id,'alice');
});
