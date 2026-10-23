import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import vm from 'node:vm';
import ts from 'typescript';

// Runs the actual components with deterministic hook state and native lifecycle fixtures.
// Does not claim to exercise an Android decoder or physical-device rendering.
function harness() {
 let released = false, reduced = false, owner = '', cursor = 0;
 const slots = new Map<string, any[]>();
 const effects: Array<() => any> = [], calls: string[] = [];
 const timers: Array<{ fn: () => void; ms: number; cleared?: boolean }> = [];
 const stateListeners: Array<(value: string) => void> = [];
 const videoListeners: Record<string, (event?: any) => void> = {};
 const appState: any = { currentState: 'active', addEventListener: (_: any, fn: any) => {
  stateListeners.push(fn); return { remove() {} };
 }};
 const player: any = new Proxy({
  play() { calls.push('play'); },
  attachToNativeView() { if (released) throw Error('Cannot use shared object that was already released'); },
  pause() { if (released) throw Error('SharedObject already released'); calls.push('pause'); },
  replaceAsync: async (source: any) => { calls.push(source === null ? 'unload' : 'load'); },
  addListener(name: string, fn: any) { videoListeners[name] = fn; return { remove() {} }; },
 }, { set(target: any, key: string, value) { calls.push(`${key}:${value}`); target[key] = value; return true; } });
 const nextSlot = () => { const list = slots.get(owner)!; const index = cursor++; return { list, index }; };
 const changed = (old: any, deps: any[]) => !old || deps.some((value, i) => value !== old.deps[i]);
 const hooks = {
  Component: class { props: any; constructor(props: any) { this.props = props; } },
  useState(initial: any) {
   const { list, index } = nextSlot();
   if (!list[index]) list[index] = { value: typeof initial === 'function' ? initial() : initial };
   return [list[index].value, (value: any) => { list[index].value = typeof value === 'function' ? value(list[index].value) : value; }];
  },
  useRef(initial: any) {
   const { list, index } = nextSlot();
   if (!list[index]) list[index] = { current: initial };
   return list[index];
  },
  useCallback(fn: any, deps: any[]) {
   const { list, index } = nextSlot();
   if (changed(list[index], deps)) list[index] = { deps, fn };
   return list[index].fn;
  },
  useEffect(fn: any, deps: any[] = []) {
   const { list, index } = nextSlot();
   if (!changed(list[index], deps)) return;
   const previous = list[index]; const slot = { deps, cleanup: undefined as any }; list[index] = slot;
   effects.push(() => { previous?.cleanup?.(); slot.cleanup = fn(); return slot.cleanup; });
  },
 };
 const jsx = (type: any, props: any) => ({ type, props });
 const modules: Record<string, any> = {
  react: hooks, 'react/jsx-runtime': { jsx, jsxs: jsx },
  'react-native': {
   AccessibilityInfo: { isReduceMotionEnabled: () => Promise.resolve(reduced), addEventListener: () => ({ remove() {} }) },
   Platform: { OS: 'android' }, AppState: appState, View: 'View',
   StyleSheet: { absoluteFill: { position: 'absolute' }, create: (x: any) => x },
   useWindowDimensions: () => ({ width: 412, height: 892, scale: 3 }),
  },
  'expo-splash-screen': { preventAutoHideAsync: async () => {}, hideAsync: async () => { calls.push('hideSplash'); }, setOptions() {} },
  'expo-video': { VideoView: 'VideoView', createVideoPlayer(source: any, options: any) {
   calls.push(`disableAudioSession:${options?.disableAudioSession}`);
   calls.push(source === null ? 'empty-player' : 'source-in-constructor');
   return player;
  }, useVideoPlayer(source: any, setup: any, options: any) {
   const [instance] = hooks.useState(() => {
    calls.push(`disableAudioSession:${options?.disableAudioSession}`);
    calls.push(source === null ? 'empty-player' : 'source-in-constructor'); setup(player); return player;
   });
   // Expo's release hook precedes the component's effect cleanup.
   hooks.useEffect(() => () => { released = true; }, []); return instance;
  } },
  'react-native-reanimated': { __esModule: true, default: { View: 'AnimatedView' }, FadeOut: { duration: () => ({}) } },
 };
 const source = readFileSync(new URL('../src/components/StartupLoading.tsx', import.meta.url), 'utf8') +
  '\nexportsForTest = {LaunchVideo, StartupLoading, StartupAnimationBoundary};';
 const code = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
 const context: any = { exports: {}, exportsForTest: undefined,
  require: (name: string) => name.includes('/assets/startup/') ? name : modules[name],
  setTimeout: (fn: () => void, ms: number) => { timers.push({ fn, ms }); return timers.length - 1; },
  clearTimeout: (id: number) => { if (timers[id]) timers[id].cleared = true; },
 };
 vm.runInNewContext(code, context);
 function render(name: string, props: any) {
  owner = name; cursor = 0; if (!slots.has(name)) slots.set(name, []);
  return context.exportsForTest[name](props);
 }
 function unmount(name: string) { for (const slot of slots.get(name) || []) slot.cleanup?.(); slots.delete(name); }
 return {
  calls, player, timers, videoListeners, modules, unmount,
  StartupAnimationBoundary: context.exportsForTest.StartupAnimationBoundary,
  reduced: (value: boolean) => { reduced = value; },
  background: () => { appState.currentState = 'background'; stateListeners.forEach(fn => fn('background')); },
  foreground: () => { appState.currentState = 'active'; stateListeners.forEach(fn => fn('active')); },
  StartupLoading: (props: any) => render('StartupLoading', props),
  LaunchVideo: (props: any) => render('LaunchVideo', props),
  effects: () => effects.splice(0).map(fn => fn()),
 };
}
const settle = () => new Promise(resolve => setImmediate(resolve));
function find(tree: any, name: string): any {
 if (!tree) return undefined;
 if (Array.isArray(tree)) return tree.map(node => find(node, name)).find(Boolean);
 if (tree.type === name || tree.type?.name === name) return tree;
 return find(tree.props?.children, name);
}
async function root(h: ReturnType<typeof harness>, ready: boolean) {
 let tree: any;
 for (let i = 0; i < 4; i++) { tree = h.StartupLoading({ ready, children: 'Home/login' }); h.effects(); await settle(); }
 return tree;
}

