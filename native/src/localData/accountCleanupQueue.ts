/** Durable cleanup retries contain only account IDs in the existing protected adapter. */
import type { KeyValueStorage } from './chunkedStorage';
const KEY = 'townloop_account_cleanup_pending_v1';
const valid = (uid: unknown): uid is string => typeof uid === 'string' && uid.length > 0 && uid.length <= 128 && !/[\u0000-\u001f/]/.test(uid);
export function createAccountCleanupQueue(storage: KeyValueStorage, clear: (uid: string) => Promise<void>, onCleared: (uid: string) => Promise<void> = async () => {}) {
  let tail: Promise<unknown> = Promise.resolve();
  const run = <T>(action: () => Promise<T>): Promise<T> => {
    const next = tail.then(action, action); tail = next.catch(() => {}); return next;
  };
  async function read(): Promise<string[]> {
    const raw = await storage.getItem(KEY);
    if (!raw) return [];
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value) || !value.every(valid)) throw Error('Account cleanup queue needs recovery.');
    return [...new Set(value)];
  }
  async function drain(ids: string[]) {
    let firstError: unknown;
    const completed: string[] = [];
    for (const uid of [...ids]) {
      try {
        await clear(uid);
        // Do this per account, even if another account's locked storage fails.
        // Keep the proof queued if completion/sign-out itself is interrupted.
        await onCleared(uid);
        completed.push(uid);
        ids = ids.filter(id => id !== uid);
        if (ids.length) await storage.setItem(KEY, JSON.stringify(ids)); else await storage.removeItem(KEY);
      } catch (error) { firstError ??= error; }
    }
    if (firstError) throw firstError;
    return completed;
  }
  return {
    enqueue(uid: string) { return run(async () => {
      if (!valid(uid)) throw Error('Invalid cleanup account.');
      const ids = await read();
      if (!ids.includes(uid)) { ids.push(uid); await storage.setItem(KEY, JSON.stringify(ids)); }
      await drain(ids);
    }); },
    retry() { return run(async () => drain(await read())); },
  };
}
