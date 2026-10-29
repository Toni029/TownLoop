// Local incremental release artifact, using an exact reviewed deployed Stage A baseline.
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const {patchLegacyLeaveRules}=require('./legacy-leave-rules.cjs');
function prepareLegacyLeave(file, output){
 if(!file)throw Error('Supply the verified CURRENT default Stage A rules.');
 const baseline=fs.readFileSync(file,'utf8'),rules=patchLegacyLeaveRules(baseline);
 const root=path.resolve(__dirname,'../..'),out=output||path.join(root,'.release/inbox-legacy-leave'),folder=path.join(out,'functions');fs.mkdirSync(folder,{recursive:true});
 for(const name of ['inbox-groups-entry.cjs','inbox-groups.cjs','inbox-groups-push.cjs','inbox-group-legacy.cjs','inbox-legacy-leave.cjs','inbox-group-roles.cjs','inbox.cjs','inbox-push.cjs','inbox-policy.cjs','notification-events.cjs','package-lock.json'])fs.copyFileSync(path.join(root,'functions',name),path.join(folder,name));
 const names=['manageInboxConversation','getNotificationState','notifyInboxFriend','notifyInboxOffice','notifyInboxMaintenance'];
 fs.writeFileSync(path.join(folder,'index.cjs'),"require('firebase-admin/app').initializeApp();\nexports.manageInboxConversation=require('./inbox-groups-entry.cjs').manageInboxConversation;\nconst inbox=require('./inbox.cjs');\n"+names.slice(1).map(n=>`exports.${n}=inbox.${n};`).join('\n')+'\n');
 fs.writeFileSync(path.join(folder,'package.json'),JSON.stringify(require(path.join(root,'functions/package.json')),null,2));
 fs.writeFileSync(path.join(folder,'.env.cc-livingcommunity-app'),'INBOX_GROUPS_ENABLED=false\nINBOX_GROUP_PUSH_ENABLED=false\nINBOX_PUSH_ENABLED=false\n',{mode:0o600});
 fs.writeFileSync(path.join(out,'firestore.rules'),rules);fs.writeFileSync(path.join(out,'firebase.json'),JSON.stringify({functions:[{source:'functions',codebase:'default',runtime:'nodejs22',ignore:['node_modules','*.test.cjs']}],firestore:[{database:'(default)',rules:'firestore.rules'}]},null,2));
 fs.writeFileSync(path.join(out,'scope.json'),JSON.stringify({project:'cc-livingcommunity-app',database:'(default)',exports:names,deployOnly:names.map(n=>'functions:'+n).join(','),baselineSHA256:createHash('sha256').update(baseline).digest('hex'),requiredIndexes:[],stageBExported:false,preserveExistingDeliveryEnvironment:true,activationRequiresApproval:true},null,2));return out;
}
module.exports={prepareLegacyLeave};if(require.main===module)console.log(prepareLegacyLeave(process.argv[2]));
