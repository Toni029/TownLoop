// Focused local-only rules regression tests. No SDK, Auth accounts or live Firebase access.
// FIRESTORE_EMULATOR_HOST=127.0.0.1:8897 node --test security/batch/batch.rules.test.mjs
import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const host = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8897';
if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host)) throw Error('Only a loopback Firestore emulator is allowed.');
const project = 'demo-townloop-security';
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
  for (const [uid, data] of Object.entries(profiles)) await seed(`users/${uid}`, data);
  await seed('resident_directory/Alice', { id: 'Alice', name: profiles.Alice.name, role: 'resident', approved: true });
});

test('private profiles: owner and approved office managers only; public directory contains no private contacts', async () => {
  for (const uid of ['Alice', 'Admin', 'Vip']) await allowed(read('users/Alice', uid));
  for (const uid of ['Bob', 'Crew', 'Aliases', 'Pending', 'Unapproved', 'LegacyStaff', 'MissingApproval', undefined]) await denied(read('users/Alice', uid));
  const result = await allowed(read('resident_directory/Alice', 'Bob'));
  assert.equal(result.result.fields.email, undefined);
  assert.equal(result.result.fields.phone, undefined);
  await denied(write('resident_directory/Alice', 'Alice', { id: 'Alice', role: 'admin', approved: true }));
});

test('approval and canonical roles cannot be spoofed through signup, flags, or own-profile updates', async () => {
  const signup = { id: 'New', name: 'New Resident', email: 'New@example.invalid', role: 'resident', approved: false };
  await allowed(write('users/New', 'New', signup));
  await denied(write('users/Evil', 'Evil', { ...signup, id: 'Evil', email: 'Evil@example.invalid', isAdmin: true }));
  await denied(write('users/Elevated', 'Elevated', { ...signup, id: 'Elevated', email: 'Elevated@example.invalid', role: 'admin', approved: true }));
  await denied(write('users/Alice', 'Alice', { ...profiles.Alice, approved: true, role: 'admin' }));
  await denied(write('users/Alice', 'Alice', { ...profiles.Alice, isVip: true }));
  await denied(write('users/Bob', 'Aliases', { ...profiles.Bob, role: 'admin' }));
  await denied(read('office_chats', 'LegacyStaff'));
  await denied(read('office_chats', 'MissingApproval'));
});

test('friend history requires version 2 and exact UID; aliases, case variants and unscoped listing fail closed', async () => {
  await seed('resident_chats/private', friend('private'));
  await allowed(read('resident_chats/private', 'Alice'));
  await allowed(read('resident_chats/private', 'Bob'));
  await denied(read('resident_chats/private', 'Outsider'));
  await denied(read('resident_chats/private', 'Admin'));
  await denied(read('resident_chats/private', 'Pending'));
  await denied(read('resident_chats/private', 'alice'));
  await seed('resident_chats/legacy', { ...friend('legacy'), identityVersion: 1 });
  await denied(read('resident_chats/legacy', 'Alice'));
  await seed('resident_chats/emailAlias', { ...friend('emailAlias'), participantIds: [profiles.Alice.email, 'Bob'] });
  await denied(read('resident_chats/emailAlias', 'Alice'));
  await denied(read('resident_chats', 'Alice'));
});

