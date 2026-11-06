const {test}=require('node:test'),assert=require('node:assert/strict');
const {PINS,validatePolicy,mediaDeletionDisabled}=require('../../functions/databaseCleanupSafety.cjs');
test('policy requires explicit approved scope and exact deployed rules pins',()=>{
 const policy={...PINS,version:1,ownerApproved:true,storageMode:'hold-unproven-media',genericMediaCleanupDisabledAcknowledged:true};
 assert.equal(validatePolicy(policy),true);
 for(const override of [{ownerApproved:false},{database:'legacy'},{defaultRulesSha256:'old'},{storageRulesSha256:'wrong'},{storageMode:'delete-all'},{genericMediaCleanupDisabledAcknowledged:false}])assert.equal(validatePolicy({...policy,...override}),false);
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
