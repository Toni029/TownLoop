// Run only against paired local Firestore/Storage emulators loaded with the cleanup candidates.
import {test} from 'node:test';
import assert from 'node:assert/strict';
const fireHost = process.env.FIRESTORE_EMULATOR_HOST;
const storageHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
for (const host of [fireHost, storageHost]) if (!/^127\.0\.0\.1:\d+$/.test(host || '')) throw Error('Explicit loopback Firestore and Storage emulators required');
const project = 'demo-townloop-cleanup-storage', bucket = project + '.appspot.com';
const fire = `http://${fireHost}/v1/projects/${project}/databases/(default)/documents`;
const store = `http://${storageHost}/v0/b/${bucket}/o`;
const run = String(Date.now());
const jwt = uid => {
  const b = o => Buffer.from(JSON.stringify(o)).toString('base64url'), now = Math.floor(Date.now() / 1000);
  return `${b({alg: 'none', typ: 'JWT'})}.${b({sub: uid, user_id: uid, aud: project, iss: `https://securetoken.google.com/${project}`, iat: now, exp: now + 3600, firebase: {sign_in_provider: 'custom'}})}.`;
};
const auth = uid => ({Authorization: 'Firebase ' + jwt(uid)});
const field = v => typeof v === 'boolean' ? {booleanValue: v} : {stringValue: v};
async function seed(path, data) {
  const r = await fetch(fire + '/' + path, {method: 'PATCH', headers: {Authorization: 'Bearer owner', 'Content-Type': 'application/json'}, body: JSON.stringify({fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, field(v)]))})});
  assert.equal(r.status, 200, await r.text());
}
const allowed = r => assert.ok(r.status >= 200 && r.status < 300, 'Expected allow, got ' + r.status);
const denied = r => assert.ok([401, 403].includes(r.status), 'Expected deny, got ' + r.status);
const name = suffix => `newsletters/barrier-${run}-${suffix}/document.pdf`;
async function start(path, uid = 'admin') {
  return fetch(store + '?name=' + encodeURIComponent(path), {method: 'POST', headers: {...auth(uid), 'Content-Type': 'application/json', 'X-Goog-Upload-Protocol': 'resumable', 'X-Goog-Upload-Command': 'start', 'X-Goog-Upload-Header-Content-Length': '4', 'X-Goog-Upload-Header-Content-Type': 'application/pdf'}, body: JSON.stringify({name: path, contentType: 'application/pdf', metadata: {uploadedBy: uid}})});
}
async function finish(started, uid = 'admin') {
  if (!started.ok) return started;
  const url = started.headers.get('X-Goog-Upload-URL');
  assert.equal(new URL(url).host, storageHost, 'Never finalize against a non-loopback host');
  return fetch(url, {method: 'POST', headers: {...auth(uid), 'Content-Type': 'application/pdf', 'X-Goog-Upload-Command': 'upload, finalize', 'X-Goog-Upload-Offset': '0'}, body: Buffer.from('test')});
}
const upload = async (path, uid = 'admin') => finish(await start(path, uid), uid);
const object = (path, method = 'GET', uid = 'admin', data) => fetch(store + '/' + encodeURIComponent(path), {method, headers: {...auth(uid), ...(data ? {'Content-Type': 'application/json'} : {})}, ...(data ? {body: JSON.stringify(data)} : {})});

test('Storage runtime blocks create, update, delete and delayed finalization only while default-database barrier is true', async () => {
  for (const role of ['admin', 'vip', 'resident', 'crew']) await seed('users/' + role, {approved: true, role});
  await seed('database_cleanup_control/active', {});
  allowed(await upload(name('missing')));
  await seed('database_cleanup_control/active', {referenceWritesBlocked: false});
  for (const role of ['admin', 'vip']) allowed(await upload(name(role), role));
  denied(await upload(name('resident-forbidden'), 'resident'));
  denied(await upload(name('crew-forbidden'), 'crew'));
  allowed(await object(name('admin'), 'PATCH', 'admin', {metadata: {uploadedBy: 'descriptive-name'}}));
  // A resumable upload begun before confirmation must not finalize during cleanup.
  const pending = await start(name('delayed'));
  allowed(pending);
  await seed('database_cleanup_control/active', {referenceWritesBlocked: true});
  for (const role of ['admin', 'vip']) {
    denied(await upload(name('blocked-' + role), role));
    denied(await object(name(role), 'PATCH', role, {metadata: {uploadedBy: 'changed'}}));
    denied(await object(name(role), 'DELETE', role));
    allowed(await object(name(role), 'GET', role));
  }
  denied(await finish(pending));
  await seed('database_cleanup_control/active', {referenceWritesBlocked: false});
  allowed(await upload(name('released')));
  allowed(await object(name('admin'), 'PATCH', 'admin', {metadata: {uploadedBy: 'restored'}}));
  allowed(await object(name('admin'), 'DELETE'));
  const removed = await fetch(fire + '/database_cleanup_control/active', {method: 'DELETE', headers: {Authorization: 'Bearer owner'}});
  assert.equal(removed.status, 200);
  allowed(await upload(name('absent')));
});
