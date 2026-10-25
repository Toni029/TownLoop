const test = require('node:test');
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const path = require('node:path');
test('isolated artifact exports only five callables even with destructive flags enabled', () => {
  execFileSync(process.execPath, ['tools/prepare-deletion-review.cjs'], {cwd:__dirname});
  const output = execFileSync(process.execPath, ['-e', `
    const handlers=require('./index.cjs');
    console.log(JSON.stringify({names:Object.keys(handlers).sort(), forbidden:Object.keys(require.cache).filter(p=>/accountDeletionV2|mediaCleanup|accountDeletion\\.cjs|v2[/\\\\]scheduler/.test(p))}));
  `], {cwd:path.resolve(__dirname,'../.release/deletion-review'),encoding:'utf8',env:{...process.env,GCLOUD_PROJECT:'demo-townloop',FIREBASE_CONFIG:'{"projectId":"demo-townloop"}',TOWNLOOP_FIRESTORE_DATABASE_ID:'(default)',TOWNLOOP_ACCOUNT_DELETION_ENABLED:'true',TOWNLOOP_MEDIA_CLEANUP_ENABLED:'true',TOWNLOOP_DELETION_REVIEW_MONITOR_ENABLED:'true'}});
  const result=JSON.parse(output.trim());
  assert.deepEqual(result.names,['getAccountDeletionStatus','listAccountDeletionRequests','requestAccountDeletion','reviewAccountDeletionRequest','submitAccountDeletionRequest']);
  assert.deepEqual(result.forbidden,[]);
});
