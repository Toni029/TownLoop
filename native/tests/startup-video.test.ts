import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function harness() {
 let released = false;
 const timers:Array<{fn:()=>void;ms:number;cleared?:boolean}>=[];
 const calls:string[]=[], effects:Array<()=>any>=[], stateListeners:Array<(state:string)=>void>=[];
 const player:any=new Proxy({currentTime:0,duration:3.22,play(){calls.push('play');},pause(){if(released) throw Error('SharedObject already released');calls.push('pause');},replaceAsync:async()=>{calls.push('load');},addListener(){return{remove(){}};}},{set:(target:any,key:string,value:any)=>{calls.push(`${key}:${value}`);target[key]=value;return true;}});
 const jsx=(type:any,props:any)=>({type,props});let reduced=false;
 const modules:Record<string,any>={
  react:{Component:class{props:any;constructor(props:any){this.props=props;}},useEffect:(fn:any)=>effects.push(fn),useState:(value:any)=>[typeof value==='function'?value():value,()=>{}],useRef:(value:any)=>({current:value}),useCallback:(fn:any)=>fn},
  'react/jsx-runtime':{jsx,jsxs:jsx},
  'react-native':{Platform:{OS:'android'},AppState:{currentState:'active',addEventListener:(_event:any,fn:any)=>{stateListeners.push(fn);return{remove(){}};}},Image:'Image',View:'View',StyleSheet:{absoluteFill:{position:'absolute'},create:(x:any)=>x},useWindowDimensions:()=>({width:412,height:892,scale:3})},
  'expo-splash-screen':{preventAutoHideAsync:async()=>{},hideAsync:async()=>{calls.push('hideSplash');},setOptions(){}},
  'expo-video':{VideoView:'VideoView',useVideoPlayer:(source:any,setup:any,options:any)=>{effects.push(() => () => { released = true; });calls.push(`disableAudioSession:${options?.disableAudioSession}`);calls.push(source===null?'empty-player':'source-in-constructor');setup(player);return player;}},
  'expo-linear-gradient':{LinearGradient:'LinearGradient'},
  'react-native-reanimated':{default:{View:'AnimatedView'},FadeOut:{duration:()=>({})}},
  '../home/hooks':{useReducedMotion:()=>reduced},
 };
 const e:any={};
 const text=readFileSync(new URL('../src/components/StartupLoading.tsx',import.meta.url),'utf8')+'\nexportsForTest = {LaunchVideo, StartupLoading, StartupAnimationBoundary};';
 const code=ts.transpileModule(text,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const context:any={exports:e,exportsForTest:undefined,Error,require:(name:string)=>name.includes('/assets/startup/')?1:modules[name],setTimeout:(fn:()=>void,ms:number)=>{timers.push({fn,ms});return timers.length-1;},clearTimeout:(id:number)=>{if(timers[id])timers[id].cleared=true;}};
 vm.runInNewContext(code,context);
 return {...context.exportsForTest,calls,player,stateListeners,timers,reduced:(value:boolean)=>{reduced=value;},effects:()=>effects.splice(0).map(fn=>fn())};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('startup configures non-interrupting playback before asynchronously loading the MP4',async()=>{
 const h=harness();h.LaunchVideo({onComplete(){}});h.effects();await settle();
 assert.ok(h.calls.includes('empty-player'));
 assert.ok(h.calls.includes('disableAudioSession:true'));
 for(const setting of ['muted:true','volume:0','audioMixingMode:mixWithOthers','showNowPlayingNotification:false','staysActiveInBackground:false'])assert.ok(h.calls.indexOf(setting)>=0&&h.calls.indexOf(setting)<h.calls.indexOf('load'),setting);
 assert.ok(h.calls.indexOf('load')<h.calls.indexOf('play'));
});
test('backgrounding stops startup playback and foregrounding does not replay it',async()=>{
 const h=harness();h.LaunchVideo({onComplete(){}});h.effects();await settle();
 h.stateListeners.forEach((fn:any)=>fn('background'));
 h.stateListeners.forEach((fn:any)=>fn('active'));
 assert.equal(h.calls.filter((x:string)=>x==='play').length,1);
 assert.ok(h.calls.includes('pause'));
});
test('reduced motion uses a poster and completed launch does not replay on remount',()=>{
 const h=harness();h.reduced(true);
 const initial=h.StartupLoading({ready:false,children:'app'});
 assert.equal(JSON.stringify(initial).includes('VideoView'),false);
 h.reduced(false);
 const ready=h.StartupLoading({ready:true,children:'app'});
 ready.props.children[0].props.onLayout();
 const again=h.StartupLoading({ready:true,children:'app'});
 assert.equal(again.props.children[1],false);
 assert.equal(h.calls.includes('play'),false);
});

test('real startup effect teardown survives Expo releasing the shared player first',async()=>{
 const h=harness();h.LaunchVideo({onComplete(){}});const cleanup=h.effects();await settle();
 assert.doesNotThrow(()=>{for(const fn of cleanup)if(typeof fn==='function')fn();});
});

test('stalled native prepare reaches bounded fallback without waiting for the promise',async()=>{
 const h=harness();let completed=0;
 h.player.replaceAsync=()=>new Promise(()=>{});
 h.LaunchVideo({onComplete(){completed++;}});const cleanup=h.effects();await settle();
 assert.equal(completed,0);h.timers.find((t:any)=>t.ms===4500)!.fn();
 assert.equal(completed,1);assert.equal(h.calls.includes('play'),false);
 for(const fn of cleanup)if(typeof fn==='function')fn();
});
test('native pause errors still finish startup and animation render errors stay local',async()=>{
 const h=harness();let completed=0;
 h.LaunchVideo({onComplete(){completed++;}});h.effects();await settle();
 h.player.pause=()=>{throw Error('Native player unavailable');};
 assert.doesNotThrow(()=>h.stateListeners.forEach((fn:any)=>fn('background')));
 assert.equal(completed,1);
 const boundary=new h.StartupAnimationBoundary({children:'video',onFailure(){completed++;}});
 boundary.state=h.StartupAnimationBoundary.getDerivedStateFromError();
 boundary.componentDidCatch();assert.equal(boundary.render(),null);assert.equal(completed,2);
});
test('ready navigation removes startup without needing layout, and a fresh process can launch again',()=>{
 const h=harness();h.StartupLoading({ready:true,children:'Home or login'});h.effects();
 const tree=h.StartupLoading({ready:true,children:'Home or login'});
 assert.equal(tree.props.children[1],false);
 const cold=harness();const initial=cold.StartupLoading({ready:false,children:'app'});
 assert.ok(initial.props.children[1]);
});