test('friend create and append validate canonical author and preserve all historical content', async () => {
  const original = friend('created');
  await allowed(write('resident_chats/created', 'Alice', original));
  const next = { ...original, messages: [...original.messages, message('Bob', 'second', 'Reply')], lastMessage: 'Reply', updatedAt: 2, unreadBy: ['Alice'] };
  await allowed(write('resident_chats/created', 'Bob', next));
  for (const patch of [{ body: 'Edited' }, { senderId: 'Bob' }, { senderRole: 'admin' }, { readBy: ['Outsider'] }])
    await denied(write('resident_chats/created', 'Alice', { ...next, messages: [{ ...original.messages[0], ...patch }, next.messages[1]] }));
  const third = { ...message('Alice', 'third', 'Third'), createdAt: 3 };
  await denied(write('resident_chats/created', 'Alice', { ...next, messages: [{ ...next.messages[0], body: 'Altered prefix' }, next.messages[1], third], lastMessage: 'Third', updatedAt: 3, unreadBy: ['Bob'] }));
  await denied(write('resident_chats/created', 'Alice', { ...next, messages: next.messages.slice(1) }));
  await denied(write('resident_chats/created', 'Alice', { ...next, participantIds: ['Alice', 'Outsider'] }));
  await denied(write('resident_chats/created', 'Alice', { ...next, residentEmail: profiles.Alice.email }));
  const spoof = { ...friend('spoof'), messages: [{ ...message('Alice'), senderId: 'Bob' }] };
  await denied(write('resident_chats/spoof', 'Alice', spoof));
  await denied(write('resident_chats/roleSpoof', 'Alice', { ...friend('roleSpoof'), messages: [{ ...message('Alice'), senderRole: 'admin' }] }));
  await denied(request('resident_chats/created', { method: 'DELETE', uid: 'Alice' }));
});

test('read and hide cursors may change only the acting UID and never historical messages', async () => {
  const original = friend('cursors');
  await seed('resident_chats/cursors', original);
  await allowed(write('resident_chats/cursors', 'Bob', { ...original, readBy: { Bob: 1 } }));
  const readState = { ...original, readBy: { Bob: 1 } };
  await allowed(write('resident_chats/cursors', 'Alice', { ...readState, hiddenBy: { Alice: 1 } }));
  const hidden = { ...readState, hiddenBy: { Alice: 1 } };
  await denied(write('resident_chats/cursors', 'Alice', { ...hidden, readBy: { Bob: 0, Alice: 1 } }));
  await denied(write('resident_chats/cursors', 'Alice', { ...hidden, hiddenBy: { Alice: 1, Bob: 1 } }));
  await denied(write('resident_chats/cursors', 'Alice', { ...hidden, readBy: { Bob: 1, Alice: 999 } }));
  await denied(write('resident_chats/cursors', 'Alice', { ...hidden, messages: [{ ...original.messages[0], body: 'Edited while reading' }], readBy: { Bob: 1, Alice: 1 } }));
  await denied(write('resident_chats/cursors', 'Alice', { ...hidden, unreadBy: [] }));
});

test('office and maintenance separate teams, preserve UID-owned legacy document IDs and restrict receipts', async () => {
  for (const [kind, team, excluded] of [['office', 'Vip', 'Crew'], ['maintenance', 'Crew', 'Admin']]) {
    const collection = `${kind}_chats`, original = service(kind, `${kind}-legacy-id`);
    await seed(`${collection}/${original.id}`, original);
    await allowed(write(`${collection}/Alice`, 'Alice', service(kind)));
    await allowed(read(`${collection}/${original.id}`, 'Alice'));
    await allowed(read(`${collection}/${original.id}`, team));
    for (const uid of ['Bob', excluded, 'Aliases', 'Pending']) await denied(read(`${collection}/${original.id}`, uid));
    await seed(`${collection}/email-only`, { ...original, id: 'email-only', residentId: 'unknown', residentEmail: profiles.Alice.email });
    await denied(read(`${collection}/email-only`, 'Alice'));
    const reply = { ...original, messages: [...original.messages, message(team, 'second', 'Team reply')], lastMessage: 'Team reply', updatedAt: 2,
      unreadByResident: true, [kind === 'office' ? 'unreadByVip' : 'unreadByCrew']: false };
    await allowed(write(`${collection}/${original.id}`, team, reply));
    await allowed(write(`${collection}/${original.id}`, 'Alice', { ...reply, readBy: { Alice: 2 } }));
    await denied(write(`${collection}/${original.id}`, team, { ...reply, readBy: { Alice: 2, Bob: 2 } }));
    await denied(write(`${collection}/${original.id}`, team, { ...reply, messages: [{ ...original.messages[0], body: 'Team edit' }, reply.messages[1]] }));
    await denied(request(`${collection}/${original.id}`, { method: 'DELETE', uid: team }));
  }
});

