// Local artifacts only. Never deploys, activates senders, or imports deletion workers.
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const names={registration:['registerInboxDevice','getNotificationState'],events:['notifyInboxFriend','notifyInboxOffice','notifyInboxMaintenance','notifyInboxMarketplace','notifyDiscussion','notifyWorkOrderDone']};
function entry(stage){
 if(!Object.hasOwn(names,stage))throw Error('Choose registration or events; receipt scheduler is not included.');
 return `require('firebase-admin/app').initializeApp();\nconst prepared=require('./inbox.cjs');\n${names[stage].map(name=>`exports.${name}=prepared.${name};`).join('\n')}\n`;
}
function prepare(stage='registration'){
 const root=path.resolve(__dirname,'../..'),out=path.join(root,`.release/notification-${stage}`),source=path.join(out,'functions');
 const index=entry(stage);fs.mkdirSync(source,{recursive:true});
 for(const file of ['inbox.cjs','inbox-policy.cjs','inbox-push.cjs','notification-events.cjs','package-lock.json'])fs.copyFileSync(path.join(root,'functions',file),path.join(source,file));
 fs.writeFileSync(path.join(source,'package.json'),JSON.stringify({...require(path.join(root,'functions/package.json')),main:'index.cjs'},null,2));
 fs.writeFileSync(path.join(source,'index.cjs'),index);
 fs.writeFileSync(path.join(source,'.env.cc-livingcommunity-app'),'INBOX_PUSH_ENABLED=false\nPUSH_RECIPIENT_SCOPE=testers\nDISCUSSION_REPLIES_ENABLED=false\nPUSH_TESTER_UIDS=\nPUSH_TESTER_PLATFORMS=android\n',{mode:0o600});
 fs.writeFileSync(path.join(out,'firebase.json'),JSON.stringify({functions:[{source:'functions',codebase:'default',runtime:'nodejs22',ignore:['node_modules','.git','*.test.cjs']}]},null,2));
 fs.writeFileSync(path.join(out,'scope.json'),JSON.stringify({project:'cc-livingcommunity-app',database:'(default)',region:'us-central1',exports:names[stage],sendingEnabled:false,schedulers:[],destructiveWorkers:[]},null,2));
 if(stage==='registration'){
  const rules=path.join(root,'.release/notification-rules');fs.mkdirSync(rules,{recursive:true});
  const baseline=fs.readFileSync(path.join(root,'firestore.rules'),'utf8'),candidate=fs.readFileSync(path.join(__dirname,'firestore-replies.candidate.rules'),'utf8');
  fs.writeFileSync(path.join(rules,'firestore.rules'),candidate);
  fs.writeFileSync(path.join(rules,'firebase.json'),JSON.stringify({firestore:[{database:'(default)',rules:'firestore.rules'}]},null,2));
  fs.writeFileSync(path.join(rules,'scope.json'),JSON.stringify({project:'cc-livingcommunity-app',database:'(default)',expectedCurrentRulesSHA256:createHash('sha256').update(baseline).digest('hex'),candidateSHA256:createHash('sha256').update(candidate).digest('hex'),hosting:false,storage:false,namedDatabase:false},null,2));
  const indexes=require('./notification.indexes.json').indexes;
  fs.writeFileSync(path.join(out,'index-create-requests.json'),JSON.stringify({mode:'create-only',deleteRequests:[],requests:indexes.map(i=>({method:'POST',url:'https://firestore.googleapis.com/v1/projects/cc-livingcommunity-app/databases/(default)/collectionGroups/notification_events/indexes',body:{queryScope:i.queryScope,fields:i.fields}}))},null,2));
 }

 console.log(`Prepared ${stage} artifact locally: ${names[stage].join(', ')}. Sending OFF; no scheduler or deployment.`);
 return out;
}
module.exports={entry,prepare};
if(require.main===module)prepare(process.argv[2]||'registration');
