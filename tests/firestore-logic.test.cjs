const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

// Replay state updaters just as Strict Mode does, without a browser or live database.
function harness(configured = true) {
  const values = [], effects = [], cache = new Map(), writes = [], toasts = [];
  let cursor = 0, hook, result, blocked, fail = false;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in values)) values[index] = typeof initial === 'function' ? initial() : initial;
      return [values[index], update => {
        if (typeof update === 'function') { update(values[index]); values[index] = update(values[index]); }
        else values[index] = update;
      }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in values)) values[index] = { current: initial };
      return values[index];
    },
    useEffect(effect) { effects.push(effect); },
  };
  const firestore = {
    collection: (_, name) => name,
    doc: (_, name, id) => `${name}/${id}`,
    serverTimestamp: () => ({ transform: 'timestamp' }),
    arrayUnion: (...items) => ({ transform: 'union', items }),
    increment: value => ({ transform: 'increment', value }),
    deleteField: () => ({ transform: 'delete' }),
    async addDoc(ref, data) { writes.push({ kind: 'create', ref, data }); if (blocked) await blocked; if (fail) throw Error('permission-denied'); return { id: 'created-id' }; },
    async updateDoc(ref, data) { writes.push({ kind: 'update', ref, data }); if (blocked) await blocked; if (fail) throw Error('permission-denied'); },
    async deleteDoc(ref) { writes.push({ kind: 'delete', ref }); if (fail) throw Error('permission-denied'); },
  };
  const firebase = { db: {}, auth: { currentUser: { uid: 'resident-id' } }, isFirebaseConfigured: () => configured };
  function load(file) {
    file = path.resolve(root, file);
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInNewContext(`(function(require,module,exports){${code}\n})`, {
      console: { warn() {}, error() {} }, Date, Set, Map, crypto: require('node:crypto').webcrypto,
    })((name) => {
      if (name === 'react') return react;
      if (name === 'firebase/firestore') return firestore;
      if (name.endsWith('/firebase')) return firebase;
      if (name.endsWith('/liveCollection')) return { subscribeToCollection: () => () => {} };
      if (name.startsWith('.')) return load(path.resolve(path.dirname(file), `${name}.ts`));
      throw Error(`Unexpected import ${name}`);
    }, module, module.exports);
    return module.exports;
  }
  return {
    load, writes, toasts, firestore, firebase,
    start(file, exportName) {
      hook = load(file)[exportName]; const state = this.render();
      state.setPosts?.([{ id: 'post-1', title: 'Post', content: 'Body', author: 'Resident', likes: 0, liked: false, comments: [] }]);
      state.setWorkOrders?.([{ id: 'order-1', title: 'Repair', status: 'Pending', placeInLine: 1, comments: [], photos: [] }]);
      return this.render();
    },
    render() { cursor = 0; result = hook({ id: 'resident-id', name: 'Resident', email: 'r@example.com' }, message => toasts.push(message)); return result; },
    block() { let release; blocked = new Promise(resolve => { release = resolve; }); return () => { release(); blocked = null; }; },
    fail(value = true) { fail = value; },
  };
}
const post = { type: 'chat', title: 'Hello', description: 'Neighbors', media: [] };

test('rapid duplicate post submissions create exactly one document', async () => {
  const h = harness(), state = h.start('src/hooks/useCommunityState.ts', 'useCommunityState');
  const release = h.block();
  const first = state.handleCreatePostSubmit(post);
  await state.handleCreatePostSubmit(post);
  assert.equal(h.writes.length, 1);
  release(); await first;
  assert.equal(h.toasts.length, 1);
});

test('failed creation rejects without success and unlocks for retry', async () => {
  const h = harness(), state = h.start('src/hooks/useCommunityState.ts', 'useCommunityState');
  h.fail(); await assert.rejects(state.handleCreatePostSubmit(post), /Could not publish/);
  assert.equal(h.toasts.length, 0);
  h.fail(false); await state.handleCreatePostSubmit(post);
  assert.equal(h.toasts.length, 1);
});

test('Strict Mode updater replay does not repeat comment writes; comments append atomically', async () => {
  const h = harness(), state = h.start('src/hooks/useCommunityState.ts', 'useCommunityState');
  const id = state.posts[0].id;
  const release = h.block();
  const first = state.handleModalAddComment(id, false, 'Hello');
  assert.equal(await state.handleModalAddComment(id, false, 'Hello'), false);
  release(); await first;
  assert.equal(h.writes.length, 1);
  const data = h.writes[0].data;
  assert.equal(data.comments.transform, 'union');
  assert.equal(data.userId, undefined);
  assert.equal(data.createdAt, undefined);
  assert.equal(h.render().posts[0].comments.filter(c => c.text === 'Hello').length, 1);
});

