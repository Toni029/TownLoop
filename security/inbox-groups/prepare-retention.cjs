// Local packaging only. Never deploys, enables schedules, fetches records or changes IAM.
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
function prepareRetention(baselineFile,output){
 if(!baselineFile)throw Error('Supply the freshly reviewed live default-database rule baseline.');
 const root=path.resolve(__dirname,'../..'),out=output||path.join(root,'.release/inbox-retention'),folder=path.join(out,'functions');
 const baseline=fs.readFileSync(baselineFile,'utf8');
 const needle="return groupApproved() && m.uid == request.auth.uid && m.status == 'active' &&";
 const fence="return groupApproved() && c.status != 'cleanup_in_progress' && m.uid == request.auth.uid && m.status == 'active' &&";
 if(!baseline.includes(fence)&&baseline.split(needle).length!==2)throw Error('Unexpected groupAccess baseline: manual review required.');
 const rules=baseline.includes(fence)?baseline:baseline.replace(needle,fence);
 fs.mkdirSync(folder,{recursive:true});
 for(const file of ['referenceWriteBarrier.cjs','inbox-retention-entry.cjs','inbox-retention-monitor.cjs','inbox-retention.cjs','inbox-group-cleanup-runner.cjs','inbox-group-cleanup.cjs',
  'inbox-groups-entry.cjs','inbox-groups.cjs','inbox-group-roles.cjs','inbox-group-legacy.cjs','inbox-legacy-leave.cjs','inbox-groups-push.cjs','inbox.cjs','inbox-push.cjs','inbox-policy.cjs','notification-events.cjs','package-lock.json'])fs.copyFileSync(path.join(root,'functions',file),path.join(folder,file));
 fs.writeFileSync(path.join(folder,'package.json'),JSON.stringify(require(path.join(root,'functions/package.json')),null,2));
 fs.writeFileSync(path.join(folder,'index.cjs'),"require('firebase-admin/app').initializeApp();\nconst groups=require('./inbox-groups-entry.cjs');\nexports.manageInboxConversation=groups.manageInboxConversation;\nexports.revokeInboxGroupMemberships=groups.revokeInboxGroupMemberships;\nObject.assign(exports,require('./inbox-retention-entry.cjs'));\n");
 // Other deployed notification settings MUST be preserved, not replaced by an old .env.
 fs.writeFileSync(path.join(folder,'.env.cc-livingcommunity-app'),'INBOX_RETENTION_MONITOR_ENABLED=false\nINBOX_RETENTION_CLEANUP_ENABLED=false\n',{mode:0o600});
 fs.writeFileSync(path.join(out,'firestore.rules'),rules);
 const indexes=[{collectionGroup:'messages',queryScope:'COLLECTION',fields:[{fieldPath:'type',order:'ASCENDING'},{fieldPath:'createdAt',order:'DESCENDING'}]}];
 fs.writeFileSync(path.join(out,'index-create-requests.json'),JSON.stringify({mode:'create-only',deleteRequests:[],requests:indexes.map(i=>({method:'POST',url:`https://firestore.googleapis.com/v1/projects/cc-livingcommunity-app/databases/(default)/collectionGroups/${i.collectionGroup}/indexes`,body:{queryScope:i.queryScope,fields:i.fields}}))},null,2));
 fs.writeFileSync(path.join(out,'firebase.json'),JSON.stringify({functions:[{source:'functions',codebase:'default',runtime:'nodejs22',ignore:['node_modules','*.test.cjs']}],firestore:[{database:'(default)',rules:'firestore.rules'}]},null,2));
 fs.writeFileSync(path.join(out,'scope.json'),JSON.stringify({project:'cc-livingcommunity-app',database:'(default)',
  functions:['manageInboxConversation','revokeInboxGroupMemberships','monitorInboxRetention','cleanupExpiredInboxConversations'],monitorEnabled:false,cleanupEnabled:false,
  baselineSHA256:createHash('sha256').update(baseline).digest('hex'),preserveExistingEnvironment:true,activationRequiresSeparateApproval:true,hosting:false,storageRules:false,namedDatabase:false},null,2));
 return out;
}
module.exports={prepareRetention};if(require.main===module)console.log(prepareRetention(process.argv[2],process.argv[3]));
