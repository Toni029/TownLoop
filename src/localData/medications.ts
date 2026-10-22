import type { MedicationItem } from '../types';

export interface EncryptedMedicationRecord {
  version: 1;
  key: CryptoKey;
  iv: Uint8Array;
  ciphertext: ArrayBuffer;
}
export interface MedicationBackend {
  get(uid: string): Promise<EncryptedMedicationRecord | undefined>;
  put(uid: string, value: EncryptedMedicationRecord): Promise<void>;
  remove(uid: string): Promise<void>;
}
const STORE = 'residents';
/** One atomic IndexedDB record holds the nonextractable key and encrypted data. */
export function createIndexedDbMedicationBackend(factory: IDBFactory): MedicationBackend {
  let database: Promise<IDBDatabase> | undefined;
  function open() {
    return database ??= new Promise((resolve, reject) => {
      const request = factory.open('townloop-private-medications', 1);
      request.onupgradeneeded = () => { request.result.createObjectStore(STORE); };
      request.onsuccess = () => {
        request.result.onversionchange = () => { request.result.close(); database = undefined; };
        resolve(request.result);
      };
      request.onerror = () => { database = undefined; reject(request.error); };
      request.onblocked = () => { database = undefined; reject(Error('Close other TownLoop tabs and retry storage access.')); };
    });
  }
  async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const request = action(transaction.objectStore(STORE));
      // Request success is not durability: acknowledge only the transaction commit.
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error ?? request.error ?? Error('Browser storage failed'));
      transaction.onabort = () => reject(transaction.error ?? Error('Browser storage was interrupted'));
    });
  }
  return {
    get: uid => run('readonly', store => store.get(uid)),
    put: async (uid, value) => { await run('readwrite', store => store.put(value, uid)); },
    remove: async uid => { await run('readwrite', store => store.delete(uid)); },
  };
}
export function validateMedications(value: unknown): MedicationItem[] {
  const slots = ['morning', 'noon', 'evening', 'bedtime'];
  if (!Array.isArray(value) || !value.every(m => m && typeof m.id === 'string' && typeof m.name === 'string' && Number.isInteger(m.doseCount) && m.doseCount > 0 && Number.isInteger(m.bottleCount) && m.bottleCount >= 0 && slots.includes(m.timeSlot))) throw Error('Saved medication records could not be read; existing data has been preserved.');
  return value;
}
export function createEncryptedMedicationStorage(backend: MedicationBackend, cryptography: Crypto) {
  const queue = new Map<string, Promise<unknown>>();
  const memory = new Map<string, MedicationItem[]>();
  function serial<T>(uid: string, action: () => Promise<T>): Promise<T> {
    const next = (queue.get(uid) ?? Promise.resolve()).catch(() => {}).then(() => globalThis.navigator?.locks ? globalThis.navigator.locks.request('townloop-medications:' + uid, action) : action());
    queue.set(uid, next);
    void next.finally(() => { if (queue.get(uid) === next) queue.delete(uid); }).catch(() => {});
    return next;
  }
  const context = (uid: string) => new TextEncoder().encode(`townloop-medications:v1:${uid}`);
  async function decrypt(uid: string, record: EncryptedMedicationRecord) {
    if (record.version !== 1 || record.key.extractable || record.iv.length !== 12) throw Error('Invalid encrypted medication record; existing data has been preserved.');
    const plaintext = await cryptography.subtle.decrypt({ name: 'AES-GCM', iv: record.iv as BufferSource, additionalData: context(uid) }, record.key, record.ciphertext);
    return validateMedications(JSON.parse(new TextDecoder().decode(plaintext)));
  }
  async function read(uid: string) {
    const record = await backend.get(uid);
    return record ? decrypt(uid, record) : [];
  }
  return {
    load: (uid: string) => serial(uid, async () => {
      const data = await read(uid);
      memory.set(uid, data);
      return data;
    }),
    update: (uid: string, update: (current: MedicationItem[]) => MedicationItem[]) => serial(uid, async () => {
      const currentRecord = await backend.get(uid);
      const current = currentRecord ? await decrypt(uid, currentRecord) : [];
      const data = validateMedications(update(current));
      const key = currentRecord?.key ?? await cryptography.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      const iv = cryptography.getRandomValues(new Uint8Array(12));
      const json = JSON.stringify(data);
      const ciphertext = await cryptography.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: context(uid) }, key, new TextEncoder().encode(json));
      await backend.put(uid, { version: 1, key, iv, ciphertext });
      const saved = await backend.get(uid);
      if (!saved || JSON.stringify(await decrypt(uid, saved)) !== json) throw Error('Browser save verification failed. Please retry.');
      memory.set(uid, data);
      return data;
    }),
    clear: (uid: string) => serial(uid, async () => {
      await backend.remove(uid);
      if (await backend.get(uid)) throw Error('Browser medication cleanup could not be verified.');
      memory.delete(uid);
    }),
  };
}
let storage: ReturnType<typeof createEncryptedMedicationStorage> | undefined;
function browserStorage() {
  if (!globalThis.indexedDB || !globalThis.crypto?.subtle) throw Error('Secure browser storage is unavailable. Use a supported browser over HTTPS; existing data has been preserved.');
  return storage ??= createEncryptedMedicationStorage(createIndexedDbMedicationBackend(globalThis.indexedDB), globalThis.crypto);
}
export const loadResidentMedications = (uid: string) => browserStorage().load(uid);
export const updateResidentMedications = (uid: string, update: (current: MedicationItem[]) => MedicationItem[]) => browserStorage().update(uid, update);
/** Account deletion only; ordinary logout preserves encrypted resident records. */
export const clearSessionMedications = async (uid: string) => {
  await browserStorage().clear(uid);
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel('townloop-medication-deletion');
    channel.postMessage({ uid, type: 'deleted' });
    channel.close();
  }
};
