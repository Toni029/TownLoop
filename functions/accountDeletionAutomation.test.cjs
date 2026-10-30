const test=require('node:test'),assert=require('node:assert/strict');
const {memoryFirestore}=require('./testSupport/memoryFirestore.cjs');
const {jobIdFor}=require('./accountDeletionPolicy.cjs');
const retention=require('./accountDeletionRetention.cjs');
const {authorizeApprovedRequest}=require('./accountDeletionAutomation.cjs');
function fixture(extra={}){const uid='resident',id=jobIdFor(uid),job={uid,status:'approved_held',phase:'requested',createdAt:new Date(),review:{decision:'approved',reviewerId:'manager',reviewedAt:new Date(),policyReference:retention.POLICY_ID,processingAuthorized:false},...extra};const h=memoryFirestore({[`account_deletion_jobs/${id}`]:job,'users/manager':{approved:true,role:'vip'},[`account_deletion_jobs/${id}/reviews/decision`]:{...job.review}});return {...h,ref:h.db.doc(`account_deletion_jobs/${id}`)};}
test('independent approved VIP decision queues existing engine once, with original audit preserved',async()=>{const h=fixture();assert.equal(await authorizeApprovedRequest(h.db,h.ref),true);const j=(await h.ref.get()).data();assert.equal(j.review.processingAuthorized,true);assert.equal(j.processingProtocol,3);assert.equal(j.status,'queued');assert.equal(await authorizeApprovedRequest(h.db,h.ref),false);assert.equal(h.records.get(h.ref.path+'/reviews/decision').processingAuthorized,false);assert(h.records.has(h.ref.path+'/reviews/automatic_processing'));});
test('self review, revoked manager role, missing audit and UID mismatch cannot authorize processing',async()=>{for(const mode of ['self','role','audit','uid']){const h=fixture();if(mode==='self')h.records.get(h.ref.path).review.reviewerId='resident';if(mode==='role')h.records.get('users/manager').role='resident';if(mode==='audit')h.records.delete(h.ref.path+'/reviews/decision');if(mode==='uid')h.records.get(h.ref.path).uid='other';await assert.rejects(authorizeApprovedRequest(h.db,h.ref));assert.equal((await h.ref.get()).data().review.processingAuthorized,false);}});
test('rejected or unreviewed requests cannot be activated',async()=>{for(const decision of ['rejected',null]){const h=fixture();h.records.get(h.ref.path).review.decision=decision;assert.equal(await authorizeApprovedRequest(h.db,h.ref),false);}});
test('Inbox v3 removes only deleted-account membership/content and preserves other participants',()=>{
 const uid='resident',alias='deleted_fixture';
 const conversation={schemaVersion:3,type:'private',memberIds:[uid,'bob'],memberRefs:{[uid]:'m1',bob:'m2'},residentId:''};
 const patch=retention.plan('inbox_conversations',conversation,uid,alias).patch;
 assert.deepEqual(patch.memberIds,['bob']);assert.deepEqual(patch.memberRefs,{bob:'m2'});assert.equal(patch.status,'read_only');
 assert.equal(retention.plan('inbox_memberships',{uid},uid).action,'delete_record');
 assert.equal(retention.plan('inbox_messages',{senderId:uid,body:'private fixture'},uid).action,'delete_record');
 const other={senderId:'bob',body:'preserved fixture',visibility:['resident:1','bob:1']};
 const otherPatch=retention.plan('inbox_messages',other,uid).patch;
 assert.deepEqual({...other,...otherPatch},{senderId:'bob',body:'preserved fixture',visibility:['bob:1']});
 assert.equal(retention.plan('inbox_legacy_authorizations',{uid},uid).action,'review');
});
