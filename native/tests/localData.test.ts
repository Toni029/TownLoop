import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createProtectedStorage, type KeyValueStorage } from '../src/localData/chunkedStorage.ts';
class Memory implements KeyValueStorage {
  values = new Map<string, string>();
  failAfter = Infinity;
  writes = 0;
  async getItem(key: string) { return this.values.get(key) ?? null; }
  async setItem(key: string, value: string) {
    if (++this.writes >= this.failAfter) throw Error('disk full');
    assert.ok(Buffer.byteLength(value) <= 1400, 'secret values fit conservative Keychain item budget');
    this.values.set(key, value);
  }
  async removeItem(key: string) { this.values.delete(key); }
}
test('large Unicode medication JSON and token JSON migrate with verified chunking; UID namespaces stay isolated', async () => {
  const legacy = new Memory(), secrets = new Memory();
  const home = JSON.stringify({ medications: [{ name: '💊 名称'.repeat(4000) }], tasks: [] });
  legacy.values.set('uid:a', home);
  const protectedStore = createProtectedStorage(secrets, legacy, JSON.parse);
  assert.equal(await protectedStore.getItem('uid:a'), home);
  assert.equal(legacy.values.has('uid:a'), false);
  assert.equal(await protectedStore.getItem('uid:b'), null);
  assert.equal(await createProtectedStorage(secrets, legacy).getItem('uid:a'), home);
  const tokens = JSON.stringify({ refreshToken: 'token'.repeat(2500) });
  await protectedStore.setItem('firebase:authUser:a', tokens);
  assert.equal(await protectedStore.getItem('firebase:authUser:a'), tokens);
});
test('migration interrupted at any chunk/manifest write preserves original plaintext; retry recovers', async () => {
  for (let failure = 1; failure <= 6; failure++) {
    const legacy = new Memory(), secret = new Memory();
    const value = 'original'.repeat(150);
    legacy.values.set('a', value);
    secret.failAfter = failure;
    const store = createProtectedStorage(secret, legacy);
    await assert.rejects(store.getItem('a'));
    assert.equal(await legacy.getItem('a'), value);
    secret.failAfter = Infinity;
    assert.equal(await store.getItem('a'), value);
    assert.equal(await legacy.getItem('a'), null);
  }
});
test('interrupted updates retain previous committed value and explicit deletion removes both banks only for this resident', async () => {
  const secret = new Memory(), legacy = new Memory(), store = createProtectedStorage(secret, legacy);
  await store.setItem('a', 'previous'.repeat(100));
  await store.setItem('b', 'other resident');
  const before = secret.writes;
  secret.failAfter = before + 3;
  await assert.rejects(store.setItem('a', 'new'.repeat(600)));
  assert.equal(await store.getItem('a'), 'previous'.repeat(100));
  secret.failAfter = Infinity;
  await store.removeItem('a');
  assert.equal(await store.getItem('a'), null);
  assert.equal(await store.getItem('b'), 'other resident');
  assert.equal(secret.values.size, 3); // b manifest, bank count and one chunk
});
test('corruption, conflicting old data, and capacity limits cannot erase legacy records', async () => {
  const secret = new Memory(), legacy = new Memory();
  const store = createProtectedStorage(secret, legacy, JSON.parse);
  legacy.values.set('a', 'broken JSON');
  await assert.rejects(store.getItem('a'));
  assert.equal(await legacy.getItem('a'), 'broken JSON');
  legacy.values.set('a', JSON.stringify({ name: 'x'.repeat(350 * 1024) }));
  await assert.rejects(store.getItem('a'), /capacity/);
  assert.ok(await legacy.getItem('a'));
  legacy.values.delete('a');
  await store.setItem('a', '{"version":1}');
  legacy.values.set('a', '{"version":2}');
  await assert.rejects(store.getItem('a'), /differ/);
  assert.equal(await legacy.getItem('a'), '{"version":2}');
});
test('failed secure readback never deletes migration source', async () => {
  const secret = new Memory(), legacy = new Memory();
  const get = secret.getItem.bind(secret);
  secret.getItem = async key => key.endsWith('.0') ? null : get(key);
  legacy.values.set('a', 'precious medication list');
  await assert.rejects(createProtectedStorage(secret, legacy).getItem('a'), /incomplete/);
  assert.equal(await legacy.getItem('a'), 'precious medication list');
});
test('Firebase-style remove followed by reauthentication is serial and cannot revive deleted credentials', async () => {
  const secret = new Memory(), legacy = new Memory(), store = createProtectedStorage(secret, legacy);
  await store.setItem('auth:a', 'old token');
  await Promise.all([store.removeItem('auth:a'), store.setItem('auth:a', 'new token')]);
  assert.equal(await store.getItem('auth:a'), 'new token');
});
