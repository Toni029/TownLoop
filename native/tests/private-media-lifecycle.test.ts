import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { authenticatedStoragePath, ownsStorageReference, resolveStorageMedia } from '../../src/services/storageReferences.ts';
const compiled = ts.transpileModule(readFileSync(new URL('../src/media/usePrivateMedia.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const bucket = 'demo.firebasestorage.app';
function harness(status = 200, holdFirst = false) {
 let resumeFirst: () => void = () => {};
 const firstDownload = new Promise<void>(resolve => { resumeFirst = resolve; });
 const removed: string[] = [], requests: any[] = [], values: any[] = [];
 let cursor = 0, first = true, cleanup: any, listener: any, cancelled = false;
 const auth: any = { currentUser: null };
 const modules: Record<string, any> = {
  react: { useState: (initial: any) => { const slot = cursor++; if (first) values[slot] = initial; return [values[slot], (value: any) => { values[slot] = typeof value === 'function' ? value(values[slot]) : value; }]; }, useEffect: (effect: any) => { if (first) cleanup = effect(); } },
  'react-native': { Platform: { OS: 'android' } },
  'firebase/auth': { onIdTokenChanged: (_auth: any, callback: any) => { listener = callback; return () => { cancelled = true; }; } },
  'firebase/storage': { ref: () => ({ bucket }) },
  'expo-file-system/legacy': { cacheDirectory: 'file:///private/', downloadAsync: async (url: string, destination: string, options: any) => { requests.push({url, destination, options}); if (holdFirst && requests.length === 1) await firstDownload; return {status, uri: destination}; }, deleteAsync: async (uri: string) => { removed.push(uri); } },
  '../lib/firebase': { auth, storage: {} },
  '../lib/appCheck': { appCheckHeaders: async () => ({'X-Firebase-AppCheck': 'test-attestation'}) },
  '../../../src/services/storageReferences': { authenticatedStoragePath, ownsStorageReference, resolveStorageMedia },
  '../localData/privateMediaCache': { accountMediaPrefix: (uid: string) => `private-${uid}-` },
 };
 const exports: any = {};
 vm.runInNewContext(compiled, { exports, require: (key: string) => modules[key], URL, Date, Math });
 const input = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/feed%2Fvideo.mp4?token=historical-secret`;
 const render = () => { cursor = 0; const result = exports.usePrivateMedia(input, 'video'); first = false; return result; };
 render();
 return { removed, requests, render, resumeFirst: () => resumeFirst(), close: () => cleanup(), stopped: () => cancelled,
  login: async (uid: string | null) => { auth.currentUser = uid ? {uid, getIdToken: async () => `id-token-${uid}`} : null; await listener(auth.currentUser); } };
}
test('native video downloads original with Auth and App Check, strips bearer URL, and cleans private copy on close', async () => {
 const h = harness(); await h.login('resident');
 assert.equal(h.requests.length, 1);
 assert.ok(h.requests[0].url.endsWith('/o/feed%2Fvideo.mp4?alt=media'));
 assert.ok(!h.requests[0].url.includes('historical-secret'));
 assert.equal(h.requests[0].options.headers.Authorization, 'Firebase id-token-resident');
 assert.equal(h.requests[0].options.headers['X-Firebase-AppCheck'], 'test-attestation');
 assert.ok(h.render().uri.endsWith('.mp4'));
 h.close(); assert.deepEqual(h.removed, [h.requests[0].destination]); assert.equal(h.stopped(), true);
});
test('permission denial never presents original bearer URL and deletes failed cache file', async () => {
 const h = harness(403); await h.login('resident');
 assert.equal(h.render().uri, undefined); assert.match(h.render().error, /Unable to load/);
 assert.equal(h.requests.length, 1); assert.deepEqual(h.removed, [h.requests[0].destination]); h.close();
});
test('switching accounts and sign-out removes old bytes and requires a fresh authorized download', async () => {
 const h = harness(); await h.login('first'); const first = h.render().uri;
 await h.login('second'); const second = h.render().uri;
 assert.notEqual(first, second); assert.ok(h.removed.includes(first));
 assert.ok(second.includes('private-second-')); assert.equal(h.requests.length, 2);
 await h.login(null); assert.equal(h.render().uri, undefined); assert.ok(h.removed.includes(second)); h.close();
});

test('a late download from the previous account is discarded and deleted', async () => {
 const h = harness(200, true);
 const previous = h.login('first');
 await new Promise(resolve => setImmediate(resolve));
 assert.equal(h.requests.length, 1);
 await h.login('second');
 const current = h.render().uri;
 h.resumeFirst(); await previous;
 assert.equal(h.render().uri, current);
 assert.ok(current.includes('private-second-'));
 assert.ok(h.removed.includes(h.requests[0].destination));
 h.close();
});
