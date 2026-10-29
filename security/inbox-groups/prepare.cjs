// Produces local artifacts only. Never invokes firebase deploy or touches live data.
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
function prepare(baselineFile){
 if(!baselineFile)throw Error('Supply the reviewed default-database baseline rules path.');
 const root=path.resolve(__dirname,'../..'),out=path.join(root,'.release/inbox-groups');
 const baseline=fs.readFileSync(baselineFile,'utf8');let rules=baseline;
 for(const name of ['resident_chats','office_chats','maintenance_chats']){
  const start=rules.indexOf(`match /${name}/{chatId}`),end=rules.indexOf('\n    }',start);
  if(start<0||end<0)throw Error('Unexpected legacy Inbox rule structure.');
  let block=rules.slice(start,end);
  block=block.replace(/allow get: if /g,`allow get: if (!exists(/databases/$(database)/documents/${name}/$(chatId)) || legacyGroupAccess(resource.data)) && `).replace(/allow list: if /g,'allow list: if legacyGroupAccess(resource.data) && ')
    .replace(/allow create: if /g,"allow create: if !('groupConversationId' in request.resource.data) && ")
    .replace(/allow (update|delete): if /g,"allow $1: if !('groupConversationId' in resource.data) && !('groupConversationId' in request.resource.data) && ");
  // delete has no request.resource; an absent request.resource must not deny unchanged legacy deletion.
  block=block.replace(/allow delete: if !\('groupConversationId' in resource.data\) && !\('groupConversationId' in request.resource.data\) && /g,"allow delete: if !('groupConversationId' in resource.data) && ");
  block=block.replace(/allow delete: if [^;]+;/g,'allow delete: if false; // Stage B requires separate backend approval.');
  rules=rules.slice(0,start)+block+rules.slice(end);
 }
 const fragment=fs.readFileSync(path.join(__dirname,'firestore.fragment.rules'),'utf8');
 const insert=rules.lastIndexOf('\n  }');if(insert<0)throw Error('Unexpected rule root.');
 rules=rules.slice(0,insert)+'\n'+fragment+rules.slice(insert);
 fs.mkdirSync(path.join(out,'functions'),{recursive:true});
 for(const file of ['inbox-groups-entry.cjs','inbox-groups.cjs','inbox-groups-push.cjs','inbox-group-legacy.cjs','inbox-group-roles.cjs','inbox.cjs','inbox-push.cjs','inbox-policy.cjs','notification-events.cjs','package-lock.json'])fs.copyFileSync(path.join(root,'functions',file),path.join(out,'functions',file));
 fs.writeFileSync(path.join(out,'functions/package.json'),JSON.stringify({...require(path.join(root,'functions/package.json')),main:'index.cjs'},null,2));
 fs.writeFileSync(path.join(out,'functions/index.cjs'),"require('firebase-admin/app').initializeApp();\nObject.assign(exports,require('./inbox-groups-entry.cjs'));\nexports.getNotificationState=require('./inbox.cjs').getNotificationState;\nexports.registerInboxDevice=require('./inbox.cjs').registerInboxDevice;\n");
 fs.writeFileSync(path.join(out,'functions/.env.cc-livingcommunity-app'),'INBOX_GROUPS_ENABLED=false\nINBOX_GROUP_PUSH_ENABLED=false\nINBOX_PUSH_ENABLED=false\nPUSH_RECIPIENT_SCOPE=testers\nPUSH_TESTER_UIDS=\nPUSH_TESTER_PLATFORMS=android\n',{mode:0o600});
 fs.writeFileSync(path.join(out,'firestore.rules'),rules);
 fs.writeFileSync(path.join(out,'indexes.json'),fs.readFileSync(path.join(__dirname,'indexes.json')));
 fs.writeFileSync(path.join(out,'firebase.json'),JSON.stringify({functions:[{source:'functions',codebase:'default',runtime:'nodejs22',ignore:['node_modules','*.test.cjs']}],firestore:[{database:'(default)',rules:'firestore.rules'}]},null,2));
 fs.writeFileSync(path.join(out,'scope.json'),JSON.stringify({project:'cc-livingcommunity-app',database:'(default)',exports:['manageInboxConversation','notifyInboxGroupMessage','revokeInboxGroupMemberships','getNotificationState','registerInboxDevice'],stageAEnabled:false,pushEnabled:false,stageBExported:false,baselineSHA256:createHash('sha256').update(baseline).digest('hex'),hosting:false,storageRules:false,namedDatabase:false},null,2));
 return out;
}
if(require.main===module)console.log(prepare(process.argv[2]));module.exports={prepare};
