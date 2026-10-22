import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TERMS_VERSION, PRIVACY_URL, TERMS_URL, requireTermsAcceptance } from '../../src/data/legal.ts';

test('consent accepts only explicit true, never truthy or absent values', () => {
  for (const value of [false, undefined, null, 'true', 1, {}]) assert.throws(() => requireTermsAcceptance(value), /Please read and accept/);
  assert.doesNotThrow(() => requireTermsAcceptance(true));
});
test('legal contract identifies version and public HTTPS endpoints', () => {
  assert.equal(TERMS_VERSION, '2026-10-draft1');
  assert.equal(PRIVACY_URL, 'https://townloop.web.app/privacy.html');
  assert.equal(TERMS_URL, 'https://townloop.web.app/terms.html');
});
test('native signup validates before credentials and records server consent', () => {
  const source = readFileSync(new URL('../src/components/ResidentRegistration.tsx', import.meta.url), 'utf8');
  assert.ok(source.indexOf('requireTermsAcceptance(termsAccepted)') < source.indexOf('const credential = await createUserWithEmailAndPassword'));
  assert.match(source, /termsAcceptedAt: serverTimestamp\(\)/);
  assert.match(source, /termsVersion: TERMS_VERSION/);
  assert.match(source, /accessibilityRole="checkbox"/);
});

// Execute the real auth service with isolated Firebase adapters: no network or production data.
import { createRequire } from 'node:module';
import vm from 'node:vm';
const typescript = createRequire(import.meta.url)('typescript');
function service(existing: boolean) {
  const writes: any[] = [];
  let created = 0;
  let signedOut = 0;
  const user = { uid: 'test-resident', email: 'resident@example.test', displayName: 'Resident' };
  const timestamp = { serverTimestamp: true };
  const modules: Record<string, any> = {
    'firebase/auth': {
      createUserWithEmailAndPassword: async () => { created++; return { user }; },
      updateProfile: async () => {},
      signInWithPopup: async () => ({ user }),
      signOut: async () => { signedOut++; },
      GoogleAuthProvider: class {},
    },
    'firebase/firestore': {
      doc: () => ({}), serverTimestamp: () => timestamp,
      getDoc: async () => ({ exists: () => existing, data: () => ({ name: 'Existing', role: 'resident', approved: true }) }),
      setDoc: async (_reference: unknown, data: unknown) => { writes.push(data); },
    },
    '../firebase': { auth: {}, db: {}, isFirebaseConfigured: () => true, handleFirestoreError: (error: unknown) => { throw error; }, OperationType: {} },
    '../data/legal': { TERMS_VERSION, requireTermsAcceptance },
    '../types': {},
  };
  const source = readFileSync(new URL('../../src/services/auth.ts', import.meta.url), 'utf8');
  const output = typescript.transpileModule(source, { compilerOptions: { module: typescript.ModuleKind.CommonJS, target: typescript.ScriptTarget.ES2022 } }).outputText;
  const exports: any = {};
  vm.runInNewContext(output, { exports, require: (name: string) => modules[name], console: { warn() {}, error() {} } });
  return { api: exports, writes, timestamp, created: () => created, signedOut: () => signedOut };
}

test('web signup refuses absent consent before Firebase Auth and stores server provenance after acceptance', async () => {
  const mock = service(false);
  const input = { name: 'Resident', email: 'resident@example.test', password: 'test-only-password' };
  await assert.rejects(mock.api.signupUser(input), /Please read and accept/);
  assert.equal(mock.created(), 0);
  await mock.api.signupUser({ ...input, termsAccepted: true });
  assert.equal(mock.created(), 1);
  assert.equal(mock.writes[0].termsVersion, TERMS_VERSION);
  assert.equal(mock.writes[0].termsAcceptedAt, mock.timestamp);
});

test('Google missing-profile consent cannot silently write acceptance; existing accounts still sign in', async () => {
  const missing = service(false);
  await assert.rejects(missing.api.loginWithGoogle(), /Please read and accept/);
  assert.equal(missing.signedOut(), 1);
  assert.equal(missing.writes.length, 0);
  await missing.api.loginWithGoogle(true);
  assert.equal(missing.writes[0].termsAcceptedAt, missing.timestamp);
  const existing = service(true);
  assert.equal((await existing.api.loginWithGoogle()).name, 'Existing');
  assert.equal(existing.writes.length, 0);
});
