import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { deadline } from '../src/media/deadline.ts';

// Execute the real editor callbacks and media orchestration; only native/network
// boundaries are fixtures. This cannot reproduce an Android ANR/decoder/modal crash.
function load(file: string, modules: Record<string, any>) {
 const exports: any = {};
 const source = readFileSync(new URL(file, import.meta.url), 'utf8');
 const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
 vm.runInNewContext(code, { exports, Error, require: (name: string) => modules[name] });
 return exports;
}
function nodes(tree: any): any[] {
 if (!tree) return [];
 if (Array.isArray(tree)) return tree.flatMap(nodes);
 return [tree, ...nodes(tree.props?.children)];
}
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture() {
 let cursor = 0, closes = 0, saves = 0, uploads = 0, pickerCalls = 0;
 const slots: any[] = [], drafts: any[] = [], publications: any[] = [];
 const asset = { uri: 'content://fixture/photo', type: 'image', width: 4000, height: 3000, fileSize: 8000000, fileName: 'fixture.jpg' };
 let finishProcessing: (image: any) => void = () => {};
 let failProcessing: (error: Error) => void = () => {};
 const pickerResult: any = { canceled: false, assets: [asset] };
 let processing: Promise<any> = new Promise((resolve, reject) => { finishProcessing = resolve; failProcessing = reject; });
 const media = load('../src/components/media.ts', {
  'react-native': { Platform: { OS: 'android' } },
  'expo-image-picker': { launchImageLibraryAsync: async () => { pickerCalls++; return pickerResult; } },
  'expo-image-manipulator': { SaveFormat: { JPEG: 'jpeg' }, manipulateAsync: () => processing },
  'expo-file-system/legacy': { cacheDirectory: 'file:///cache/', copyAsync: async () => {}, getInfoAsync: async () => ({ exists: true, size: 100000 }), deleteAsync: async () => {} },
  '../../../src/services/mediaAuthorization': { ensureMediaDraft: async (_db: any, link: any, uid: string) => { drafts.push({ link, uid }); } },
  '../lib/firebase': { db: {}, auth: { currentUser: { uid: 'fixture-resident' } } },
  '../news/actions': { approvedUser: async () => ({ id: 'fixture-resident', name: 'Fixture', email: 'fixture@example.invalid' }) },
  '../media/deadline': { deadline },
  '../media/uploadFile': { uploadFile: async () => { uploads++; return 'https://example.invalid/uploaded.jpg'; } },
 });
 const jsx = (type: any, props: any) => ({ type, props });
 const { CreateEditor } = load('../src/social/CreateEditor.tsx', {
  react: {
   useState(initial: any) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
    return [slots[index], (value: any) => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }]; },
   useRef(initial: any) { const index = cursor++; if (!(index in slots)) slots[index] = { current: initial }; return slots[index]; },
  },
  'react/jsx-runtime': { jsx, jsxs: jsx },
  'react-native': { Image: 'Image', View: 'View', Pressable: 'Pressable' },
  'lucide-react-native': { Trash2: 'Trash2', MessageSquare: 'MessageSquare', Tag: 'Tag' },
  '../shell/TownLoopShell': { usePresentation: () => ({ dark: false }) },
  '../news/ui': { Action: 'Action', Copy: 'Copy', Field: 'Field', ErrorNotice: 'ErrorNotice', UploadTarget: 'UploadTarget', useNewsStyles: () => ({ row: {}, input: {} }) },
  '../components/ProductDialog': { ProductDialog: 'ProductDialog' },
  '../components/media': media,
  './model': { formatPrice: (value: string) => value },
  './actions': { newSocialId: () => 'fixture-draft', publishSocial: async (_id: string, _kind: string, draft: any) => {
   if (!draft.title.trim() || !draft.description.trim()) throw Error('Please provide a title and description.');
   publications.push(draft);
  } },
 });
 function render() { cursor = 0; return CreateEditor({ initialKind: 'post', onClose: () => { closes++; }, onSaved: () => { saves++; } }); }
 const field = (label: string) => nodes(render()).find(node => node.type === 'Field' && node.props.label === label);
 return { render, field, asset, drafts, publications, pickerResult,
  confirm: () => nodes(render()).find(node => node.type === 'UploadTarget').props.onUpload(),
  recover: () => { processing = Promise.resolve({ uri: 'file:///cache/recovered.jpg' }); },
  finish: () => finishProcessing({ uri: 'file:///cache/processed.jpg' }), fail: () => failProcessing(Error('Fixture processing failure')),
  stats: () => ({ closes, saves, uploads, pickerCalls }),
 };
}
for (const filled of [false, true]) {
 test(`actual Discussion editor: picker confirmation with ${filled ? 'filled' : 'empty'} fields retains preview and editing before upload`, async () => {
  const h = fixture();
  if (filled) { h.field('Subject / Title').props.onChangeText('Fixture title'); h.field('Post Content & Discussion Details').props.onChangeText('Fixture description'); }
  h.confirm(); await tick();
  const pending = h.render();
  assert.equal(h.stats().uploads, 0, 'transfer has not started while native image processing is pending');
  assert.equal(h.stats().closes, 0); assert.equal(h.publications.length, 0);
  assert.equal(nodes(pending).find(node => node.type === 'Image')?.props.source.uri, h.asset.uri);
  assert.equal(h.field('Subject / Title').props.value, filled ? 'Fixture title' : '');
  assert.equal(h.field('Subject / Title').props.editable, true);
  assert.equal(h.field('Post Content & Discussion Details').props.editable, true);
  h.field('Subject / Title').props.onChangeText('Edited after choosing');
  h.field('Post Content & Discussion Details').props.onChangeText('Body after choosing');
  await tick(); assert.equal(h.field('Subject / Title').props.value, 'Edited after choosing');
  assert.equal(nodes(h.render()).find(n=>n.type==='Action' && n.props.label==='Retry selected media'),undefined, 'a successfully staged selection is not a failed upload');
  assert.equal(h.drafts.length, 0, 'choosing a feed photo must not wait on a draft write');
  assert.equal(h.render().props.busy, false, 'picker return must release sheet controls before processing');
  nodes(h.render()).find(node => node.type === 'Action' && node.props.label === 'Publish Post to Discussion Feed').props.onPress();
  await tick();
  assert.equal(h.drafts.length, 1); assert.equal(h.drafts[0].link.collection, 'discussion_feed');
  h.finish(); await tick();
  const done = h.render(); assert.equal(done.props.busy, false);
  assert.equal(nodes(done).find(node => node.type === 'Image')?.props.source.uri, 'https://example.invalid/uploaded.jpg');
  assert.equal(h.publications.length, 1, 'explicit Publish uploads the staged photo and publishes once');
  assert.equal(h.stats().closes, 1); assert.equal(h.stats().saves, 1); assert.equal(h.stats().uploads, 1);
 });
}
test('processing error releases loading and keeps selected photo/text for recovery', async () => {
 const h = fixture(); h.field('Subject / Title').props.onChangeText('Retain title'); h.field('Post Content & Discussion Details').props.onChangeText('Retain body'); h.confirm(); await tick();
 nodes(h.render()).find(node => node.type === 'Action' && node.props.label === 'Publish Post to Discussion Feed').props.onPress(); await tick(); h.fail(); await tick();
 const tree = h.render(); assert.equal(tree.props.busy, false);
 assert.equal(h.field('Subject / Title').props.value, 'Retain title');
 assert.equal(nodes(tree).find(node => node.type === 'Image')?.props.source.uri, h.asset.uri);
 assert.match(nodes(tree).find(node => node.type === 'ErrorNotice')?.props.message, /processing failure/);
 assert.equal(h.stats().uploads, 0); assert.equal(h.stats().closes, 0);
 h.recover();
 nodes(h.render()).find(node => node.type === 'Action' && node.props.label === 'Retry selected media').props.onPress(); await tick();
 assert.equal(h.render().props.busy, false); assert.equal(h.stats().pickerCalls, 1);
 assert.equal(h.stats().uploads, 1); assert.equal(h.publications.length, 0);
 nodes(h.render()).find(node => node.type === 'Action' && node.props.label === 'Publish Post to Discussion Feed').props.onPress(); await tick();
 assert.equal(h.publications.length, 1); assert.equal(h.stats().uploads, 1, 'recovered media is not uploaded twice');
});
test('cancellation releases form and text validation runs only on explicit Publish', async () => {
 const h = fixture(); h.pickerResult.canceled = true; h.pickerResult.assets = null;
 h.confirm(); await tick();
 let tree = h.render(); assert.equal(tree.props.busy, false); assert.equal(h.drafts.length, 0);
 assert.equal(nodes(tree).find(node => node.type === 'ErrorNotice'), undefined);
 nodes(tree).find(node => node.type === 'Action' && node.props.label === 'Publish Post to Discussion Feed').props.onPress(); await tick();
 tree = h.render(); assert.equal(tree.props.busy, false);
 assert.match(nodes(tree).find(node => node.type === 'ErrorNotice')?.props.message, /title and description/);
 assert.equal(h.stats().closes, 0); assert.equal(h.publications.length, 0);
});

test('cancel then retry selects locally; missing text validation starts no draft or transfer', async () => {
 const h=fixture(); h.pickerResult.canceled=true; h.pickerResult.assets=null;
 h.confirm(); await tick(); assert.equal(h.render().props.busy,false);
 h.pickerResult.canceled=false; h.pickerResult.assets=[h.asset];
 h.confirm(); await tick();
 assert.equal(h.stats().pickerCalls,2); assert.equal(h.stats().uploads,0); assert.equal(h.drafts.length,0);
 assert.equal(nodes(h.render()).find(n=>n.type==='Image')?.props.source.uri,h.asset.uri);
 nodes(h.render()).find(n=>n.type==='Action' && n.props.label==='Publish Post to Discussion Feed').props.onPress(); await tick();
 assert.equal(h.render().props.busy,false); assert.equal(h.drafts.length,0); assert.equal(h.stats().uploads,0);
 assert.match(nodes(h.render()).find(n=>n.type==='ErrorNotice')?.props.message,/title and description/);
});
