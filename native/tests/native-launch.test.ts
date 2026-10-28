import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const read = (name: string) => readFileSync(new URL(name, import.meta.url), 'utf8');
function evaluate(source: string, modules: Record<string, unknown>) {
 const context: any = {exports: {}, require: (name: string) => modules[name] || {},
  setTimeout() { throw Error('Native launch must not schedule a delay'); }};
 vm.runInNewContext(ts.transpileModule(source, {compilerOptions: {
  jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
 }}).outputText, context);
 return context.exports;
}
function harness(hideFails = false) {
 const calls: string[] = [];
 const splash = evaluate(read('../src/lib/nativeSplash.ts'), {'expo-splash-screen': {
  preventAutoHideAsync: async () => { calls.push('hold'); },
  hideAsync: async () => { calls.push('hide'); if(hideFails) throw Error('Unavailable splash'); },
 }});
 const state: any = {user: null, profile: null, loading: false, registrationInProgress: false};
 const community = {community: 'cecil_pines', ready: true};
 const jsx = (type: any, props: any) => ({type, props});
 const stack = Object.assign(() => {}, {Protected: 'Protected', Screen: 'Screen'});
 let fontError = false;
 const common: Record<string, any> = {
  'react/jsx-runtime': {jsx, jsxs: jsx},
  'react-native': {View: 'View', Text: 'Text', Pressable: 'Pressable'},
  '../lib/nativeSplash': splash,
 };
 const layout = evaluate(read('../src/app/_layout.tsx') + '\nexports.Navigation = Navigation;', {
  ...common,
  '../home/hooks': {useReducedMotion: () => false},
  '../lib/session': {useSession: () => state},
  '../lib/community': {useCommunity: () => community},
  '../components/ui': {colors: {cream: '#f3ebdc', ink: '#123'}},
  'expo-router': {Stack: stack},
  'expo-font': {useFonts: () => [!fontError, fontError ? Error('Font unavailable') : null]},
 });
 const boundary = evaluate(read('../src/monitoring/AppErrorBoundary.tsx'), {
  ...common,
  react: {Component: class {props: any; constructor(props: any){this.props=props;}}},
  './diagnostics': {recordDiagnostic() {}},
 }).AppErrorBoundary;
 return {calls, state, community, splash, boundary, root: layout.default,
  fontFailure: () => {fontError=true;}, render: (fontsReady = true) => {const result=layout.Navigation({fontsReady});return result.props.ready?result.props.children:null;}};
}
function routes(tree: any): string[] {
 if(!tree)return [];
 if(Array.isArray(tree))return Array.from(tree).flatMap(routes);
 if(tree.type==='Protected'&&!tree.props.guard)return [];
 if(tree.type==='Screen')return [tree.props.name];
 return routes(tree.props?.children);
}
function find(tree: any, name: string): any {
 if(!tree)return undefined;
 if(Array.isArray(tree))return tree.map(x=>find(x,name)).find(Boolean);
 if(tree.type?.name===name)return tree;
 return find(tree.props?.children,name);
}
test('obsolete startup implementations stay removed; only the approved new implementation is imported', () => {
 for(const p of ['../src/components/StartupLoading.tsx','../assets/startup']) {
  assert.equal(existsSync(new URL(p,import.meta.url)),false,p);
 }
 const source=read('../src/app/_layout.tsx');
 assert.equal(/StartupLoading|LaunchVideo|expo-video|withTiming|setTimeout|setInterval/.test(source),false);
});
test('only essential initialization gates native launch; ready users go straight to their authorized screen', () => {
 const h=harness(); assert.equal(h.calls.join(','),'hold');
 h.state.loading=true; assert.equal(h.render(),null);
 h.state.loading=false; h.community.ready=false; assert.equal(h.render(),null);
 h.community.ready=true; assert.equal(h.render(false),null);
 const signedOut=h.render(); assert.deepEqual(routes(signedOut),['sign-in']);
 assert.equal(signedOut.props.onLayout,undefined,'Underlying navigation must not dismiss the splash before the startup frame');
 h.state.user={uid:'fixture'}; h.state.profile={approved:true};
 assert.deepEqual(routes(h.render()),['(tabs)']);
 h.state.profile.approved=false; assert.deepEqual(routes(h.render()),['pending']);
 h.state.profile=null; h.state.error='Profile unavailable';
 assert.deepEqual(routes(h.render()),['pending'],'Existing account-status UI handles initialization errors securely');
 h.state.registrationInProgress=true; assert.deepEqual(routes(h.render()),['sign-in']);
 assert.equal(h.calls.join(','),'hold');
});
test('font failure, splash failure and error-boundary recovery do not create a startup lock', async () => {
 const h=harness(true); h.fontFailure();
 assert.equal(find(h.root(),'Navigation').props.fontsReady,true);
 const b=new h.boundary({children:'app'}); b.state={failed:true};
 assert.doesNotThrow(()=>b.render().props.onLayout());
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(h.calls.join(','),'hold,hide');
 assert.deepEqual(routes(h.render()),['sign-in']);
});
test('navigation rerenders retain route gates and the ordinary media dependency', () => {
 const h=harness();
 for(let i=0;i<5;i++)assert.deepEqual(routes(h.render()),['sign-in']);
 assert.equal(h.calls.join(','),'hold');
 const p=JSON.parse(read('../package.json'));
 assert.ok(p.dependencies['expo-video'],'Non-startup media playback still needs expo-video');
 assert.equal(p.expo?.autolinking?.android?.buildFromSource?.includes('expo-video'),true);
 const splash=JSON.parse(read('../app.json')).expo.plugins.find((x:any)=>Array.isArray(x)&&x[0]==='expo-splash-screen')[1];
 assert.equal(splash.image,'./assets/native-splash.png');
 const pixel=readFileSync(new URL('../assets/native-splash.png',import.meta.url));
 assert.equal(pixel.readUInt32BE(16),1); assert.equal(pixel.readUInt32BE(20),1);
 assert.ok(read('../src/components/MediaViewer.tsx').includes('useVideoPlayer'));
});
