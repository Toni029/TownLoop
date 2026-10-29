const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {prepare}=require('./prepare.cjs');
const baseline=path.resolve(__dirname,'../inbox-push/firestore-replies.candidate.rules');
test('Stage A package has create-only index requests, exact deployment scope and no destructive exports',()=>{
 const out=prepare(baseline),scope=JSON.parse(fs.readFileSync(path.join(out,'scope.json')));
 const requests=JSON.parse(fs.readFileSync(path.join(out,'index-create-requests.json')));
 assert.equal(requests.mode,'create-only');assert.equal(requests.requests.length,3);assert.deepEqual(requests.deleteRequests,[]);
 assert(requests.requests.every(r=>r.method==='POST'&&r.url.includes('/databases/(default)/collectionGroups/')));
 assert.equal(scope.stageBExported,false);assert.equal(scope.stageAEnabled,false);
 assert.deepEqual(scope.requiredFunctions,['manageInboxConversation','revokeInboxGroupMemberships','registerInboxDevice','getNotificationState','notifyInboxGroupMessage']);
 assert(!fs.existsSync(path.join(out,'functions/inbox-group-cleanup-runner.cjs')));
 const entry=fs.readFileSync(path.join(out,'functions/index.cjs'),'utf8');assert(!entry.includes('cleanup'));
 const config=JSON.parse(fs.readFileSync(path.join(out,'firebase.json')));assert.equal(config.firestore[0].database,'(default)');assert(!config.firestore[0].indexes);
 const env=fs.readFileSync(path.join(out,'functions/.env.cc-livingcommunity-app'),'utf8');assert(env.includes('INBOX_GROUPS_ENABLED=false'));assert(env.includes('INBOX_GROUP_PUSH_ENABLED=false'));
});
test('prepared dependency closure is complete and an already-patched baseline is rejected',()=>{
 const out=prepare(baseline),directory=path.join(out,'functions');
 for(const name of fs.readdirSync(directory).filter(n=>n.endsWith('.cjs'))){
  const content=fs.readFileSync(path.join(directory,name),'utf8');
  for(const [,local]of content.matchAll(/require\(['"](\.\/[^'"]+)['"]\)/g))assert(fs.existsSync(path.join(directory,local)),`${name}: missing ${local}`);
 }
 assert.throws(()=>prepare(path.join(out,'firestore.rules')),/Stage A already present/);
});
