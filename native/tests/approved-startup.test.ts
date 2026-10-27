import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
import {fitPortrait} from '../src/layout/phoneGeometry.ts';
const read=(p:string)=>readFileSync(new URL(p,import.meta.url),'utf8');
function harness(){
 let owner='',cursor=0,reduced=false;
 const slots=new Map<string,any[]>(),effects:Array<()=>void>=[],calls:string[]=[];
 const timers:Array<{ms:number;fn:()=>void;cleared?:boolean}>=[];
 const appListeners:Array<(s:string)=>void>=[],events:Record<string,(x?:any)=>void>={};
 const app:any={currentState:'active',addEventListener:(_:any,fn:any)=>{appListeners.push(fn);return {remove(){}};}};
 const player:any=new Proxy({
  replaceAsync:async(source:any)=>{calls.push(source===null?'unload':'prepare');},
  play(){calls.push('play');},pause(){calls.push('pause');},
  release(){throw Error('Never release a player ID retained by queued Fabric props');},
  addListener(name:string,fn:any){events[name]=fn;return {remove(){}};},
 },{set(o:any,k:string,v){calls.push(`${k}:${v}`);o[k]=v;return true;}});
 const slot=()=>{const list=slots.get(owner)!;return {list,i:cursor++};};
 const changed=(old:any,deps:any[])=>!old||deps.some((x,i)=>old.deps[i]!==x);
 const hooks={
  Component:class{props:any;constructor(p:any){this.props=p;}},
  useRef(value:any){const {list,i}=slot();return list[i]||(list[i]={current:value});},
  useState(value:any){const {list,i}=slot();if(!list[i])list[i]={value:typeof value==='function'?value():value};return [list[i].value,(v:any)=>{list[i].value=typeof v==='function'?v(list[i].value):v;}];},
  useCallback(fn:any,deps:any[]){const {list,i}=slot();if(changed(list[i],deps))list[i]={deps,fn};return list[i].fn;},
  useEffect(fn:any,deps:any[]=[]){const {list,i}=slot();if(!changed(list[i],deps))return;const old=list[i];const next={deps,cleanup:undefined as any};list[i]=next;effects.push(()=>{old?.cleanup?.();next.cleanup=fn();});},
 };
 const jsx=(type:any,props:any)=>({type,props});
 const modules:any={react:hooks,'react/jsx-runtime':{jsx,jsxs:jsx},
  'react-native':{View:'View',Platform:{OS:'android'},AppState:app,StyleSheet:{absoluteFill:{},create:(x:any)=>x},
   AccessibilityInfo:{isReduceMotionEnabled:async()=>reduced,addEventListener:()=>({remove(){}})},
   useWindowDimensions:()=>({width:393,height:852})},
  'react-native-safe-area-context':{useSafeAreaInsets:()=>({top:59,bottom:34,left:0,right:0})},
  'expo-linear-gradient':{LinearGradient:'Gradient'},
  '../layout/phoneGeometry':{fitPortrait},
  'expo-video':{VideoView:'VideoView',createVideoPlayer:(_:any,options:any)=>{calls.push(`optout:${options?.disableAudioSession}`);return player;}},
  '../lib/nativeSplash':{hideNativeSplash:async()=>{calls.push('hideSplash');}},
 };
 const context:any={exports:{},require:(id:string)=>id.endsWith('.mp4')?id:modules[id],
  setTimeout:(fn:any,ms:number)=>{timers.push({fn,ms});return timers.length-1;},clearTimeout:(i:number)=>{if(timers[i])timers[i].cleared=true;}};
 vm.runInNewContext(ts.transpileModule(read('../src/components/ApprovedStartup.tsx')+'\nexports.VideoScene=VideoScene;exports.VideoBoundary=VideoBoundary;',
  {compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
 const render=(name:string,props:any)=>{owner=name;cursor=0;if(!slots.has(name))slots.set(name,[]);return context.exports[name](props);};
 return {calls,events,player,timers,modules,boundary:context.exports.VideoBoundary,
  reduced:(v:boolean)=>{reduced=v;},
  background:()=>{app.currentState='background';appListeners.forEach(fn=>fn('background'));},
  resume:()=>{app.currentState='active';appListeners.forEach(fn=>fn('active'));},
  render,flush:async()=>{for(const fn of effects.splice(0))fn();await new Promise(r=>setImmediate(r));},
  unmount:(name:string)=>{for(const slot of slots.get(name)||[])slot.cleanup?.();slots.delete(name);},
 };
}
function find(tree:any,name:string):any{
 if(!tree)return undefined;if(Array.isArray(tree))return Array.from(tree).map(x=>find(x,name)).find(Boolean);
 if(tree.type===name||tree.type?.name===name)return tree;
 return find(tree.props?.children,name);
}
async function mountScene(h:ReturnType<typeof harness>,props:any){const tree=h.render('VideoScene',props);find(tree,'VideoView').props.onLayout();await h.flush();return tree;}
async function root(h:ReturnType<typeof harness>,ready=true){let tree:any;for(let i=0;i<4;i++){tree=h.render('ApprovedStartup',{ready,children:'app'});await h.flush();}return tree;}
test('only the exact approved MP4 is referenced',()=>{
 const b=readFileSync(new URL('../assets/launch/approved-startup.mp4',import.meta.url));
 assert.equal(createHash('sha256').update(b).digest('hex'),'2233522e741f4cf4a9bdc167467cdf23f81dfe77f6ed7346254f8074b4c9bc35');
 const code=read('../src/components/ApprovedStartup.tsx');
 assert.equal(/startupapp|startup-portrait|withTiming|FadeOut|useVideoPlayer/.test(code),false);
});
test('waits for readiness; early or changing auth readiness cannot end playback',async()=>{
 const h=harness();assert.equal(find(await root(h,false),'VideoScene'),undefined);
 let tree=await root(h);const scene=find(tree,'VideoScene');assert.ok(scene);
 await mountScene(h,scene.props);
 assert.equal(h.calls.filter(x=>x==='play').length,1);
 assert.ok(find(await root(h,false),'VideoScene'));
 assert.ok(find(await root(h,true),'VideoScene'));
 h.events.playToEnd();tree=await root(h,true);
 assert.equal(find(tree,'VideoScene'),undefined);assert.equal(tree,'app');
 h.unmount('VideoScene');h.unmount('ApprovedStartup');
 assert.equal(find(await root(h,true),'VideoScene'),undefined);
});
test('silent opt-out precedes preparation, splash hides before play, and failure timers are not normal completion',async()=>{
 const h=harness(),props=find(await root(h),'VideoScene').props;
 let view=await mountScene(h,props);
 for(const option of ['optout:true','muted:true','volume:0','audioMixingMode:mixWithOthers','showNowPlayingNotification:false','loop:false'])assert.ok(h.calls.indexOf(option)<h.calls.indexOf('prepare')&&h.calls.includes(option),option);
 assert.ok(h.calls.indexOf('hideSplash')<h.calls.indexOf('play'));
 view=find(view,'VideoView');assert.equal(view.props.contentFit,'contain');assert.equal(view.props.style[1].opacity,0);
 view.props.onFirstFrameRender();
 assert.equal(find(h.render('VideoScene',props),'VideoView').props.style[1].opacity,1);
 assert.ok(h.timers.some(t=>t.ms===4500&&!t.cleared));
 assert.ok(find(await root(h),'VideoScene'));
});
test('prepare stalls, decoder errors and render failures recover without a replacement logo',async()=>{
 for(const mode of ['stall','error','reject','play']){
  const h=harness(),props=find(await root(h),'VideoScene').props;
  if(mode==='stall')h.player.replaceAsync=()=>new Promise(()=>{});
  if(mode==='reject')h.player.replaceAsync=()=>Promise.reject(Error('prepare failed'));
  if(mode==='play')h.player.play=()=>{throw Error('decoder unavailable');};
  await mountScene(h,props);
  if(mode==='stall')h.timers.find(t=>t.ms===8000&&!t.cleared)!.fn();else if(mode==='error')h.events.statusChange({status:'error'});
  assert.equal(await root(h),'app');
  assert.doesNotThrow(()=>h.unmount('VideoScene'));
 }
 const h=harness();let finished=0;const b=new h.boundary({children:'video',onFailure:()=>finished++});
 b.state=h.boundary.getDerivedStateFromError();b.componentDidCatch();assert.equal(b.render(),null);assert.equal(finished,1);
});
test('backgrounding ends optional playback; resume/remount never starts it again',async()=>{
 const h=harness(),props=find(await root(h),'VideoScene').props;await mountScene(h,props);
 h.background();h.resume();assert.equal(await root(h),'app');
 h.unmount('VideoScene');assert.ok(h.calls.includes('unload'));
 assert.equal(h.calls.filter(x=>x==='play').length,1);
});
test('Reduce Motion and bounded accessibility failures skip video; iOS stays silent without external playback',async()=>{
 const h=harness();h.reduced(true);assert.equal(await root(h),'app');assert.equal(h.calls.includes('prepare'),false);
 const slow=harness();slow.modules['react-native'].AccessibilityInfo.isReduceMotionEnabled=()=>new Promise(()=>{});
 await root(slow);slow.timers.find(t=>t.ms===1000&&!t.cleared)!.fn();assert.equal(await root(slow),'app');
 const ios=harness();ios.modules['react-native'].Platform.OS='ios';const props=find(await root(ios),'VideoScene').props;await mountScene(ios,props);
 assert.ok(ios.calls.includes('allowsExternalPlayback:false'));assert.ok(ios.calls.includes('muted:true'));
});

test('a late source prepare after unmount is unloaded again and cannot start playback',async()=>{
 const h=harness(),props=find(await root(h),'VideoScene').props;
 let resolve:()=>void=()=>{};let unloading=0;
 h.player.replaceAsync=(value:any)=>value===null?(unloading++,Promise.resolve()):new Promise<void>(r=>{resolve=r;});
 await mountScene(h,props);h.unmount('VideoScene');resolve();await h.flush();
 assert.ok(unloading>=2);assert.equal(h.calls.includes('play'),false);
});

test('a prepared file cannot start before its native view lays out; duplicate layout never replays it',async()=>{
 const h=harness(),props=find(await root(h),'VideoScene').props;
 const view=find(h.render('VideoScene',props),'VideoView');await h.flush();
 assert.ok(h.calls.includes('prepare'));assert.equal(h.calls.includes('play'),false);
 view.props.onLayout();await h.flush();view.props.onLayout();await h.flush();
 assert.equal(h.calls.filter(x=>x==='play').length,1);
});
