import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { deadline, uploadHttpError } from '../src/media/deadline.ts';

const source = ts.transpileModule(readFileSync(new URL('../src/media/uploadFile.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
function harness(status = 200, linkFails = false) {
  const calls: any[] = [];
  let onAuth: (user: any) => void = () => {};
  const user = { uid: 'resident', getIdToken: async () => 'test-user-token' };
  const auth = { currentUser: user };
  let cancelled = false, unsubscribed = false;
  const fakeModules: Record<string, any> = {
    'react-native': { Platform: { OS: 'android' } },
    'expo-file-system/legacy': {
      FileSystemUploadType: { BINARY_CONTENT: 0 }, FileSystemSessionType: { FOREGROUND: 0 },
      createUploadTask: (url: string, uri: string, options: any, progress: any) => {
        calls.push({ url, uri, options });
        return { uploadAsync: async () => {
          progress({ totalBytesSent: 2_000_000, totalBytesExpectedToSend: 4_000_000 });
          return { status, body: '{}' };
        }, cancelAsync: async () => { cancelled = true; } };
      },
    },
    'firebase/auth': { onAuthStateChanged: (_auth: any, fn: any) => { onAuth = fn; return () => { unsubscribed = true; }; } },
    'firebase/storage': {
      ref: (_storage: any, path: string) => ({ bucket: 'existing-bucket', fullPath: path }),
      getDownloadURL: async (ref: any) => { if (linkFails) throw Error('Link unavailable'); return `https://example.invalid/${ref.fullPath}`; },
      uploadBytesResumable: () => { throw Error('Native must never use browser Blob upload'); },
    },
    '../lib/firebase': { auth, storage: {} },
    './deadline': { deadline, uploadHttpError },
  };
  const exports: any = {};
  vm.runInNewContext(source, {
    exports, require: (name: string) => fakeModules[name], AbortController, URL,
    fetch: async (url: string, options: any) => {
      calls.push({ url, options });
      return { ok: true, headers: { get: () => 'https://firebasestorage.googleapis.com/session' } };
    },
  });
  return { upload: exports.uploadFile, calls, signOut: () => onAuth(null), cleaned: () => cancelled && unsubscribed };
}
for (const folder of ['work_orders', 'feed', 'marketplace']) {
  test(`${folder}: native transport streams file, preserves metadata and returns persistent URL`, async () => {
    const h = harness(); const progress: number[] = [];
    const path = `${folder}/123_resident_photo.jpg`;
    const url = await h.upload({ uri: 'file:///cache/photo.jpg', size: 4_000_000, path, uid: 'resident',
      metadata: { contentType: 'image/jpeg', customMetadata: { uploadedBy: 'resident', folder } },
      progress: (value: number) => progress.push(value),
    });
    assert.equal(url, folder === 'work_orders' ? `gs://existing-bucket/${path}` : `https://example.invalid/${path}`);
    assert.equal(h.calls[0].options.headers.Authorization, 'Firebase test-user-token');
    assert.equal(JSON.parse(h.calls[0].options.body).metadata.folder, folder);
    assert.equal(JSON.parse(h.calls[0].options.body).name, path);
    assert.equal(h.calls[1].uri, 'file:///cache/photo.jpg');
    assert.equal(h.calls[1].options.headers.Authorization, 'Firebase test-user-token');
    assert.equal(h.calls[1].options.headers['X-Goog-Upload-Command'], 'upload, finalize');
    assert.deepEqual(progress, [0.5, 1]);
    assert.ok(h.cleaned());
  });
}
test('permission failure rejects, cleans up, and never returns an attachment', async () => {
  const h = harness(403);
  await assert.rejects(h.upload({ uri: 'file:///photo.jpg', size: 10, path: 'feed/photo.jpg', uid: 'resident', metadata: {}, progress: () => {} }), /denied/);
  assert.ok(h.cleaned());
});
test('session mismatch prevents any network request', async () => {
  const h = harness();
  await assert.rejects(h.upload({ uid: 'other' }), /session changed/);
  assert.equal(h.calls.length, 0);
});
test('a never-settling transfer rejects on deadline and cancels', async () => {
  let cancelled = false;
  await assert.rejects(deadline(new Promise(() => {}), 10, 'Photo upload', () => { cancelled = true; }), /try again/);
  assert.ok(cancelled);
});
test('deadline preserves successful result and original errors', async () => {
  assert.equal(await deadline(Promise.resolve('url'), 100, 'Upload'), 'url');
  await assert.rejects(deadline(Promise.reject(Error('offline')), 100, 'Upload'), /offline/);
});

test('sign-out during token acquisition rejects the transfer', async () => {
  const h = harness();
  const pending = h.upload({ uri: 'file:///photo.jpg', size: 10, path: 'feed/photo.jpg', uid: 'resident', metadata: {}, progress: () => {} });
  h.signOut();
  await assert.rejects(pending, /session changed/);
  assert.equal(h.calls.length, 0);
});

const pickerSource = ts.transpileModule(readFileSync(new URL('../src/components/media.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
for (const folder of ['work_orders', 'feed', 'marketplace']) {
  test(`${folder}: gallery content URI is copied, large photo resized, and URL attached`, async () => {
    const uploads: any[] = [], transformations: any[] = [], removed: string[] = [];
    const modules: Record<string, any> = {
      'react-native': { Platform: { OS: 'android' } },
      'expo-image-picker': {
        launchImageLibraryAsync: async () => ({ canceled: false, assets: [{ uri: 'content://gallery/photo', type: 'image', width: 4000, height: 3000, fileSize: 8_000_000, fileName: 'photo.heic', mimeType: 'image/heic' }] }),
      },
      'expo-image-manipulator': { SaveFormat: { JPEG: 'jpeg' }, manipulateAsync: async (_uri: string, transforms: any, options: any) => { transformations.push({ transforms, options }); return { uri: 'file:///cache/prepared.jpg' }; } },
      'expo-file-system/legacy': { cacheDirectory: 'file:///cache/', copyAsync: async () => {}, getInfoAsync: async () => ({ exists: true, size: 2_000_000 }), deleteAsync: async (uri: string) => { removed.push(uri); } },
      '../../../src/services/mediaAuthorization': { ensureMediaDraft: async () => {} },
      '../lib/firebase': { db: {}, auth: { currentUser: { uid: 'resident' } } },
      '../news/actions': { approvedUser: async () => ({ id: 'resident', name: 'Resident', email: 'test@example.invalid' }) },
      '../media/deadline': { deadline },
      '../media/uploadFile': { uploadFile: async (input: any) => { uploads.push(input); return 'https://example.invalid/persistent-photo'; } },
    };
    const exports: any = {};
    vm.runInNewContext(pickerSource, { exports, require: (key: string) => modules[key] });
    const result = await exports.pickAndUpload(folder, () => {}, false, { recordId: 'draft', collection: folder === 'feed' ? 'discussion_feed' : folder === 'marketplace' ? 'marketplace_posts' : 'work_orders' });
    assert.equal(uploads.length, 1);
    assert.ok(uploads[0].path.startsWith(`${folder}/`));
    assert.equal(uploads[0].metadata.contentType, 'image/jpeg');
    assert.equal(uploads[0].metadata.customMetadata.originalName, 'photo.heic');
    assert.equal(uploads[0].size, 2_000_000);
    assert.equal(transformations[0].transforms[0].resize.width, 2048);
    assert.equal(result[0].url, 'https://example.invalid/persistent-photo');
    assert.equal(result[0].type, 'image');
    assert.equal(removed.length, 2);
    assert.ok(removed.every(uri => uri.startsWith('file:///cache/')));
  });
}

test('completed transfer is reported before link resolution failure for duplicate-free retry', async () => {
 const h=harness(200,true);let transferred=false;
 await assert.rejects(h.upload({uri:'file:///photo.jpg',size:200,path:'marketplace/photo.jpg',uid:'resident',metadata:{},progress:()=>{},onTransferred:()=>{transferred=true;}}),/Link unavailable/);
 assert.equal(transferred,true);assert.ok(h.cleaned());
});
