// Focused local-only rules regression tests. No SDK, Auth accounts or live Firebase access.
// FIRESTORE_EMULATOR_HOST=127.0.0.1:8897 node --test security/launch/launch.rules.test.mjs
import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const host = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8897';
if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host)) throw Error('Only a loopback Firestore emulator is allowed.');
const project = 'demo-townloop-launch';
const base = `http://${host}`;
const documents = `${base}/v1/projects/${project}/databases/(default)/documents`;
const admin = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
const profile = (id, role = 'resident', extra = {}) => ({ id, name: `Name ${id}`, email: `${id}@example.invalid`, role, approved: true, ...extra });
const profiles = {
  Alice: profile('Alice'), alice: profile('alice'), Bob: profile('Bob'), Outsider: profile('Outsider'), Admin: profile('Admin', 'admin'), Vip: profile('Vip', 'vip'), Crew: profile('Crew', 'crew'),
  Pending: profile('Pending', 'resident', { approved: false }), Aliases: profile('Aliases', 'resident', { isAdmin: true, isVip: true, isCrew: true }),
  Unapproved: profile('Unapproved', 'admin', { approved: false }), LegacyStaff: profile('LegacyStaff', 'staff'), MissingApproval: profile('MissingApproval', 'admin'),
};
delete profiles.MissingApproval.approved;
function token(uid, overrides = {}) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ iss: `https://securetoken.google.com/${project}`, aud: project, auth_time: now, user_id: uid, sub: uid,
    iat: now, exp: now + 3600, email: `${uid}@example.invalid`, email_verified: false, firebase: { sign_in_provider: 'custom', identities: {} }, ...overrides })}.`;
}
function value(input) {
  if (input === null) return { nullValue: null };
  if (input instanceof Date) return { timestampValue: input.toISOString() };
  if (Array.isArray(input)) return { arrayValue: { values: input.map(value) } };
  if (typeof input === 'object') return { mapValue: { fields: fields(input) } };
  if (typeof input === 'boolean') return { booleanValue: input };
  if (typeof input === 'number') return Number.isInteger(input) ? { integerValue: String(input) } : { doubleValue: input };
  return { stringValue: input };
}
function fields(input) { return Object.fromEntries(Object.entries(input).map(([key, item]) => [key, value(item)])); }
async function request(path, { method = 'GET', uid, data, owner = false, query = '' } = {}) {
  const response = await fetch(`${documents}/${path}${query}`, { method,
    headers: owner ? admin : { 'Content-Type': 'application/json', ...(uid ? { Authorization: `Bearer ${token(uid)}` } : {}) },
    ...(data === undefined ? {} : { body: JSON.stringify({ fields: fields(data) }) }),
  });
  const result = await response.json();
  return { status: response.status, result };
}
async function allowed(promise) { const result = await promise; assert.ok(result.status >= 200 && result.status < 300, JSON.stringify(result)); return result; }
async function denied(promise) { const result = await promise; assert.equal(result.status, 403, JSON.stringify(result)); }
const seed = (path, data) => allowed(request(path, { method: 'PATCH', owner: true, data }));
const write = (path, uid, data) => request(path, { method: 'PATCH', uid, data });
const read = (path, uid) => request(path, { uid });
const message = (uid, id = 'first', body = 'Hello') => ({ id, senderId: uid, senderName: profiles[uid].name, senderRole: profiles[uid].role, senderAvatar: '', body, createdAt: id === 'first' ? 1 : 2, time: 'Now' });
const friend = (id = 'friend') => ({ id, identityVersion: 2, participantIds: ['Alice', 'Bob'], participants: [{ id: 'Alice', name: profiles.Alice.name }, { id: 'Bob', name: profiles.Bob.name }],
  subject: 'Hello', messages: [message('Alice')], lastMessage: 'Hello', updatedAt: 1, unreadBy: ['Bob'] });
const service = (kind, id = 'Alice') => ({ id, residentId: 'Alice', residentName: profiles.Alice.name, residentEmail: '', residentApt: '', residentPhone: '', residentAvatar: '',
  subject: 'Hello', messages: [message('Alice')], lastMessage: 'Hello', updatedAt: 1, unreadByResident: false, [kind === 'office' ? 'unreadByVip' : 'unreadByCrew']: true });

before(async () => {
  const rules = await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8');
  const loaded = await fetch(`${base}/emulator/v1/projects/${project}:securityRules`, { method: 'PUT', headers: admin,
    body: JSON.stringify({ rules: { files: [{ name: 'firestore.rules', content: rules }] } }) });
  assert.equal(loaded.status, 200, await loaded.text());
  const cleared = await fetch(`${base}/emulator/v1/projects/${project}/databases/(default)/documents`, { method: 'DELETE', headers: admin });
  assert.equal(cleared.status, 200, await cleared.text());
  profiles.Deleting = profile('Deleting', 'resident', { deletionPending: true });
  for (const [uid, data] of Object.entries(profiles)) await seed(`users/${uid}`, data);
});

async function transformedWrite(path, uid, data, transforms = ['updatedAt']) {
  const response = await fetch(`${documents}:commit`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(uid ? { Authorization: `Bearer ${token(uid)}` } : {}) },
    body: JSON.stringify({ writes: [{ update: { name: `projects/${project}/databases/(default)/documents/${path}`, fields: fields(data) },
      updateTransforms: transforms.map(fieldPath => ({ fieldPath, setToServerValue: 'REQUEST_TIME' })) }] }) });
  return { status: response.status, result: await response.json() };
}

const signup = uid => ({ id: uid, name: 'Synthetic Resident', email: `${uid}@example.invalid`, role: 'resident', approved: false, termsVersion: '2026-10-draft1' });
test('new profile requires current terms and server request timestamp; absent and forged acceptance are denied', async () => {
  await allowed(transformedWrite('users/Consented', 'Consented', signup('Consented'), ['termsAcceptedAt']));
  const missing = signup('NoTerms'); delete missing.termsVersion;
  await denied(write('users/NoTerms', 'NoTerms', missing));
  await denied(write('users/NoTime', 'NoTime', signup('NoTime')));
  await denied(write('users/ForgedTime', 'ForgedTime', { ...signup('ForgedTime'), termsAcceptedAt: new Date('2026-01-01T00:00:00Z') }));
  await denied(transformedWrite('users/WrongVersion', 'WrongVersion', { ...signup('WrongVersion'), termsVersion: 'forged' }, ['termsAcceptedAt']));
  const result = await allowed(read('users/Consented', 'Consented'));
  const saved = { ...signup('Consented'), termsAcceptedAt: new Date(result.result.fields.termsAcceptedAt.timestampValue) };
  await denied(write('users/Consented', 'Consented', { ...saved, termsVersion: 'different-version' }));
  await denied(transformedWrite('users/Consented', 'Admin', saved, ['termsAcceptedAt']));
});

test('either peer block denies new friend chats and appends in both directions while preserving history and own receipts', async () => {
  for (const blocker of ['Alice', 'Bob']) {
    const other = blocker === 'Alice' ? 'Bob' : 'Alice';
    const original = friend(`blocked-${blocker}`), path = `resident_chats/${original.id}`;
    await seed(path, original);
    await seed(`user_blocks/${blocker}/targets/${other}`, { createdAt: new Date() });
    for (const uid of ['Alice', 'Bob']) {
      await allowed(read(path, uid));
      const reply = message(uid, `reply-${uid}`, 'Synthetic reply');
      await denied(write(path, uid, { ...original, messages: [...original.messages, reply], lastMessage: reply.body, updatedAt: 2, unreadBy: [uid === 'Alice' ? 'Bob' : 'Alice'] }));
      const fresh = { ...friend(`new-${blocker}-${uid}`), messages: [message(uid)], unreadBy: [uid === 'Alice' ? 'Bob' : 'Alice'] };
      await denied(write(`resident_chats/${fresh.id}`, uid, fresh));
    }
    await allowed(write(path, 'Alice', { ...original, readBy: { Alice: 1 } }));
    await allowed(write(path, 'Bob', { ...original, readBy: { Alice: 1, Bob: 1 } }));
    await denied(write(path, 'Alice', { ...original, readBy: { Alice: 1, Bob: 0 } }));
    await allowed(request(`user_blocks/${blocker}/targets/${other}`, { method: 'DELETE', owner: true }));
  }
});

test('peer blocks do not prevent a resident from contacting the office or receiving office replies', async () => {
  await seed('user_blocks/Alice/targets/Vip', { createdAt: new Date() });
  await seed('user_blocks/Vip/targets/Alice', { createdAt: new Date() });
  const original = service('office');
  await allowed(write('office_chats/Alice', 'Alice', original));
  const reply = { ...original, messages: [...original.messages, message('Vip', 'second', 'Synthetic office reply')], lastMessage: 'Synthetic office reply', updatedAt: 2, unreadByResident: true, unreadByVip: false };
  await allowed(write('office_chats/Alice', 'Vip', reply));
  await allowed(read('office_chats/Alice', 'Alice'));
});

test('block records are readable only by their approved owner and never writable by clients including Admin', async () => {
  const path = 'user_blocks/Alice/targets/Bob', data = { createdAt: new Date() };
  await seed(path, data);
  await allowed(read(path, 'Alice'));
  await allowed(read('user_blocks/Alice/targets', 'Alice'));
  for (const uid of ['Bob', 'Admin', 'Vip', 'Crew']) await denied(read(path, uid));
  for (const uid of ['Alice', 'Bob', 'Admin', 'Vip']) {
    await denied(write(path, uid, data));
    await denied(request(path, { uid, method: 'DELETE' }));
  }
});

test('moderation reports are office-readable and server-writable only', async () => {
  const path = 'moderation_reports/synthetic-report', data = { kind: 'post', collection: 'discussion_feed', id: 'synthetic-post', reason: 'spam', status: 'open' };
  await seed(path, data);
  for (const uid of ['Admin', 'Vip']) {
    await allowed(read(path, uid));
    await allowed(read('moderation_reports', uid));
  }
  for (const uid of ['Alice', 'Crew', 'Pending', undefined]) await denied(read(path, uid));
  for (const uid of ['Alice', 'Crew', 'Admin', 'Vip']) {
    await denied(write(path, uid, { ...data, status: 'resolved' }));
    await denied(write(`moderation_reports/new-${uid}`, uid, data));
    await denied(request(path, { uid, method: 'DELETE' }));
  }
});

test('deletion tombstones prevent recreation of media drafts even with fresh valid server timestamps', async () => {
  for (const collection of ['discussion_feed', 'marketplace_posts', 'work_orders']) {
    const draft = { userId: 'Alice', storageDraft: true, storageDraftExpiresAt: new Date(Date.now() + 30 * 60 * 1000) };
    await allowed(transformedWrite(`${collection}/fresh-draft`, 'Alice', draft, ['createdAt']));
    await seed(`media_deletion_tombstones/${collection}/records/removed-draft`, { deletedAt: new Date() });
    await denied(transformedWrite(`${collection}/removed-draft`, 'Alice', draft, ['createdAt']));
    await denied(read(`media_deletion_tombstones/${collection}/records/removed-draft`, 'Admin'));
  }
});

test('approved deletion-pending users cannot create UGC, draft media or send peer/office messages', async () => {
  const post = { userId: 'Deleting', storageDraft: false, author: profiles.Deleting.name, authorAvatar: '', authorEmail: '', unit: 'TownLoop Resident', title: 'Synthetic post', content: 'Synthetic content', comments: [], likes: 0, likedBy: {} };
  await denied(transformedWrite('discussion_feed/deleting-post', 'Deleting', post, ['createdAt']));
  const draft = { userId: 'Deleting', storageDraft: true, storageDraftExpiresAt: new Date(Date.now() + 30 * 60 * 1000) };
  await denied(transformedWrite('work_orders/deleting-draft', 'Deleting', draft, ['createdAt']));
  const original = { ...friend('deleting-chat'), participantIds: ['Deleting', 'Bob'], participants: [{ id: 'Deleting', name: profiles.Deleting.name }, { id: 'Bob', name: profiles.Bob.name }], messages: [message('Deleting')], unreadBy: ['Bob'] };
  await denied(write('resident_chats/deleting-chat', 'Deleting', original));
  await seed('resident_chats/deleting-history', { ...original, id: 'deleting-history' });
  await denied(write('resident_chats/deleting-history', 'Deleting', { ...original, id: 'deleting-history', messages: [...original.messages, message('Deleting', 'second', 'Synthetic reply')], lastMessage: 'Synthetic reply', updatedAt: 2 }));
  const office = { ...service('office', 'Deleting'), residentId: 'Deleting', residentName: profiles.Deleting.name, messages: [message('Deleting')] };
  await denied(write('office_chats/Deleting', 'Deleting', office));
});