test('fast readiness does not skip MP4; end opens app and remount never replays', async () => {
 const h = harness(); let tree = await root(h, true);
 const video = find(tree, 'LaunchVideo'); assert.ok(video);
 h.LaunchVideo(video.props); h.effects(); await settle();
 assert.equal(h.calls.filter(x => x === 'play').length, 1);
 tree = await root(h, true); assert.ok(find(tree, 'LaunchVideo'));
 h.videoListeners.playToEnd(); tree = await root(h, true);
 assert.equal(find(tree, 'AnimatedView'), undefined);
 h.unmount('LaunchVideo'); h.unmount('StartupLoading');
 assert.equal(find(await root(h, true), 'LaunchVideo'), undefined);
 // A separate process/module (force-close/relaunch) gets exactly one fresh animation.
 assert.ok(find(await root(harness(), true), 'LaunchVideo'));
});
test('late initialization preserves authentication gate and uses neutral fallback after video ends', async () => {
 const h = harness(); const video = find(await root(h, false), 'LaunchVideo');
 h.LaunchVideo(video.props); h.effects(); await settle(); h.videoListeners.playToEnd();
 const waiting = await root(h, false); assert.ok(find(waiting, 'AnimatedView'));
 assert.equal(find(waiting, 'LaunchVideo'), undefined); assert.equal(find(waiting, 'Image'), undefined);
 h.unmount('LaunchVideo');
 assert.equal(find(h.StartupLoading({ ready: true, children: 'app' }), 'LaunchVideo'), undefined, 'late readiness must not remount a finished player');
 assert.equal(find(await root(h, true), 'AnimatedView'), undefined);
});
test('unknown motion preference waits; reduced motion skips all branded playback', async () => {
 const h = harness(); h.reduced(true);
 assert.equal(find(h.StartupLoading({ ready: true, children: 'app' }), 'LaunchVideo'), undefined);
 h.effects(); await settle();
 const waiting = await root(h, false);
 assert.equal(find(waiting, 'LaunchVideo'), undefined); assert.equal(find(waiting, 'Image'), undefined);
 h.unmount('LaunchVideo');
 assert.equal(find(h.StartupLoading({ ready: true, children: 'app' }), 'LaunchVideo'), undefined, 'late readiness must not remount a finished player');
 assert.equal(find(await root(h, true), 'AnimatedView'), undefined);
 assert.equal(h.calls.includes('load'), false);
});
test('unresolved motion lookup is bounded and proceeds neutrally', async () => {
 const h = harness(); h.modules['react-native'].AccessibilityInfo.isReduceMotionEnabled = () => new Promise(() => {});
 await root(h, true); h.timers.find(t => t.ms === 1000 && !t.cleared)!.fn();
 assert.equal(find(await root(h, true), 'AnimatedView'), undefined);
});
test('audio/session setup precedes original MP4 load and pre-frame surface stays hidden', async () => {
 const h = harness(); const props = { onComplete() {} }; const tree = h.LaunchVideo(props); h.effects(); await settle();
 for (const setting of ['disableAudioSession:true', 'empty-player', 'muted:true', 'volume:0', 'audioMixingMode:mixWithOthers', 'showNowPlayingNotification:false', 'staysActiveInBackground:false', 'loop:false']) {
  assert.ok(h.calls.indexOf(setting) >= 0 && h.calls.indexOf(setting) < h.calls.indexOf('load'), setting);
 }
 const view = find(tree, 'VideoView'); assert.equal(view.props.contentFit, 'contain');
 assert.equal(view.props.style[1].opacity, 0); view.props.onFirstFrameRender();
 assert.equal(find(h.LaunchVideo(props), 'VideoView').props.style[1].opacity, 1);
 assert.equal(find(tree, 'Image'), undefined);
});
test('background stops playback; resume and remount never replay', async () => {
 const h = harness(); const video = find(await root(h, true), 'LaunchVideo');
 h.LaunchVideo(video.props); h.effects(); await settle(); h.background(); h.foreground();
 assert.equal(find(await root(h, true), 'LaunchVideo'), undefined);
 assert.equal(h.calls.filter(x => x === 'play').length, 1);
});
test('stalled prepare and decoder error both unblock ready navigation', async () => {
 for (const failure of ['stalled', 'decoder']) {
  const h = harness(); const video = find(await root(h, true), 'LaunchVideo');
  if (failure === 'stalled') h.player.replaceAsync = () => new Promise(() => {});
  h.LaunchVideo(video.props); h.effects(); await settle();
  if (failure === 'stalled') h.timers.find(t => t.ms === 4500 && !t.cleared)!.fn();
  else h.videoListeners.statusChange({ status: 'error' });
  assert.equal(find(await root(h, true), 'AnimatedView'), undefined);
 }
});
test('startup teardown and pause/render errors finish locally', async () => {
 const h = harness(); let completed = 0;
 h.LaunchVideo({ onComplete() { completed++; } }); h.effects(); await settle();
 h.player.pause = () => { throw Error('Native player unavailable'); }; h.background(); assert.equal(completed, 1);
 assert.doesNotThrow(() => h.unmount('LaunchVideo'));
 const boundary = new h.StartupAnimationBoundary({ children: 'video', onFailure() { completed++; } });
 boundary.state = h.StartupAnimationBoundary.getDerivedStateFromError(); boundary.componentDidCatch();
 assert.equal(boundary.render(), null); assert.equal(completed, 2);
});
test('unexpected root remount during playback cannot launch another player', async () => {
 const h = harness(); assert.ok(find(await root(h, true), 'LaunchVideo'));
 h.unmount('StartupLoading');
 assert.equal(find(await root(h, true), 'LaunchVideo'), undefined);
});
test('bundled MP4 is byte-identical to approved original and native splash is unbranded cream', () => {
 const mp4 = readFileSync(new URL('../assets/startup/startup.mp4', import.meta.url));
 assert.equal(createHash('sha256').update(mp4).digest('hex'), '0deed2ecabd1be98c4d02e9edd34d5a53d300b04d312dc332f8b9727fd7a3934');
 const png = readFileSync(new URL('../assets/startup/native-splash.png', import.meta.url));
 assert.equal(png.readUInt32BE(16), 1); assert.equal(png.readUInt32BE(20), 1);
 assert.deepEqual([...inflateSync(png.subarray(41, 41 + png.readUInt32BE(33)))], [0, 243, 235, 220]);
});

test('queued Fabric view attachment still receives a live startup player after React unmount', async () => {
 const h = harness(); h.LaunchVideo({ onComplete() {} }); h.effects(); await settle();
 h.unmount('LaunchVideo');
 assert.doesNotThrow(() => h.player.attachToNativeView());
 assert.ok(h.calls.includes('unload'), 'decoder source must be unloaded without invalidating the object');
});
