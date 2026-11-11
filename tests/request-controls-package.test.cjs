const {test}=require('node:test'),assert=require('node:assert/strict'),cp=require('node:child_process');
test('scoped package exports no schedules, push triggers, cleanup or account-deletion worker',()=>{
 const out=require('../security/abuse-controls/prepare.cjs').prepare();
 const result=JSON.parse(cp.execFileSync(process.execPath,['-e',"const e=require('./index.cjs');console.log(JSON.stringify(Object.keys(e).sort()))"],{cwd:out,encoding:'utf8',env:{...process.env,GCLOUD_PROJECT:'demo-townloop-abuse',FIREBASE_CONFIG:'{"projectId":"demo-townloop-abuse"}'}}));
 assert.deepEqual(result,['completeMediaUpload','issueMediaUpload','issueNewsletterUpload','manageInboxConversation','previewDatabaseCleanup','reviewAccountDeletionRequest','translateWorkOrder']);
});

test('private inventory package keeps its original read-only identity and only the gateway invoker',()=>{
 const path=require('node:path'),fs=require('node:fs');const folder=path.resolve('.release/request-inventory-readonly');const source=fs.readFileSync(path.join(folder,'index.cjs'),'utf8');assert.match(source,/invoker:\['townloop-request-controls@cc-livingcommunity-app.iam.gserviceaccount.com'\]/);assert.match(source,/townloop-cleanup-preview/);const names=JSON.parse(cp.execFileSync(process.execPath,['-e',"console.log(JSON.stringify(Object.keys(require('./index.cjs'))))"],{cwd:folder,encoding:'utf8',env:{...process.env,GCLOUD_PROJECT:'demo-townloop-abuse',FIREBASE_CONFIG:'{"projectId":"demo-townloop-abuse"}'}}));assert.deepEqual(names,['readOnlyDatabaseCleanupInventory']);
});
