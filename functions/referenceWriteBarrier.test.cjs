const { test } = require('node:test');
const assert = require('node:assert/strict');
const { assertReferenceWritesAllowed, REFERENCE_WRITE_CONTROL } = require('./referenceWriteBarrier.cjs');
const { fixture } = require('./testing/inbox-group-fixture.cjs');
const { syncDirectoryProfile } = require('./profilePrivacyPolicy.cjs');
const blocked = error => error.code === 'failed-precondition' && error.safeReason === 'database-cleanup-maintenance';
const media = 'https://firebasestorage.googleapis.com/v0/b/demo.test/o/shared%2Fcandidate.jpg?alt=media';
test('absent and false control preserve writes; only an explicit true blocks', async () => {
  const h = fixture();
  for (const control of [undefined, {}, { referenceWritesBlocked: false }, { referenceWritesBlocked: 'true' }]) {
    if (control) h.records.set(REFERENCE_WRITE_CONTROL, control); else h.records.delete(REFERENCE_WRITE_CONTROL);
    await h.db.runTransaction(async tx => { await assertReferenceWritesAllowed(tx, h.db); tx.set(h.db.doc('posts/allowed'), { photoUrl: media }); });
  }
  h.records.set(REFERENCE_WRITE_CONTROL, { referenceWritesBlocked: true });
  await assert.rejects(h.db.runTransaction(async tx => { await assertReferenceWritesAllowed(tx, h.db); tx.set(h.db.doc('posts/blocked'), { photoUrl: media }); }), blocked);
  assert.equal(h.records.has('posts/blocked'), false);
});
test('barrier prevents Inbox new references, historical copies and queued avatar projection with no partial writes', async () => {
  const h = fixture(), { conversationId } = await h.call('a', { op: 'create', type: 'private', recipientIds: ['b'] });
  h.records.set('resident_chats/legacy', { identityVersion: 2, participantIds: ['a', 'b'], messages: [{ id: 'old', senderId: 'a', senderAvatar: media, body: media, createdAt: 1 }] });
  h.records.set('users/a', { ...h.records.get('users/a'), avatarUrl: media });
  h.records.set(REFERENCE_WRITE_CONTROL, { referenceWritesBlocked: true });
  const before = structuredClone([...h.records]);
  for (const data of [
    { op: 'send', conversationId, messageId: 'new', body: media },
    { op: 'create', type: 'office', recipientIds: ['admin'], subject: media },
    { op: 'upgradeLegacy', source: 'resident_chats', legacyId: 'legacy' },
    { op: 'leaveLegacy', source: 'resident_chats', legacyId: 'legacy' },
    { op: 'leave', conversationId },
  ]) await assert.rejects(h.call('a', data), blocked);
  await assert.rejects(syncDirectoryProfile(h.db, 'a'), blocked);
  assert.deepEqual([...h.records], before);
  h.records.set(REFERENCE_WRITE_CONTROL, { referenceWritesBlocked: false });
  await h.call('a', { op: 'send', conversationId, messageId: 'after', body: media });
  await syncDirectoryProfile(h.db, 'a');
  assert.equal(h.records.get(`inbox_conversations/${conversationId}/messages/after`).body, media);
  assert.equal(h.records.get('resident_directory/a').avatarUrl, media);
});
test('an optimistic transaction begun before barrier acquisition conflicts and retries into the blocked state', async () => {
  // Small MVCC model: concurrent commits invalidate the transaction read version.
  let control = { referenceWritesBlocked: false }, version = 0, attempts = 0, written = false;
  let entered, release;
  const ready = new Promise(resolve => { entered = resolve; }), pause = new Promise(resolve => { release = resolve; });
  const db = { doc: path => ({ path }), async runTransaction(action) {
    for (;;) {
      const observed = version, snapshot = structuredClone(control), writes = [];
      const result = await action({ get: async ref => { assert.equal(ref.path, REFERENCE_WRITE_CONTROL); return { data: () => snapshot }; }, set: (...args) => writes.push(args) });
      if (version !== observed) continue;
      written = writes.length > 0; return result;
    }
  } };
  const writer = db.runTransaction(async tx => {
    attempts++;
    await assertReferenceWritesAllowed(tx, db);
    entered(); await pause;
    tx.set(db.doc('posts/racing'), { photoUrl: media });
  });
  await ready; control = { referenceWritesBlocked: true }; version++; release();
  await assert.rejects(writer, blocked);
  assert.equal(attempts, 2); assert.equal(written, false);
});
test('safety submission and review cannot create evidence holds or copy review/comment text during maintenance', async () => {
  const h = fixture(), handlers = {};
  // Load the real handlers with isolated service dependencies; no Auth or cloud calls.
  class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
  const dependencies = name => name === 'firebase-functions/v2/https' ? { onCall: (_, handler) => handler, HttpsError }
    : name === 'firebase-admin/auth' ? { getAuth: () => ({ verifyIdToken: async () => ({ uid: 'admin' }) }) }
    : name === 'firebase-admin/firestore' ? { getFirestore: () => h.db, FieldValue: { serverTimestamp: () => 1 } } : require(name);
  new Function('require', 'exports', require('node:fs').readFileSync(require('node:path').join(__dirname, 'safety.cjs'), 'utf8'))(dependencies, handlers);
  h.records.set('discussion_feed/target', { authorId: 'a', photoUrl: media });
  h.records.set('moderation_reports/report', { status: 'open', collection: 'discussion_feed', id: 'target', kind: 'post' });
  h.records.set(REFERENCE_WRITE_CONTROL, { referenceWritesBlocked: true });
  const before = structuredClone([...h.records]);
  const request = data => ({ auth: { uid: 'admin' }, rawRequest: { headers: { authorization: 'Bearer fixture' } }, data });
  for (const [handler, data] of [
    [handlers.submitSafetyReport, { kind: 'post', id: 'target', reason: 'other', details: media }],
    [handlers.reviewSafetyReport, { reportId: 'report', action: 'resolve', note: media }],
  ]) await assert.rejects(handler(request(data)), error => error.code === 'failed-precondition' && /maintenance/.test(error.message));
  assert.deepEqual([...h.records], before);
});