async function transformedWrite(path, uid, data, transforms = ['updatedAt']) {
  const response = await fetch(`${documents}:commit`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(uid ? { Authorization: `Bearer ${token(uid)}` } : {}) },
    body: JSON.stringify({ writes: [{ update: { name: `projects/${project}/databases/(default)/documents/${path}`, fields: fields(data) },
      updateTransforms: transforms.map(fieldPath => ({ fieldPath, setToServerValue: 'REQUEST_TIME' })) }] }) });
  return { status: response.status, result: await response.json() };
}
async function runQuery(collectionId, uid, filters = []) {
  const response = await fetch(`${documents}:runQuery`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token(uid)}` },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId }], ...(filters.length ? { where: { compositeFilter: { op: 'AND', filters: filters.map(([fieldPath, op, input]) => ({ fieldFilter: { field: { fieldPath }, op, value: value(input) } })) } } } : {}) } }) });
  return { status: response.status, result: await response.json() };
}

test('constrained client queries are authorized and unscoped inbox collection queries are denied', async () => {
  await allowed(runQuery('resident_chats', 'Alice', [['participantIds', 'ARRAY_CONTAINS', 'Alice'], ['identityVersion', 'EQUAL', 2]]));
  await denied(runQuery('resident_chats', 'Alice', [['participantIds', 'ARRAY_CONTAINS', 'Alice']]));
  for (const kind of ['office', 'maintenance']) await allowed(runQuery(`${kind}_chats`, 'Alice', [['residentId', 'EQUAL', 'Alice']]));
  await allowed(runQuery('office_chats', 'Vip'));
  await allowed(runQuery('maintenance_chats', 'Crew'));
  await denied(runQuery('office_chats', 'Crew'));
  await denied(runQuery('maintenance_chats', 'Admin'));
  await denied(runQuery('users', 'Alice'));
  await allowed(runQuery('users', 'Admin'));
});

const post = (legacy = false, market = false) => ({ [legacy ? 'authorId' : 'userId']: 'Alice', storageDraft: false, author: profiles.Alice.name, authorAvatar: '', authorEmail: '', unit: 'TownLoop Resident',
  title: 'Community message', [market ? 'description' : 'content']: 'Hello neighbors', comments: [], createdAt: new Date('2026-01-01T00:00:00Z'),
  ...(market ? { sold: false, claimed: false, price: 'FREE' } : { likes: 0, likedBy: {} }) });
const comment = (uid = 'Bob', id = 'one') => ({ id, authorId: uid, author: profiles[uid].name, authorAvatar: '', authorEmail: '', unit: 'TownLoop Resident', text: 'Thanks', timeAgo: 'Just now' });

test('social current and legacy collections deny pending/alias privilege writes and owner impersonation', async () => {
  for (const [collection, legacy, market] of [['discussion_feed', false, false], ['marketplace_posts', false, true], ['posts', true, false], ['marketItems', true, true]]) {
    const original = post(legacy, market);
    const created = await allowed(transformedWrite(`${collection}/valid`, 'Alice', original, ['createdAt']));
    original.createdAt = new Date(created.result.writeResults[0].transformResults[0].timestampValue);
    await denied(transformedWrite(`${collection}/pending`, 'Pending', { ...original, [legacy ? 'authorId' : 'userId']: 'Pending', author: profiles.Pending.name }, ['createdAt']));
    await denied(transformedWrite(`${collection}/impersonated`, 'Bob', original, ['createdAt']));
    await denied(transformedWrite(`${collection}/secondary-owner`, 'Alice', { ...original, [legacy ? 'userId' : 'authorId']: 'Bob' }, ['createdAt']));
    await denied(transformedWrite(`${collection}/secondary-uid`, 'Alice', { ...original, uid: 'Bob' }, ['createdAt']));
    await denied(transformedWrite(`${collection}/valid`, 'Alice', { ...original, uid: 'Bob' }));
    await denied(transformedWrite(`${collection}/valid`, 'Bob', { ...original, [legacy ? 'authorId' : 'userId']: 'Bob' }));
    await denied(transformedWrite(`${collection}/valid`, 'Aliases', { ...original, title: 'Privileged edit' }));
    const pendingOwned = { ...original, [legacy ? 'authorId' : 'userId']: 'Pending', author: profiles.Pending.name };
    await seed(`${collection}/pending-owned`, pendingOwned);
    await denied(transformedWrite(`${collection}/pending-owned`, 'Pending', { ...pendingOwned, title: 'Pending owner edit' }));
    await denied(request(`${collection}/pending-owned`, { method: 'DELETE', uid: 'Pending' }));
    await denied(request(`${collection}/valid`, { method: 'DELETE', uid: 'Pending' }));
    await denied(request(`${collection}/valid`, { method: 'DELETE', uid: 'Aliases' }));
    await allowed(transformedWrite(`${collection}/valid`, 'Admin', { ...original, title: 'Manager edit' }));
  }
});

test('social comments append only with canonical authors; likes modify only acting UID with matching count', async () => {
  const original = post();
  await seed('discussion_feed/comments', original);
  const commented = { ...original, comments: [comment()] };
  await allowed(transformedWrite('discussion_feed/comments', 'Bob', commented));
  await denied(transformedWrite('discussion_feed/comments', 'Alice', { ...commented, comments: [{ ...comment(), text: 'Edited history' }] }));
  await denied(transformedWrite('discussion_feed/comments', 'Admin', { ...commented, comments: [] }));
  await denied(transformedWrite('discussion_feed/comments', 'Bob', { ...commented, comments: [...commented.comments, { ...comment('Alice', 'two') }] }));
  await denied(transformedWrite('discussion_feed/comments', 'Bob', { ...commented, title: 'Changed together', comments: [...commented.comments, comment('Bob', 'two')] }));
  await seed('discussion_feed/likes', original);
  await allowed(transformedWrite('discussion_feed/likes', 'Bob', { ...original, likedBy: { Bob: true }, likes: 1 }));
  await denied(transformedWrite('discussion_feed/likes', 'Alice', { ...original, likedBy: { Bob: false, Alice: true }, likes: 1 }));
  await denied(transformedWrite('discussion_feed/likes', 'Alice', { ...original, likedBy: { Bob: true, Alice: true }, likes: 99 }));
  await allowed(transformedWrite('discussion_feed/likes', 'Bob', { ...original, likedBy: { Bob: false }, likes: 0 }));
});

async function atomicWrites(uid, items) {
  const response = await fetch(`${documents}:commit`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token(uid)}` },
    body: JSON.stringify({ writes: items.map(({ path, data, transforms = [] }) => ({ update: { name: `projects/${project}/databases/(default)/documents/${path}`, fields: fields(data) },
      ...(transforms.length ? { updateTransforms: transforms.map(fieldPath => ({ fieldPath, setToServerValue: 'REQUEST_TIME' })) } : {}) })) }) });
  return { status: response.status, result: await response.json() };
}

