import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import * as recovery from '../../src/services/registrationRecovery.ts';
import { TERMS_VERSION, requireTermsAcceptance } from '../../src/data/legal.ts';
const ts = createRequire(import.meta.url)('typescript');

// Evaluate the real web auth service against local adapters. No Firebase connection is opened.
function fixture() {
  const user = { uid: 'same-uid', email: 'resident@example.test', displayName: '' };
  const auth: { currentUser: typeof user | null } = { currentUser: null };
  let created = 0, signedIn = 0, createAttempts = 0, writes = 0, failing = true, cosmeticFailure = false;
  let stored: any = null;
  let authNext: any;
  const profileListeners: any[] = [];
  const modules: Record<string, any> = {
    './registrationRecovery': recovery,
    '../data/legal': { TERMS_VERSION, requireTermsAcceptance },
    '../types': {},
    '../firebase': { auth, db: {}, isFirebaseConfigured: () => true },
    'firebase/auth': {
      createUserWithEmailAndPassword: async () => {
        createAttempts++;
        if (created) throw { code: 'auth/email-already-in-use' };
        created++; auth.currentUser = user; return { user };
      },
      signInWithEmailAndPassword: async () => { signedIn++; auth.currentUser = user; return { user }; },
      updateProfile: async () => { if (cosmeticFailure) throw new Error('offline'); },
      onAuthStateChanged: (_auth: unknown, next: any) => { authNext = next; return () => {}; },
    },
    'firebase/firestore': {
      doc: (_db: unknown, _collection: string, uid: string) => uid,
      serverTimestamp: () => 'server-consent-time',
      runTransaction: async (_db: unknown, next: any) => {
        if (failing) throw new Error('offline');
        return next({
          get: async (uid: string) => { assert.equal(uid, user.uid); return { exists: () => !!stored, data: () => stored }; },
          set: (uid: string, data: any) => { assert.equal(uid, user.uid); writes++; stored = data; },
        });
      },
      onSnapshot: (_reference: unknown, next: any, error: any) => {
        profileListeners.push({ next, error }); return () => {};
      },
    },
  };
  const source = readFileSync(new URL('../../src/services/auth.ts', import.meta.url), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports: any = {};
  vm.runInNewContext(output, { exports, require: (name: string) => modules[name], console: { warn() {}, error() {} } });
  return {
    api: exports, auth, profileListeners,
    authNext: (value: unknown) => authNext(value),
    fail: (value: boolean) => { failing = value; },
    failCosmetic: () => { cosmeticFailure = true; },
    stored: () => stored,
    stats: () => ({ created, signedIn, createAttempts, writes }),
  };
}
const input = { name: 'Resident', email: 'Resident@example.test', password: 'test-password', address: '12 Main St', termsAccepted: true };

test('interrupted profile save retries the same UID with preserved consent and does not create a second Auth account', async () => {
  const f = fixture();
  await assert.rejects(f.api.signupUser(input), /sign-in account is ready.*retry Create Account/);
  assert.equal(f.auth.currentUser?.uid, 'same-uid');
  assert.deepEqual(f.stats(), { created: 1, signedIn: 0, createAttempts: 1, writes: 0 });
  f.fail(false);
  const saved = await f.api.signupUser(input);
  assert.equal(saved.id, 'same-uid');
  assert.equal(saved.approved, false);
  assert.equal(f.stored().termsVersion, TERMS_VERSION);
  assert.equal(f.stored().termsAcceptedAt, 'server-consent-time');
  assert.deepEqual(f.stats(), { created: 1, signedIn: 1, createAttempts: 1, writes: 1 });
});

test('reopened registration authenticates an existing password account and requires fresh explicit consent', async () => {
  const f = fixture();
  await assert.rejects(f.api.signupUser(input));
  f.auth.currentUser = null;
  await assert.rejects(f.api.signupUser({ ...input, termsAccepted: false }), /Please read and accept/);
  assert.equal(f.stats().createAttempts, 1);
  f.fail(false); f.failCosmetic();
  assert.equal((await f.api.signupUser(input)).id, 'same-uid');
  assert.equal(f.stats().created, 1);
  assert.equal(f.stats().signedIn, 1);
});

test('a retry after a successful server commit leaves the existing profile and consent unchanged', async () => {
  const f = fixture(); f.fail(false);
  await f.api.signupUser(input);
  const original = f.stored();
  await f.api.signupUser({ ...input, name: 'Changed', address: 'Other address' });
  assert.equal(f.stored(), original);
  assert.equal(f.stored().name, 'Resident');
  assert.equal(f.stats().writes, 1);
});

test('auth profile streams clear previous authority immediately and ignore stale values and errors', () => {
  const f = fixture(); const values: any[] = [];
  const stop = f.api.subscribeToAuth((value: any) => values.push(value));
  const snapshot = { exists: () => true, data: () => ({ name: 'Staff', role: 'admin', approved: true }) };
  f.authNext({ uid: 'old', email: 'old@example.test' });
  f.profileListeners[0].next(snapshot);
  assert.equal(values.at(-1).role, 'admin');
  f.authNext({ uid: 'new', email: 'new@example.test' });
  assert.equal(values.at(-1), null);
  f.profileListeners[0].next(snapshot); f.profileListeners[0].error(new Error('late'));
  assert.equal(values.at(-1), null);
  f.profileListeners[1].next({ exists: () => false });
  assert.equal(values.at(-1), null);
  stop(); f.profileListeners[1].next(snapshot);
  assert.equal(values.at(-1), null);
});
