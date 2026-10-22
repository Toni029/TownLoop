import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const ts = createRequire(import.meta.url)('typescript');

// A minimal hook scheduler runs the actual hook with local stream adapters.
function fixture() {
  const slots: any[] = [];
  let index = 0;
  const pending: Array<() => void> = [];
  const equal = (a: any[], b: any[]) => a?.length === b?.length && a.every((value, n) => Object.is(value, b[n]));
  const react = {
    useState(initial: any) {
      const n = index++;
      if (!slots[n]) slots[n] = { value: typeof initial === 'function' ? initial() : initial };
      return [slots[n].value, (value: any) => { slots[n].value = typeof value === 'function' ? value(slots[n].value) : value; }];
    },
    useRef(initial: any) { const n = index++; return slots[n] ||= { current: initial }; },
    useCallback(fn: any, dependencies: any[]) {
      const n = index++;
      if (!slots[n] || !equal(slots[n].dependencies, dependencies)) slots[n] = { value: fn, dependencies };
      return slots[n].value;
    },
    useEffect(fn: any, dependencies: any[]) {
      const n = index++;
      if (!slots[n] || !equal(slots[n].dependencies, dependencies)) {
        const old = slots[n];
        const next = { dependencies, stop: undefined as any }; slots[n] = next;
        pending.push(() => { old?.stop?.(); next.stop = fn(); });
      }
    },
  };
  const streams: any[] = [];
  let stopped = 0;
  let directoryNext: any;
  const modules: Record<string, any> = {
    react,
    '../services/auth': { subscribeToCommunityDirectory: (next: any) => { directoryNext = next; return () => {}; } },
    '../services/marketplaceChat': { subscribeMarketplaceChats: (_user: unknown, next: any) => { next([]); return () => {}; } },
    '../services/firestoreSync': {}, '../services/socialIntegrity': {}, '../types': {},
    '../firebase': { db: {}, auth: {}, isFirebaseConfigured: () => true },
    'firebase/firestore': {
      collection: (_db: unknown, name: string) => name,
      query: (source: unknown) => source, orderBy: () => {}, where: () => {},
      onSnapshot: (source: string, _options: unknown, next: any, fail: any) => {
        streams.push({ source, next, fail }); return () => { stopped++; };
      },
    },
  };
  const source = readFileSync(new URL('../../src/hooks/useCommunityState.ts', import.meta.url), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports: any = {};
  vm.runInNewContext(output, { exports, require: (name: string) => modules[name], localStorage: { removeItem() {} }, console: { warn() {} } });
  return {
    streams,
    stopped: () => stopped,
    directory: (users: any[]) => directoryNext(users),
    render(user: any) { index = 0; return exports.useCommunityState(user); },
    flush() { while (pending.length) pending.shift()!(); },
  };
}
const user = { id: 'resident', name: 'Resident', role: 'resident', approved: true, avatarUrl: '' };
const postSnapshot = { metadata: { hasPendingWrites: false }, docs: [{ id: 'post', data: () => ({ userId: 'resident', author: 'Resident', title: 'Hello' }) }] };

test('profile and directory avatar edits update local state without reattaching full-history feed listeners', () => {
  const f = fixture(); f.render(user); f.flush();
  assert.equal(f.streams.length, 2);
  f.streams[0].next(postSnapshot);
  assert.equal(f.render(user).posts.length, 1); f.flush();
  f.directory([{ id: 'resident', name: 'Resident', avatar: 'new-avatar' }]);
  f.render({ ...user, avatarUrl: 'new-avatar' }); f.flush();
  assert.equal(f.streams.length, 2);
  assert.equal(f.stopped(), 0);
});

test('role changes immediately hide prior records and reject queued old snapshots before effect cleanup', () => {
  const f = fixture(); f.render(user); f.flush(); f.streams[0].next(postSnapshot);
  assert.equal(f.render(user).posts.length, 1); f.flush();
  const changed = { ...user, role: 'crew' };
  assert.equal(f.render(changed).posts.length, 0);
  f.streams[0].next(postSnapshot);
  assert.equal(f.render(changed).posts.length, 0);
  f.flush();
  assert.equal(f.stopped(), 2);
  f.streams[0].next(postSnapshot);
  assert.equal(f.render(changed).posts.length, 0);
  f.streams[2].next(postSnapshot);
  assert.equal(f.render(changed).posts.length, 1);
});
