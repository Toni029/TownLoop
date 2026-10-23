import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function harness() {
 const calls:string[]=[], effects:Array<()=>any>=[], stateListeners:Array<(state:string)=>void>=[];
 const player:any=new Proxy({currentTime:0,duration:3.22,play(){calls.push('play');},pause(){calls.push('pause');},replaceAsync:async()=>{calls.push('load');},addListener(){return{remove(){}};}},{set:(target:any,key:string,value:any)=>{calls.push(`${key}:${value}`);target[key]=value;return true;}});
 const jsx=(type:any,props:any)=>({type,props});let reduced=false;
 const modules:Record<string,any>={
  react:{useEffect:(fn:any)=>effects.push(fn),useState:(value:any)=>[typeof value==='function'?value():value,()=>{}],useRef:(value:any)=>({current:value}),useCallback:(fn:any)=>fn},
  'react/jsx-runtime':{jsx,jsxs:jsx},
  'react-native':{AppState:{currentState:'active',addEventListener:(_event:any,fn:any)=>{stateListeners.push(fn);return{remove(){}};}},Image:'Image',View:'View',StyleSheet:{absoluteFill:{position:'absolute'},create:(x:any)=>x},useWindowDimensions:()=>({width:412,height:892,scale:3})},
  'expo-splash-screen':{preventAutoHideAsync:async()=>{},hideAsync:async()=>{calls.push('hideSplash');},setOptions(){}},
  'expo-video':{VideoView:'VideoView',useVideoPlayer:(source:any,setup:any)=>{calls.push(source===null?'empty-player':'source-in-constructor');setup(player);return player;}},
  'expo-linear-gradient':{LinearGradient:'LinearGradient'},
  'react-native-reanimated':{default:{View:'AnimatedView'},FadeOut:{duration:()=>({})}},
  '../home/hooks':{useReducedMotion:()=>reduced},
 };
 const e:any={};
 const text=readFileSync(new URL('../src/components/StartupLoading.tsx',import.meta.url),'utf8')+'\nexportsForTest = {LaunchVideo, StartupLoading};';
 const code=ts.transpileModule(text,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const context:any={exports:e,exportsForTest:undefined,Error,require:(name:string)=>name.includes('/assets/startup/')?1:modules[name],setTimeout:()=>0,clearTimeout(){}};
 vm.runInNewContext(code,context);
 return {...context.exportsForTest,calls,player,stateListeners,reduced:(value:boolean)=>{reduced=value;},effects:()=>effects.splice(0).map(fn=>fn())};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('startup configures non-interrupting playback before asynchronously loading the MP4',async()=>{
 const h=harness();h.LaunchVideo({onComplete(){}});h.effects();await settle();
 assert.equal(h.calls[0],'empty-player');
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
