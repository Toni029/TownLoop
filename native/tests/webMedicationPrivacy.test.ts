import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { createEncryptedMedicationStorage, createIndexedDbMedicationBackend, type MedicationBackend, type EncryptedMedicationRecord } from '../../src/localData/medications.ts';
import type { MedicationItem } from '../../src/types.ts';
const crypto = webcrypto as unknown as Crypto;
const medication: MedicationItem = { id: 'x', name: 'Resident entered 💊', doseCount: 1, bottleCount: 4, timeSlot: 'morning', createdAt: 1 };
class MemoryIdb implements MedicationBackend {
  records = new Map<string, EncryptedMedicationRecord>();
  failWrite = false;
  async get(uid: string) { const record = this.records.get(uid); return record ? structuredClone(record) : undefined; }
  async put(uid: string, value: EncryptedMedicationRecord) { if (this.failWrite) throw Error('Quota exceeded'); this.records.set(uid, structuredClone(value)); }
  async remove(uid: string) { this.records.delete(uid); }
}
test('browser records persist across fresh instances with nonextractable key, fresh IV, Unicode and UID isolation', async () => {
  const backend = new MemoryIdb(), storage = createEncryptedMedicationStorage(backend, crypto);
  await storage.update('a', () => [medication]);
  const first = (await backend.get('a'))!;
  assert.equal(first.key.extractable, false);
  await assert.rejects(crypto.subtle.exportKey('raw', first.key));
  assert.ok(!new TextDecoder().decode(first.ciphertext).includes(medication.name));
  const refreshed = createEncryptedMedicationStorage(backend, crypto);
  assert.deepEqual(await refreshed.load('a'), [medication]);
  assert.deepEqual(await refreshed.load('b'), []);
  await refreshed.update('a', value => value);
  assert.notDeepEqual((await backend.get('a'))!.iv, first.iv);
  await refreshed.update('b', () => []);
  await refreshed.clear('a');
  assert.equal(await backend.get('a'), undefined);
  assert.ok(await backend.get('b'));
});
test('failed writes preserve prior records; authentication failure never resets or overwrites stored records', async () => {
  const backend = new MemoryIdb(), storage = createEncryptedMedicationStorage(backend, crypto);
  await storage.update('a', () => [medication]);
  backend.failWrite = true;
  await assert.rejects(storage.update('a', () => []), /Quota/);
  assert.deepEqual(await storage.load('a'), [medication]);
  backend.failWrite = false;
  const record = (await backend.get('a'))!;
  await backend.put('b', record); // Same key, different UID: authenticated context rejects.
  await assert.rejects(storage.load('b'));
  await assert.rejects(storage.update('b', () => []));
  assert.deepEqual((await backend.get('b'))!.ciphertext, record.ciphertext);
  new Uint8Array(record.ciphertext)[0] ^= 1;
  await backend.put('a', record);
  await assert.rejects(storage.load('a'));
});
test('rapid edits read the latest durable value and explicit empty lists survive reload', async () => {
  const backend = new MemoryIdb(), storage = createEncryptedMedicationStorage(backend, crypto);
  await storage.update('a', () => [medication]);
  await Promise.all([storage.update('a', values => values.map(m => ({...m, bottleCount: m.bottleCount + 1}))), storage.update('a', values => values.map(m => ({...m, bottleCount: m.bottleCount + 1})))]);
  assert.equal((await storage.load('a'))[0].bottleCount, 6);
  await storage.update('a', () => []);
  assert.deepEqual(await createEncryptedMedicationStorage(backend, crypto).load('a'), []);
});
test('readback verification failure rejects saves without a success acknowledgement', async () => {
  const backend = new MemoryIdb();
  backend.put = async () => {}; // Synthetic failed/no-op IDB commit.
  await assert.rejects(createEncryptedMedicationStorage(backend, crypto).update('a', () => [medication]), /verification/);
});
test('IndexedDB adapter waits for transaction commit and reports aborted transactions', async () => {
  let transaction: any;
  const record = { key: 'synthetic key', value: 'ciphertext' };
  const factory = { open: () => {
    const request: any = { result: {
      createObjectStore() {},
      transaction() { transaction = { objectStore: () => ({ get: () => ({ result: record }) }) }; return transaction; },
    } };
    queueMicrotask(() => request.onsuccess());
    return request;
  } } as unknown as IDBFactory;
  const backend = createIndexedDbMedicationBackend(factory);
  let resolved = false;
  const reading = backend.get('a').then(value => { resolved = true; return value; });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(resolved, false);
  transaction.oncomplete();
  assert.equal(await reading, record);
  const aborted = backend.get('a');
  await new Promise(resolve => setTimeout(resolve, 0));
  transaction.onabort();
  await assert.rejects(aborted, /interrupted/);
});
test('browser UI does not store plaintext or erase unattributed legacy records during copy; save modal awaits durability', () => {
  const component = readFileSync(new URL('../../src/components/DailyMedications.tsx', import.meta.url), 'utf8');
  assert.ok(!component.includes('localStorage.setItem'));
  assert.ok(!component.includes('sessionStorage.setItem'));
  assert.ok(component.includes('key={String(props.userId)}'));
  assert.ok(component.includes('await change(current =>'));
  const copy = component.split('async function copyLegacy()')[1].split('function removeLegacy()')[0];
  assert.ok(!copy.includes('removeItem'));
  assert.ok(component.includes('not medical advice'));
  assert.ok(component.includes('Reminders are not guaranteed'));
  const modal = readFileSync(new URL('../../src/components/AddMedicationModal.tsx', import.meta.url), 'utf8');
  assert.ok(modal.includes('await onSave('));
  assert.ok(modal.includes('saved === false'));
});
