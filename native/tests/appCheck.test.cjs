const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function fixture({ platform = 'android', missing = false, debug = false, initError = false, sdkError = false, lookupError = false, appState = 'active', missingAppState = false } = {}) {
  let provider, installs = 0, nativeInitializations = 0, fail = false, hang = false;
  let result = { token: 'genuine-native-token', expireTimeMillis: Date.now() + 3600000 };
  const calls = [], refreshFlags = [], initialSettings = [], listeners = [];
  const sdk = {};let refreshError = false;
  const native = {
    initialize() { nativeInitializations++; if (initError) throw Error('sensitive native failure'); },
    async getToken(forceRefresh) { calls.push(forceRefresh); if (fail) throw Error('sensitive token'); if (hang) return new Promise(() => {}); return result; },
  };
  const deps = {
    expo: { requireOptionalNativeModule(name) { assert.equal(name, 'TownLoopAppCheck'); if (lookupError) throw Error('missing'); return missing ? null : native; } },
    'react-native': { Platform: { OS: platform }, ...(missingAppState ? {} : { AppState: { currentState: appState, addEventListener(event, listener) { assert.equal(event, 'change');listeners.push(listener);return { remove() {} }; } } }) },
    'firebase/app-check': {
      CustomProvider: class { constructor(options) { provider = options; } },
      setTokenAutoRefreshEnabled(instance, enabled) { assert.equal(instance,sdk);if(refreshError)throw Error('private lifecycle details');refreshFlags.push(enabled); },
      initializeAppCheck(app, options) { installs++; if (sdkError) throw Error('sdk failure'); initialSettings.push(options.isTokenAutoRefreshEnabled); return sdk; },
    },
  };
  const module = { exports: {} };
  const output = ts.transpileModule(fs.readFileSync(require.resolve('../src/lib/appCheck.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(output, { module, exports: module.exports, require(id) { assert(id in deps, id); return deps[id]; }, Date, Promise, setTimeout: fn => setTimeout(fn, 10), clearTimeout, FIREBASE_APPCHECK_DEBUG_TOKEN: debug });
  return { api: module.exports, calls, refreshFlags, initialSettings, listeners, state: value => listeners.forEach(fn => fn(value)), refreshError: () => { refreshError = true; }, installs: () => installs, nativeInitializations: () => nativeInitializations, provider: () => provider, fail: () => { fail = true; }, hang: () => { hang = true; }, result: value => { result = value; } };
}
test('optional bridge and unsupported platforms preserve older binaries', async () => {
  for (const options of [{ missing: true }, { platform: 'ios' }, { platform: 'web' }, { lookupError: true }]) {
    const h = fixture(options); assert.doesNotThrow(() => h.api.initializeNativeAppCheck({}));
    assert.equal(h.installs(), 0); assert.equal(Object.keys(await h.api.appCheckHeaders()).length, 0);
  }
});
test('installs once before services and uses native real tokens for custom provider and manual headers', async () => {
  const h = fixture(); h.api.initializeNativeAppCheck({}); h.api.initializeNativeAppCheck({});
  assert.equal(h.installs(), 1); assert.equal(h.nativeInitializations(), 1);
  assert.equal((await h.provider().getToken()).token, 'genuine-native-token');
  assert.equal((await h.api.appCheckHeaders())['X-Firebase-AppCheck'], 'genuine-native-token');
  assert.deepEqual(h.calls, [true, false]);
});
test('monitoring failures never throw into app startup or custom requests', async () => {
  for (const options of [{ initError: true }, { sdkError: true }]) {
    const h = fixture(options); assert.doesNotThrow(() => h.api.initializeNativeAppCheck({}));
    assert.equal(Object.keys(await h.api.appCheckHeaders()).length, 0);
  }
  const h = fixture(); h.api.initializeNativeAppCheck({}); h.fail();
  assert.equal(Object.keys(await h.api.appCheckHeaders()).length, 0);
  await assert.rejects(h.provider().getToken(), error => !error.message.includes('sensitive'));
});
test('expired/empty token responses are rejected, never replaced by fake tokens', async () => {
  for (const result of [{ token: '', expireTimeMillis: Date.now() + 3600000 }, { token: 'expired', expireTimeMillis: Date.now() - 1 }, { token: 'bad', expireTimeMillis: NaN }, null]) {
    const h = fixture(); h.api.initializeNativeAppCheck({}); h.result(result);
    assert.equal(Object.keys(await h.api.appCheckHeaders()).length, 0);
    await assert.rejects(h.provider().getToken());
  }
});
test('native stall has a bounded monitoring wait', async () => {
  const h = fixture(); h.api.initializeNativeAppCheck({}); h.hang();
  assert.equal(Object.keys(await h.api.appCheckHeaders()).length, 0);
  await assert.rejects(h.provider().getToken());
});
test('debug SDK flag cannot select Firebase JS debug exchange', async () => {
  const h = fixture({ debug: true }); h.api.initializeNativeAppCheck({});
  assert.equal(h.installs(), 0); assert.equal(Object.keys(await h.api.appCheckHeaders()).length, 0);
});
test('native module ships Play Integrity only and validates TownLoop identity', () => {
  const root = '../modules/townloop-app-check/';
  const gradle = fs.readFileSync(require.resolve(root + 'android/build.gradle'), 'utf8');
  const kotlin = fs.readFileSync(require.resolve(root + 'android/src/main/java/expo/modules/townloopappcheck/TownLoopAppCheckModule.kt'), 'utf8');
  assert.match(gradle, /firebase-appcheck-playintegrity:19\.0\.1/);
  assert.doesNotMatch(gradle + kotlin, /firebase-appcheck-debug|DebugAppCheckProvider|debugToken/);
  for (const value of ['com.townloop.app', 'cc-livingcommunity-app', '1:883715389126:android:869aa93ffdc82d5127c9c7']) assert(kotlin.includes(value));
  assert.match(kotlin, /expireTimeMillis/);
  assert.match(kotlin, /setTokenAutoRefreshEnabled\(false\)/);
  assert.deepEqual(JSON.parse(fs.readFileSync(require.resolve(root + 'expo-module.config.json'))).platforms, ['android']);
});
test('Firebase startup initializes the bridge before Auth, Firestore and Storage', () => {
  const calls = [], app = {};
  const deps = {
    '../localData/nativeStorage': { authPersistenceStorage: {} },
    'firebase/app': { getApps: () => [], initializeApp: () => app },
    './appCheck': { initializeNativeAppCheck: value => { assert.equal(value, app); calls.push('app-check'); } },
    'firebase/auth': { getReactNativePersistence: () => ({}), initializeAuth: () => { calls.push('auth'); return {}; } },
    'firebase/firestore': { getFirestore: () => { calls.push('firestore'); return {}; } },
    'firebase/storage': { getStorage: () => { calls.push('storage'); return {}; } },
    '../../firebase-config.json': {},
  };
  const module = { exports: {} };
  const output = ts.transpileModule(fs.readFileSync(require.resolve('../src/lib/firebase.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInNewContext(output, { module, exports: module.exports, require: id => deps[id] });
  assert.deepEqual(calls, ['app-check', 'auth', 'firestore', 'storage']);
});
test('JS refresh follows app visibility once; native SDK and foreground callbacks do not request extra tokens', async () => {
  const h=fixture();h.api.initializeNativeAppCheck({});h.api.initializeNativeAppCheck({});
  assert.deepEqual(h.initialSettings,[true]);assert.equal(h.listeners.length,1);
  h.state('background');h.state('inactive');h.state('active');h.state('active');
  assert.deepEqual(h.refreshFlags,[false,true]);assert.deepEqual(h.calls,[]);
  assert.equal((await h.api.appCheckHeaders())['X-Firebase-AppCheck'],'genuine-native-token');
  h.state('background');h.result({token:'expired',expireTimeMillis:Date.now()-1});
  assert.equal(Object.keys(await h.api.appCheckHeaders()).length,0);assert.deepEqual(h.calls,[false,false]);
});
test('background cold launch disables JS refresh and missing AppState retains fixture compatibility',()=>{
  const background=fixture({appState:'background'});background.api.initializeNativeAppCheck({});
  assert.deepEqual(background.initialSettings,[false]);background.state('active');assert.deepEqual(background.refreshFlags,[true]);
  const missing=fixture({missingAppState:true});missing.api.initializeNativeAppCheck({});assert.deepEqual(missing.initialSettings,[true]);assert.equal(missing.listeners.length,0);
});
test('refresh lifecycle failures remain monitoring-only and do not replace genuine headers',async()=>{
  const h=fixture();h.api.initializeNativeAppCheck({});h.refreshError();assert.doesNotThrow(()=>h.state('background'));
  assert.equal((await h.api.appCheckHeaders())['X-Firebase-AppCheck'],'genuine-native-token');
  const failed=fixture({sdkError:true});failed.api.initializeNativeAppCheck({});assert.equal(failed.listeners.length,0);
});
