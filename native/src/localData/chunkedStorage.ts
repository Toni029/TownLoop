/** Platform-independent, bounded, copy-on-write secret storage. No plaintext fallback. */
export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}
const MAX_CHUNKS = 1024;
// At most 1,400 UTF-8 bytes, below the historical 2 KB Keychain value limit.
const CHUNK_CHARACTERS = 350;
const secretKey = (key: string) => 'tl.' + Array.from(key).map(c => c.codePointAt(0)!.toString(16) + '-').join('');
type Commit = { bank: 0 | 1; count: number };
function parseCommit(raw: string): Commit {
  const c = JSON.parse(raw);
  if ((c.bank !== 0 && c.bank !== 1) || !Number.isInteger(c.count) || c.count < 1 || c.count > MAX_CHUNKS) throw Error('Invalid secure data manifest');
  return c;
}
export function createProtectedStorage(secret: KeyValueStorage, legacy: KeyValueStorage, validate: (value: string) => unknown = () => {}) {
  const queues = new Map<string, Promise<unknown>>();
  function serial<T>(key: string, action: () => Promise<T>): Promise<T> {
    const next = (queues.get(key) ?? Promise.resolve()).catch(() => {}).then(action);
    queues.set(key, next);
    void next.finally(() => { if (queues.get(key) === next) queues.delete(key); }).catch(() => {});
    return next;
  }
  async function read(key: string, commit: Commit): Promise<string> {
    const parts: string[] = [];
    for (let i = 0; i < commit.count; i++) {
      const part = await secret.getItem(`${key}.${commit.bank}.${i}`);
      if (part === null) throw Error('Secure data is incomplete; original records have not been replaced');
      parts.push(part);
    }
    return parts.join('');
  }
  async function write(key: string, value: string) {
    validate(value);
    const chars = Array.from(value), parts: string[] = [];
    for (let i = 0; i < chars.length; i += CHUNK_CHARACTERS) parts.push(chars.slice(i, i + CHUNK_CHARACTERS).join(''));
    if (!parts.length) parts.push('');
    if (parts.length > MAX_CHUNKS) throw Error('Secure storage capacity exceeded; saved data has been preserved');
    const raw = await secret.getItem(key);
    const previous = raw === null ? null : parseCommit(raw);
    const commit: Commit = { bank: previous?.bank === 0 ? 1 : 0, count: parts.length };
    // Remember high water mark before writes so explicit deletion also removes interrupted writes.
    const highKey = `${key}.${commit.bank}.count`;
    const oldCount = Number(await secret.getItem(highKey) ?? 0);
    if (!Number.isInteger(oldCount) || oldCount < 0 || oldCount > MAX_CHUNKS) throw Error('Invalid secure cleanup manifest');
    await secret.setItem(highKey, String(Math.max(oldCount, parts.length)));
    for (let i = 0; i < parts.length; i++) await secret.setItem(`${key}.${commit.bank}.${i}`, parts[i]);
    if (await read(key, commit) !== value) throw Error('Secure write verification failed');
    await secret.setItem(key, JSON.stringify(commit));
    if (await secret.getItem(key) !== JSON.stringify(commit) || await read(key, commit) !== value) throw Error('Secure commit verification failed');
  }
  return {
    getItem: (sourceKey: string) => serial(sourceKey, async () => {
      const key = secretKey(sourceKey), raw = await secret.getItem(key);
      if (raw !== null) {
        const value = await read(key, parseCommit(raw));
        validate(value);
        // Never discard divergent legacy records (for example, written by a downgraded app).
        const old = await legacy.getItem(sourceKey);
        if (old !== null && old !== value) throw Error('Secure and legacy records differ; both copies have been preserved');
        // Finish migration if a prior run stopped after committing the secure copy.
        await legacy.removeItem(sourceKey);
        return value;
      }
      const value = await legacy.getItem(sourceKey);
      if (value === null) return null;
      validate(value);
      await write(key, value);
      await legacy.removeItem(sourceKey);
      return value;
    }),
    setItem: (sourceKey: string, value: string) => serial(sourceKey, async () => {
      await write(secretKey(sourceKey), value);
      await legacy.removeItem(sourceKey);
    }),
    removeItem: (sourceKey: string) => serial(sourceKey, async () => {
      const key = secretKey(sourceKey);
      await legacy.removeItem(sourceKey);
      for (const bank of [0, 1]) {
        const count = Number(await secret.getItem(`${key}.${bank}.count`) ?? 0);
        if (!Number.isInteger(count) || count < 0 || count > MAX_CHUNKS) throw Error('Invalid secure cleanup manifest');
        for (let i = 0; i < count; i++) await secret.removeItem(`${key}.${bank}.${i}`);
        await secret.removeItem(`${key}.${bank}.count`);
      }
      await secret.removeItem(key);
    }),
  };
}
