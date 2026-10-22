const test = require('node:test');
const assert = require('node:assert/strict');
const { directoryProjection, syncDirectoryProfile } = require('./profilePrivacyPolicy.cjs');
const { planDirectoryMigration } = require('./tools/planResidentDirectory.cjs');
const sensitive = { role: 'resident', approved: true, name: 'Ada', avatar_url: 'https://example.test/a.png', email: 'private@example.test', phone: 'private', address: 'private', dateOfBirth: 'private', emergencyContact: { name: 'private' }, profileUpdateRequest: { previous: { phone: 'private' } }, isAdmin: true };
test('projection uses a fixed safe field allowlist and does not trust privilege aliases', () => {
  assert.deepEqual(directoryProjection('u1', sensitive), { uid: 'u1', name: 'Ada', avatarUrl: 'https://example.test/a.png', role: 'resident', approved: true });
  for (const role of ['staff', 'master admin', 'Admin', '', undefined]) assert.equal(directoryProjection('u1', { ...sensitive, role }), null);
  for (const approved of [false, undefined, 'true', 1]) assert.equal(directoryProjection('u1', { ...sensitive, approved }), null);
  assert.equal(directoryProjection('u1', null), null);
});
test('trusted sync reads current source transactionally and replaces rather than merges', async () => {
  let current = sensitive;
  const writes = [];
  const db = { doc: path => path, runTransaction: async action => action({
    get: async path => { assert.equal(path, 'users/u1'); return { exists: !!current, data: () => current }; },
    set: (...args) => writes.push(['set', ...args]), delete: (...args) => writes.push(['delete', ...args]),
  }) };
  await syncDirectoryProfile(db, 'u1');
  assert.deepEqual(writes[0], ['set', 'resident_directory/u1', directoryProjection('u1', sensitive)]);
  current = { ...sensitive, approved: false };
  await syncDirectoryProfile(db, 'u1');
  assert.deepEqual(writes[1], ['delete', 'resident_directory/u1']);
  current = null;
  await syncDirectoryProfile(db, 'u1');
  assert.deepEqual(writes[2], ['delete', 'resident_directory/u1']);
});
test('offline plan excludes pending users, deletes exported orphan IDs, and flags legacy roles', () => {
  const plan = planDirectoryMigration({ users: [
    { id: 'u1', data: sensitive }, { id: 'pending', data: { ...sensitive, approved: false } },
    { id: 'legacy', data: { ...sensitive, role: 'staff' } },
  ], directoryIds: ['u1', 'orphan'] });
  assert.equal(plan.offlineOnly, true);
  assert.equal(plan.operations.length, 4);
  assert.deepEqual(plan.operations.filter(o => o.operation === 'delete').map(o => o.path), ['resident_directory/pending', 'resident_directory/legacy', 'resident_directory/orphan']);
  assert.deepEqual(plan.review, [{ uid: 'legacy', reason: 'noncanonical-role' }]);
  assert.equal(JSON.stringify(plan).includes('private'), false);
  assert.throws(() => planDirectoryMigration({ users: [{ id: 'bad/id', data: sensitive }] }), /Invalid/);
  assert.throws(() => planDirectoryMigration({ users: [{ id: 'u1', data: sensitive }, { id: 'u1', data: sensitive }] }), /duplicate/);
});

test('web and native normalizers never promote legacy privilege flags or infer approval', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const vm = require('node:vm');
  const ts = require('../node_modules/typescript');
  function localExports(relative) {
    const source = fs.readFileSync(path.join(__dirname, relative), 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const exports = {};
    // Stub every import so this is strictly offline: no Firebase module initialization.
    vm.runInNewContext(compiled, { exports, require: () => ({}), console });
    return exports;
  }
  const web = localExports('../src/services/auth.ts').normalizeUserProfile;
  const native = localExports('../native/src/lib/profile.ts').readProfile;
  for (const read of [data => web('u1', data), native]) {
    const forged = read({ role: 'resident', approved: true, isAdmin: true, isVip: true, isCrew: true, roles: ['admin'], badges: ['vip'], userRole: 'admin' });
    assert.equal(forged.role, 'resident');
    assert.equal(forged.approved, true);
    for (const role of ['staff', 'master admin', 'Admin', ['admin'], { role: 'admin' }, undefined]) assert.equal(read({ role, approved: true, isAdmin: true }).role, '');
    for (const approved of [false, undefined, 'true', 1]) assert.equal(read({ role: 'admin', approved }).approved, false);
  }
  assert.equal(web('u1', { role: 'resident', approved: true, isAdmin: true }).isAdmin, false);
  assert.equal(web('u1', { role: 'admin', approved: false }).isAdmin, false);
});
