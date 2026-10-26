const test=require('node:test'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process'),path=require('node:path');
test('isolated monitor artifact cannot import or export deletion processing',()=>{
 execFileSync(process.execPath,['tools/prepare-deletion-monitor.cjs'],{cwd:__dirname});
 const raw=execFileSync(process.execPath,['-e',`
 const handlers=require('./index.cjs');
 console.log(JSON.stringify({names:Object.keys(handlers),forbidden:Object.keys(require.cache).filter(p=>/accountDeletionV2|mediaCleanup|accountDeletion\\.cjs|accountDeletionReview/.test(p))}));
 `],{cwd:path.resolve(__dirname,'../.release/deletion-monitor'),encoding:'utf8',env:{...process.env,GCLOUD_PROJECT:'demo-townloop',FIREBASE_CONFIG:'{"projectId":"demo-townloop"}',TOWNLOOP_FIRESTORE_DATABASE_ID:'(default)',TOWNLOOP_ACCOUNT_DELETION_ENABLED:'true',TOWNLOOP_MEDIA_CLEANUP_ENABLED:'true',TOWNLOOP_DELETION_REVIEW_MONITOR_ENABLED:'true',TOWNLOOP_DELETION_ADMIN_ALERTS_ENABLED:'true'}});
 const result=JSON.parse(raw.trim());assert.deepEqual(result.names,['escalateAccountDeletionRequests']);assert.deepEqual(result.forbidden,[]);
});