test('failed inline comment preserves its draft and does not alter the feed', async () => {
  const h = harness(); let state = h.start('src/hooks/useCommunityState.ts', 'useCommunityState');
  const id = state.posts[0].id, count = state.posts[0].comments.length;
  state.setCommentInputText({ [id]: 'Keep this draft' }); state = h.render();
  h.fail(); await state.handleAddComment(id); state = h.render();
  assert.equal(state.commentInputText[id], 'Keep this draft');
  assert.equal(state.posts[0].comments.length, count);
});

test('failed delete does not remove the item or announce success', async () => {
  const h = harness(), state = h.start('src/hooks/useCommunityState.ts', 'useCommunityState');
  const id = state.posts[0].id; h.fail(); await state.handleDeleteItem(id, false);
  assert.ok(h.render().posts.some(post => post.id === id));
  assert.equal(h.toasts.some(message => message.startsWith('Post deleted')), false);
});

test('work order submission failure retains fields and modal state', async () => {
  const h = harness(); let state = h.start('src/hooks/useWorkOrders.ts', 'useWorkOrders');
  state.setNewWoTitle('Repair'); state.setIsWorkOrderModalOpen(true); state = h.render();
  h.fail(); await assert.rejects(state.handleWorkOrderSubmit({ preventDefault() {} }), /Could not submit/);
  state = h.render(); assert.equal(state.newWoTitle, 'Repair'); assert.equal(state.isWorkOrderModalOpen, true);
  assert.equal(h.toasts.length, 0);
});

test('work order text-only comments omit undefined photo values and write once', async () => {
  const h = harness(), state = h.start('src/hooks/useWorkOrders.ts', 'useWorkOrders');
  await state.handleAddWorkOrderComment(state.workOrders[0].id, 'Update');
  assert.equal(h.writes.length, 1);
  assert.equal(Object.hasOwn(h.writes[0].data.comments.items[0], 'photoUrl'), false);
  assert.equal(h.writes[0].data.userId, undefined);
});

test('completion appends proof and reopening removes stale completion metadata', async () => {
  const h = harness(), state = h.start('src/hooks/useWorkOrders.ts', 'useWorkOrders');
  const id = state.workOrders[0].id;
  assert.equal(await state.handleCompleteWithReply(id, 'Fixed', 'https://example.com/proof.jpg'), true);
  assert.equal(h.writes[0].data.comments.transform, 'union');
  assert.equal(h.writes[0].data.userId, undefined);
  await h.render().handleReopenWorkOrder(id);
  assert.equal(h.writes[1].data.completedAt.transform, 'delete');
  assert.equal(h.writes[1].data.completedBy.transform, 'delete');
});

test('save wrappers preserve ownership, creation time and omitted metadata on updates', async () => {
  const h = harness(), service = h.load('src/services/firestoreSync.ts');
  await service.saveWorkOrderToFirestore({ id: 'order', description: 'Repair', photoUrl: '', userId: 'crew', status: 'Done' });
  const data = h.writes[0].data;
  for (const field of ['createdAt', 'userId', 'userName', 'userEmail', 'comments', 'code', 'placeInLine']) {
    assert.equal(Object.hasOwn(data, field), false, field);
  }
  assert.equal(data.status, 'Done');
});

test('demo mode still creates and comments locally without Firestore writes', async () => {
  const h = harness(false), state = h.start('src/hooks/useCommunityState.ts', 'useCommunityState');
  await state.handleCreatePostSubmit(post);
  const created = h.render().posts[0]; assert.equal(created.title, 'Hello');
  await h.render().handleModalAddComment(created.id, false, 'Local');
  assert.equal(h.render().posts[0].comments.length, 1);
  assert.equal(h.writes.length, 0);
});

test('subscriptions wait for auth, ignore old callbacks, and unsubscribe on logout/unmount', () => {
  const file = path.join(root, 'src/services/liveCollection.ts');
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  let authCallback, stops = 0, authStops = 0, deliveries = 0;
  const snapshots = [], module = { exports: {} };
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`)(name => {
    if (name === 'firebase/auth') return { onAuthStateChanged: (_, callback) => { authCallback = callback; return () => authStops++; } };
    if (name === 'firebase/firestore') return { collection: () => ({}), orderBy: () => ({}), query: () => ({}),
      onSnapshot: (_, next) => { snapshots.push(next); return () => stops++; } };
    return { auth: {}, db: {}, isFirebaseConfigured: () => true };
  }, module, module.exports);
  const stop = module.exports.subscribeToCollection('discussion_feed', () => deliveries++, () => {});
  assert.equal(snapshots.length, 0);
  authCallback({ uid: 'first' }); snapshots[0]({}); assert.equal(deliveries, 1);
  authCallback(null); snapshots[0]({}); assert.equal(deliveries, 1);
  authCallback({ uid: 'second' }); snapshots[1]({}); assert.equal(deliveries, 2);
  stop(); snapshots[1]({}); assert.equal(deliveries, 2);
  assert.equal(stops, 2); assert.equal(authStops, 1);
});
