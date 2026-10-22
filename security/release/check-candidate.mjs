// Offline preparation checks only: no Firebase SDK, credentials, network or mutations.
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = p => readFileSync(path.join(root, p), 'utf8');
const json = p => JSON.parse(read(p));
const assert = (ok, message) => { if (!ok) throw Error(message); };
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
assert(git('branch', '--show-current') === 'native/expo-migration', 'Wrong release branch');
git('merge-base', '--is-ancestor', 'fb8c146', 'HEAD');
const candidate = json('security/release/candidate-manifest.json');
for (const [file, hash] of Object.entries(candidate.sha256)) {
  assert(createHash('sha256').update(readFileSync(path.join(root, file))).digest('hex') === hash, `Candidate drift: ${file}`);
}
for (const [source, target] of [['firestore.rules', 'security/release/firestore.coordinated.rules'], ['firestore.indexes.json', 'security/release/firestore.coordinated.indexes.json'], ['security/storage.proposed.rules', 'security/release/storage.coordinated.rules']]) assert(read(source) === read(target), `Snapshot mismatch: ${target}`);
const rulesConfig = json('security/release/firebase.coordinated.json');
const backend = json('firebase.release-backend.json');
assert(!rulesConfig.hosting && !backend.hosting, 'Hosting must remain excluded');
assert(backend.functions.length === 1 && backend.functions[0].source === 'functions' && backend.functions[0].codebase === 'work-order-retention', 'Unexpected backend scope');
const app = json('native/app.json').expo, eas = json('native/eas.json');
assert(app.android.package === 'com.toni029.townloop', 'Android identity changed');
assert(app.extra.eas.projectId === '9f970d26-beed-44d6-a590-9dcdc00e85de', 'EAS project changed');
assert(app.runtimeVersion.policy === 'fingerprint', 'Preserve fingerprint compatibility');
assert(app.updates.url === `https://u.expo.dev/${app.extra.eas.projectId}` && app.updates.checkAutomatically === 'ON_LOAD', 'Update configuration changed');
assert(eas.build.preview.channel === 'preview' && eas.build.production.channel === 'production' && eas.build.preview.channel !== eas.build.production.channel, 'Channels not isolated');
assert(eas.build.preview.android.buildType === 'apk' && eas.build.production.android.buildType === 'app-bundle', 'Wrong Android outputs');
assert(app.android.allowBackup === false, 'Android backup must remain disabled');
assert(app.plugins.some(p => p === './plugins/withLocalDataProtection.cjs'), 'Backup exclusion plugin missing');
assert(app.plugins.some(p => Array.isArray(p) && p[0] === 'expo-secure-store'), 'SecureStore plugin missing');
assert(json('native/package.json').dependencies['expo-secure-store'], 'SecureStore dependency missing');
assert(existsSync(path.join(root, app.android.package && 'native/assets/icon.png')), 'App icon missing');
const policy = json('security/release/retention-policy.UNAPPROVED.json');
assert(policy.account.ownerApproved === false && policy.media.ownerApproved === false, 'Do not approve policies through preparation');
const fragment = json('security/release/monitoring.native.fragment.json');
assert(fragment.nativeFirebaseJson['react-native'].crashlytics_auto_collection_enabled === false, 'Telemetry must remain inactive');
console.log(JSON.stringify({ status: 'RC_PREPARED_DEPLOYMENT_HELD', checks: 'candidate hashes, backend scope, APK/SecureStore/backup configuration, OTA channels, inactive policies/monitoring', network: false, deployed: false, requiredApprovals: ['retention/privacy', 'default-db migrations/cutover', 'shared-bucket website compatibility', 'monitoring configuration', 'remaining dependency advisories', 'push/deploy/build/OTA'] }, null, 2));
