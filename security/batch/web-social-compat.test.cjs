const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('../../node_modules/typescript');
class Timestamp { constructor(ms) { this.ms = ms; } toMillis() { return this.ms; } }
function harness(existing, actor = { approved: true, role: 'resident', name: 'Canonical', avatar_url: 'https://example.test/avatar' }) {
  const writes = [], mutations = [];
  const db = {}, auth = { currentUser: { uid: 'actor' } };
  const firestore = {
    Timestamp, collection: (_db, name) => ({ name }), serverTimestamp: () => 'SERVER_TIME',
    doc: (...args) => args.length === 3 ? { path: `${args[1]}/${args[2]}`, id: args[2] } : { path: `${args[0].name}/generated`, id: 'generated' },
    runTransaction: async (_db, action) => action({
      get: async ref => ({ exists: () => ref.path === 'users/actor' ? !!actor : !!existing,
        data: () => ref.path === 'users/actor' ? actor : existing }),
      set: (...args) => writes.push({ method: 'set', args }),
      update: (...args) => writes.push({ method: 'update', args }),
    }),
  };
  const source = fs.readFileSync(path.resolve(__dirname, '../../src/services/firestoreSync.ts'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, console, require: name => {
    if (name === 'firebase/firestore') return firestore;
    if (name === '../firebase') return { db, auth, isFirebaseConfigured: () => true };
    if (name === './socialIntegrity') return { mutateSocial: async (...args) => mutations.push(args) };
    return {};
  }});
  return { exports, writes, mutations };
}
const input = { id: 'stable-form-id', title: 'Title', content: 'Body', mediaUrl: 'https://example.test/photo', media: [{ type: 'image', url: 'https://example.test/photo' }], userId: 'forged', author: 'Forged', authorEmail: 'private@example.test', unit: 'Private address', likes: 42, comments: [{ text: 'forged' }] };
test('social publish replaces the owned hidden parent with canonical identity and empty reactions', async () => {
  const h = harness({ userId: 'actor', storageDraft: true, storageDraftExpiresAt: new Timestamp(Date.now() + 60000) });
  assert.equal(await h.exports.saveDiscussionFeedPostToFirestore(input), input.id);
  assert.equal(h.writes.length, 1);
  const write = h.writes[0];
  assert.equal(write.method, 'set');
  assert.equal(write.args.length, 2); // no merge: expiry and stale sensitive fields disappear
  const body = write.args[1];
  assert.equal(body.userId, 'actor'); assert.equal(body.author, 'Canonical');
  assert.equal(body.authorEmail, ''); assert.equal(body.unit, 'TownLoop Resident');
  assert.equal(body.storageDraft, false); assert.equal(body.storageDraftExpiresAt, undefined);
  assert.equal(body.likes, 0); assert.equal(Object.keys(body.likedBy).length, 0); assert.equal(body.comments.length, 0);
  assert.equal(body.media.length, 1);
});
test('expired or another account draft and pending actors cannot publish', async () => {
  for (const draft of [
    { userId: 'other', storageDraft: true, storageDraftExpiresAt: new Timestamp(Date.now() + 60000) },
    { userId: 'actor', storageDraft: true, storageDraftExpiresAt: new Timestamp(Date.now() - 60000) },
  ]) { const h = harness(draft); await assert.rejects(h.exports.saveDiscussionFeedPostToFirestore(input), /draft/); assert.equal(h.writes.length, 0); }
  const h = harness(undefined, { role: 'resident', approved: false });
  await assert.rejects(h.exports.saveDiscussionFeedPostToFirestore(input), /approved/);
  assert.equal(h.writes.length, 0);
});
test('published retries edit only content and retain owner, creation time, comments and likes', async () => {
  const h = harness({ userId: 'actor', storageDraft: false, createdAt: 'original', comments: [{ text: 'keep' }], likes: 5 });
  await h.exports.saveDiscussionFeedPostToFirestore(input);
  const write = h.writes[0]; assert.equal(write.method, 'update');
  for (const key of ['userId', 'author', 'authorEmail', 'unit', 'createdAt', 'comments', 'likes', 'likedBy']) assert.equal(Object.hasOwn(write.args[1], key), false);
  const other = harness({ userId: 'other', storageDraft: false });
  await assert.rejects(other.exports.saveDiscussionFeedPostToFirestore(input), /author/);
});
test('social delete wrappers use the shared transaction for exactly one collection', async () => {
  const h = harness();
  assert.equal(await h.exports.deleteMarketplacePostFromFirestore('item'), true);
  assert.equal(h.mutations.length, 1);
  assert.equal(h.mutations[0][2], 'marketplace_posts'); assert.equal(h.mutations[0][4], 'delete');
});