test('private work-order media draft finalizes with one atomic four-digit counter and reservation allocation', async () => {
  const draft = { userId: 'Alice', storageDraft: true, createdAt: new Date(), storageDraftExpiresAt: new Date(Date.now() + 30 * 60 * 1000) };
  await denied(transformedWrite('work_orders/anonymous-draft', undefined, draft, ['createdAt']));
  await allowed(transformedWrite('work_orders/private-draft', 'Alice', draft, ['createdAt']));
  await allowed(read('work_orders/private-draft', 'Alice'));
  for (const uid of ['Bob', 'Crew', 'Admin']) await denied(read('work_orders/private-draft', uid));
  await denied(runQuery('work_orders', 'Alice', [['userId', 'EQUAL', 'Alice']]));
  await denied(runQuery('work_orders', 'Crew'));
  await seed('counters/work_orders_four_digit', { ready: true, lastNumber: 999, orderId: '' });
  const published = { userId: 'Alice', storageDraft: false, createdAt: new Date(), title: 'Leaking faucet', description: 'Kitchen sink', status: 'Queued', comments: [], photos: [], ticketNumber: 1000, code: '1000' };
  // A draft cannot bypass the atomic allocator by finalizing by itself.
  await denied(transformedWrite('work_orders/private-draft', 'Alice', published, ['createdAt']));
  await allowed(atomicWrites('Alice', [
    { path: 'work_orders/private-draft', data: published, transforms: ['createdAt'] },
    { path: 'counters/work_orders_four_digit', data: { ready: true, lastNumber: 1000, orderId: 'private-draft' } },
    { path: 'work_order_numbers/1000', data: { orderId: 'private-draft' } },
  ]));
  await allowed(read('work_orders/private-draft', 'Crew'));
  await allowed(runQuery('work_orders', 'Alice', [['userId', 'EQUAL', 'Alice'], ['storageDraft', 'EQUAL', false]]));
  await allowed(runQuery('work_orders', 'Crew', [['storageDraft', 'EQUAL', false]]));
  const reservation = await allowed(read('work_order_numbers/1000', 'Alice'));
  assert.equal(reservation.result.fields.orderId.stringValue, 'private-draft');
  await denied(request('work_order_numbers/1000', { method: 'DELETE', uid: 'Admin' }));
});

