import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { deadline } from '../src/media/deadline.ts';

function load(file: string, modules: Record<string, any>) {
  const exports: any = {};
  const source = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(source, { exports, Error, require: (key: string) => {
    assert.ok(key in modules, `Unexpected dependency ${key}`); return modules[key];
  } });
  return exports;
}
function editor(kind: 'post' | 'listing', pendingDraft = false, failUpload = false, failAfterTransfer = false) {
  let cursor = 0;
  const state: any[] = [], drafts: any[] = [], uploads: any[] = [];
  let pickerCalls = 0, linkReads = 0;
  const asset = { uri: 'file:///photo.jpg', type: 'image', width: 800, height: 600, fileSize: 200, fileName: 'photo.jpg', mimeType: 'image/jpeg' };
  const pick = load('../src/components/media.ts', {
    'react-native': { Platform: { OS: 'android' } },
    'expo-image-picker': { launchImageLibraryAsync: async () => { pickerCalls++; return { canceled: false, assets: [asset] }; } },
    'expo-image-manipulator': { SaveFormat: { JPEG: 'jpeg' }, manipulateAsync: async () => ({ uri: 'file:///prepared.jpg' }) },
    'expo-file-system/legacy': { getInfoAsync: async () => ({ exists: true, size: 200 }), deleteAsync: async () => {} },
    '../../../src/services/mediaAuthorization': { ensureMediaDraft: async (...args: any[]) => { drafts.push(args); if (pendingDraft) await new Promise(() => {}); } },
    '../lib/firebase': { db: {}, auth: { currentUser: { uid: 'resident' } } },
    '../news/actions': { approvedUser: async () => ({ id: 'resident', email: '', name: 'Resident' }) },
    '../media/deadline': { deadline: (p: Promise<any>, ms: number, label: string) => deadline(p, Math.min(ms, 10), label) },
    '../media/uploadFile': { uploadedFileURL: async () => { linkReads++; return 'https://example.invalid/photo'; }, uploadFile: async (input: any) => { uploads.push(input); if (failAfterTransfer) { input.onTransferred?.(); throw Error('Getting photo link took too long. Please try again.'); } if (failUpload) throw Error('Upload denied'); return 'https://example.invalid/photo'; } },
  });
  const jsx = (type: any, props: any) => ({ type, props });
  const { CreateEditor } = load('../src/social/CreateEditor.tsx', {
    'react/jsx-runtime': { jsx, jsxs: jsx },
    react: {
      useState: (initial: any) => { const i = cursor++; if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial; return [state[i], (value: any) => { state[i] = typeof value === 'function' ? value(state[i]) : value; }]; },
      useRef: (initial: any) => { const i = cursor++; return state[i] ||= { current: initial }; },
    },
    'react-native': { Image: 'Image', View: 'View', Pressable: 'Pressable' },
    'lucide-react-native': { Trash2: 'Trash2', MessageSquare: 'MessageSquare', Tag: 'Tag' },
    '../shell/TownLoopShell': { usePresentation: () => ({ dark: false }) },
    '../news/ui': { Action: 'Action', Copy: 'Copy', Field: 'Field', ErrorNotice: 'ErrorNotice', UploadTarget: 'UploadTarget', useNewsStyles: () => ({ row: {}, input: {} }) },
    '../components/ProductDialog': { ProductDialog: 'ProductDialog' },
    '../components/media': pick,
    './model': { formatPrice: (p: string) => p },
    './actions': { newSocialId: () => 'draft-id', publishSocial: async () => {} },
  });
  const render = () => { cursor = 0; return CreateEditor({ initialKind: kind, onClose() {}, onSaved() {} }); };
  function walk(type: string, node: any, predicate = (_props: any) => true): any {
    if (!node || typeof node !== 'object') return;
    if (node.type === type && predicate(node.props)) return node;
    for (const child of [node.props?.children].flat(Infinity)) { const found = walk(type, child, predicate); if (found) return found; }
  }
  return { render, find: (type: string) => walk(type, render()),
    field: (label: string) => walk('Field', render(), props => props.label === label),
    action: (label: string) => walk('Action', render(), props => props.label === label),
    ready: () => { pendingDraft = false; failUpload = false; },
    pickerCalls: () => pickerCalls, linkReads: () => linkReads, drafts, uploads };
}
for (const kind of ['post', 'listing'] as const) {
  test(`${kind}: attach photo with empty text, preserving fields and releasing busy state`, async () => {
    const h = editor(kind);
    h.find('UploadTarget').props.onUpload();
    await new Promise(resolve => setTimeout(resolve, 25));
    assert.equal(h.uploads.length, 1);
    assert.equal(h.uploads[0].metadata.customMetadata.collection, kind === 'post' ? 'discussion_feed' : 'marketplace_posts');
    assert.equal(h.render().props.busy, false);
    assert.equal(h.find('Field').props.value, '');
    assert.ok(h.find('Image'), 'Selected photo remains visible before entering text');
  });
  test(`${kind}: completed transfer retries only the photo link without uploading twice`, async () => {
    const h = editor(kind, false, false, true);
    h.find('UploadTarget').props.onUpload();
    await new Promise(resolve => setTimeout(resolve, 25));
    assert.equal(h.render().props.busy, false);
    assert.equal(h.uploads.length, 1);
    h.action('Retry selected media').props.onPress();
    await new Promise(resolve => setTimeout(resolve, 25));
    assert.equal(h.uploads.length, 1, 'A completed photo transfer must not be repeated');
    assert.equal(h.linkReads(), 1);
    assert.equal(h.find('Image').props.source.uri, 'https://example.invalid/photo');
  });
  test(`${kind}: upload failure retains entered text and selected photo for retry`, async () => {
    const h = editor(kind, false, true);
    h.find('Field').props.onChangeText('Keep my title');
    h.find('UploadTarget').props.onUpload();
    await new Promise(resolve => setTimeout(resolve, 25));
    assert.equal(h.render().props.busy, false);
    assert.equal(h.find('Field').props.value, 'Keep my title');
    assert.equal(h.find('Image').props.source.uri, 'file:///photo.jpg');
    assert.match(h.find('ErrorNotice').props.message, /denied/);
    h.ready();
    h.action('Retry selected media').props.onPress();
    await new Promise(resolve => setTimeout(resolve, 25));
    assert.equal(h.render().props.busy, false);
    assert.equal(h.pickerCalls(), 1);
    assert.equal(h.find('Image').props.source.uri, 'https://example.invalid/photo');
  });
  test(`${kind}: stalled draft creation releases photo-first form with a retryable error`, async () => {
    const h = editor(kind, true);
    h.find('UploadTarget').props.onUpload();
    assert.equal(h.find('Field').props.editable, true, 'Text stays editable while a photo is uploading');
    await new Promise(resolve => setTimeout(resolve, 30));
    assert.equal(h.render().props.busy, false, 'Draft wait must not lock every control indefinitely');
    assert.match(h.find('ErrorNotice')?.props.message || '', /try again/i);
    assert.equal(h.uploads.length, 0);
    assert.equal(h.find('Image').props.source.uri, 'file:///photo.jpg');
    h.ready();
    h.action('Retry selected media').props.onPress();
    await new Promise(resolve => setTimeout(resolve, 25));
    assert.equal(h.uploads.length, 1);
    assert.equal(h.pickerCalls(), 1, 'Retry must reuse the selected photo');
    assert.equal(h.render().props.busy, false);
    assert.equal(h.action('Retry selected media'), undefined);
  });
}

test('Discussion Feed keeps title, description and controls responsive during photo-first recovery', async () => {
 const h=editor('post',true);
 h.find('UploadTarget').props.onUpload();
 h.field('Subject / Title').props.onChangeText('Community update');
 h.field('Post Content & Discussion Details').props.onChangeText('Keep these details');
 assert.equal(h.field('Subject / Title').props.editable,true);
 assert.equal(h.field('Post Content & Discussion Details').props.editable,true);
 await new Promise(resolve=>setTimeout(resolve,30));
 assert.equal(h.render().props.busy,false);
 assert.equal(h.field('Subject / Title').props.value,'Community update');
 assert.equal(h.field('Post Content & Discussion Details').props.value,'Keep these details');
 h.ready();h.action('Retry selected media').props.onPress();
 await new Promise(resolve=>setTimeout(resolve,25));
 assert.equal(h.render().props.busy,false);assert.equal(h.uploads.length,1);
 assert.equal(h.find('Image').props.source.uri,'https://example.invalid/photo');
});
