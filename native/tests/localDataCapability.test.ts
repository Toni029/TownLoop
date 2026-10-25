import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require('typescript');
test('older binaries keep auth/home usable without ever requiring the missing SecureStore native module', async () => {
  const removed: string[] = [];
  const asyncStorage = { getItem: async () => null, setItem: async () => {}, removeItem: async (key: string) => { removed.push(key); } };
  const module = { exports: {} as any };
  const source = readFileSync(new URL('../src/localData/nativeStorage.ts', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, {
    module, exports: module.exports,
    require: (name: string) => {
      if (name === '@react-native-async-storage/async-storage') return asyncStorage;
      if (name === 'expo') return { requireOptionalNativeModule: () => null };
      if (name === 'react-native') return { Platform: { OS: 'android' } };
      if (name === './chunkedStorage') return { createProtectedStorage: () => { throw Error('Should not build protected adapter without capability'); } };
      if (name === '../home/model') return { storageKey: (uid: string) => `townloop:home:v1:${uid}` };
      throw Error(`Unexpected module load on older binary: ${name}`);
    },
  });
  assert.equal(module.exports.hasProtectedStorage, false);
  assert.equal(module.exports.authPersistenceStorage, asyncStorage);
  assert.equal(await module.exports.protectedHomeStorage.getItem('unrelated'),null);
  await module.exports.clearResidentHomeData('resident-a');
  assert.deepEqual(removed, ['townloop:home:v1:resident-a']);
  await assert.rejects(module.exports.protectedHomeStorage.setItem('townloop:home:v1:resident-a','late write'),/removed/);
  await module.exports.protectedHomeStorage.setItem('townloop:home:v1:resident-b','other account');
});
