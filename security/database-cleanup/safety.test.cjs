const {test}=require('node:test'),assert=require('node:assert/strict');
const {PINS,validatePolicy,mediaDeletionDisabled,referenceWritersVerified,inventoryDigest,REQUIRED_WRITERS}=require('../../functions/databaseCleanupSafety.cjs');
test('policy requires explicit approved scope and exact deployed rules pins',()=>{
 const policy={...PINS,version:2,ownerApproved:true,storageMode:'exclusive-generation-fenced-v2',genericMediaCleanupDisabledAcknowledged:true};
 assert.equal(validatePolicy(policy),true);
 for(const override of [{ownerApproved:false},{database:'legacy'},{defaultRulesSha256:'old'},{storageRulesSha256:'wrong'},{storageMode:'delete-all'},{genericMediaCleanupDisabledAcknowledged:false}])assert.equal(validatePolicy({...policy,...override}),false);
});
test('all guarded writer revisions and entire deployed inventory must match the reviewed receipt',()=>{
 const inventory={functions:REQUIRED_WRITERS.map((entryPoint,i)=>({name:`projects/p/locations/r/functions/${entryPoint}`,buildConfig:{entryPoint},serviceConfig:{revision:`revision-${i}`}}))};
 const policy={functionInventorySha256:inventoryDigest(inventory),referenceWriterRevisions:Object.fromEntries(inventory.functions.map(fn=>[fn.name,fn.serviceConfig.revision]))};
 assert.equal(referenceWritersVerified(inventory,policy),true);
 assert.equal(referenceWritersVerified({...inventory,unreachable:['r']},policy),false);
 assert.equal(referenceWritersVerified({...inventory,functions:inventory.functions.slice(1)},policy),false);
 inventory.functions[0].serviceConfig.revision='unreviewed';assert.equal(referenceWritersVerified(inventory,policy),false);
 policy.functionInventorySha256=inventoryDigest(inventory);assert.equal(referenceWritersVerified(inventory,policy),false);
 policy.referenceWriterRevisions[inventory.functions[0].name]='unreviewed';assert.equal(referenceWritersVerified(inventory,policy),true);
 inventory.functions.push({name:'new-function',buildConfig:{entryPoint:'unknownWriter'},updateTime:'new-version'});assert.equal(referenceWritersVerified(inventory,policy),false);
});
test('generic deletion triggers/reapers or incomplete inventory block activation',()=>{
 assert.equal(mediaDeletionDisabled({functions:[]}),true);
 for(const entryPoint of ['cleanupDeleted_work_orders','cleanupDeleted_marketItems','cleanupLateOrphanMedia','resumeMediaCleanup','expireMediaDrafts']){
  assert.equal(mediaDeletionDisabled({functions:[{buildConfig:{entryPoint},serviceConfig:{environmentVariables:{TOWNLOOP_MEDIA_CLEANUP_ENABLED:'true'}}}]}),false);
  assert.equal(mediaDeletionDisabled({functions:[{buildConfig:{entryPoint},serviceConfig:{environmentVariables:{TOWNLOOP_MEDIA_CLEANUP_ENABLED:'false'}}}]}),true);
 }
 assert.equal(mediaDeletionDisabled({functions:[],nextPageToken:'more'}),false);
 assert.equal(mediaDeletionDisabled({functions:[],unreachable:['us-central1']}),false);
 assert.equal(mediaDeletionDisabled({functions:[{name:'projects/p/locations/r/functions/cleanupdeleted-work-orders'}]}),false);
 assert.equal(mediaDeletionDisabled({}),false);
});

test('cleanup cannot overlap an active or unverified account-deletion worker',()=>{
 for(const entryPoint of ['fulfillApprovedAccountDeletions','resumeAccountDeletions'])for(const flag of [undefined,'true','false']){
  const inventory={functions:[{buildConfig:{entryPoint},serviceConfig:{environmentVariables:{TOWNLOOP_ACCOUNT_DELETION_ENABLED:flag}}}]};
  assert.equal(mediaDeletionDisabled(inventory),flag==='false');
 }
});
