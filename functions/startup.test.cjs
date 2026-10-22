const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

test('both request callables load without an implicit default Storage bucket', () => {
  const result = spawnSync(process.execPath, ['-e', `
    const functions = require('./index.cjs');
    if (typeof functions.requestAccountDeletion !== 'function' ||
        typeof functions.submitAccountDeletionRequest !== 'function') process.exit(2);
  `], {
    cwd: __dirname,
    env: { ...process.env, GCLOUD_PROJECT: 'cc-livingcommunity-app',
      FIREBASE_CONFIG: JSON.stringify({ projectId: 'cc-livingcommunity-app' }) },
    encoding: 'utf8', timeout: 10000,
  });
  assert.equal(result.status, 0, result.stderr);
});