test('profile proposal stays pending for its owner and office review accepts canonical fields plus legacy aliases', async () => {
  const previous = { phone: '', address: '', dateOfBirth: '', maritalStatus: '', emergencyContactName: '', emergencyContactPhone: '', emergencyContactAddress: '' };
  const changes = { phone: '555-0100', address: 'Unit A', dateOfBirth: '1950-01-01', maritalStatus: 'Married', emergencyContactName: 'Test Contact', emergencyContactPhone: '555-0101', emergencyContactAddress: 'Unit B' };
  const proposal = { status: 'pending', previous, changes, requestedBy: 'Bob', requestedAt: new Date() };
  const created = await allowed(transformedWrite('users/Bob', 'Bob', { ...profiles.Bob, profileUpdateRequest: proposal }, ['profileUpdateRequest.requestedAt']));
  proposal.requestedAt = new Date(created.result.writeResults[0].transformResults[0].timestampValue);
  const reviewed = { ...profiles.Bob, ...changes, date_of_birth: changes.dateOfBirth, marital_status: changes.maritalStatus,
    emergencyContact: changes.emergencyContactName, emergency_contact: changes.emergencyContactName,
    emergency_contact_phone: changes.emergencyContactPhone, emergency_contact_address: changes.emergencyContactAddress,
    profileUpdateRequest: { ...proposal, status: 'approved', reviewedBy: 'Admin', reviewedAt: new Date() } };
  await denied(transformedWrite('users/Bob', 'Bob', reviewed, ['profileUpdateRequest.reviewedAt']));
  await denied(transformedWrite('users/Bob', 'Crew', reviewed, ['profileUpdateRequest.reviewedAt']));
  await allowed(transformedWrite('users/Bob', 'Admin', reviewed, ['profileUpdateRequest.reviewedAt']));
  const result = await allowed(read('users/Bob', 'Bob'));
  assert.equal(result.result.fields.date_of_birth.stringValue, changes.dateOfBirth);
  assert.equal(result.result.fields.emergency_contact_phone.stringValue, changes.emergencyContactPhone);
});
