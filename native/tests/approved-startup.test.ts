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
 const fades:Array<{config:any;done?:(result:{finished:boolean})=>void;stopped?:boolean}>=[];
 class Value{value:number;constructor(v:number){this.value=v;}setValue(v:number){this.value=v;}}
 const Animated={Value,View:'AnimatedView',timing:(_:any,config:any)=>{const fade={config,done:undefined as any,stopped:false};fades.push(fade);return {start:(done:any)=>{fade.done=done;},stop:()=>{fade.stopped=true;}};}};
 const modules:any={react:hooks,'react/jsx-runtime':{jsx,jsxs:jsx},
  'react-native':{View:'View',Image:'Image',Animated,Platform:{OS:'android'},AppState:app,StyleSheet:{absoluteFill:{},create:(x:any)=>x},
   AccessibilityInfo:{isReduceMotionEnabled:async()=>reduced,addEventListener:()=>({remove(){}})},
   useWindowDimensions:()=>({width:393,height:852})},
  'react-native-safe-area-context':{useSafeAreaInsets:()=>({top:59,bottom:34,left:0,right:0})},
  'expo-linear-gradient':{LinearGradient:'Gradient'},
  '../layout/phoneGeometry':{fitPortrait},
  'expo-video':{VideoView:'VideoView',createVideoPlayer:(_:any,options:any)=>{calls.push(`optout:${options?.disableAudioSession}`);return player;}},
  '../lib/nativeSplash':{hideNativeSplash:async()=>{calls.push('hideSplash');}},
 };
 const context:any={exports:{},require:(id:string)=>/\.(mp4|png)$/.test(id)?id:modules[id],
  setTimeout:(fn:any,ms:number)=>{timers.push({fn,ms});return timers.length-1;},clearTimeout:(i:number)=>{if(timers[i])timers[i].cleared=true;}};
 vm.runInNewContext(ts.transpileModule(read('../src/components/ApprovedStartup.tsx')+'\nexports.VideoScene=VideoScene;exports.VideoBoundary=VideoBoundary;',
  {compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
 const render=(name:string,props:any)=>{owner=name;cursor=0;if(!slots.has(name))slots.set(name,[]);return context.exports[name](props);};
 return {calls,events,player,timers,modules,fades,boundary:context.exports.VideoBoundary,
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
test('prepares and starts before authentication; mounts the destination behind the overlay',async()=>{
 const h=harness();let tree=await root(h,false);const scene=find(tree,'VideoScene');assert.ok(scene,'Video must not wait for authentication');
 const view=await mountScene(h,scene.props);assert.ok(h.calls.includes('play'));assert.equal(h.calls.includes('hideSplash'),false,'Do not reveal an empty decoder');
 find(view,'VideoView').props.onFirstFrameRender();h.render('VideoScene',scene.props);await h.flush();assert.ok(h.calls.includes('hideSplash'));
 tree=await root(h,true);assert.ok(find(tree,'VideoScene'));assert.equal(find(tree,'View').props.children[0].props.children,'app');
});
test('real completion holds the last frame until destination layout, then fades for 500ms without unmounting the app',async()=>{
 const h=harness();let tree=await root(h,false);const scene=find(tree,'VideoScene');await mountScene(h,scene.props);
 h.events.playToEnd();tree=await root(h,false);assert.ok(find(tree,'VideoScene'));assert.equal(h.fades.length,0);
 tree=await root(h,true);assert.equal(h.fades.length,0,'Readiness alone does not prove layout');
 tree.props.children[0].props.onLayout();tree=await root(h,true);
 assert.equal(h.fades.length,1);assert.equal(h.fades[0].config.duration,500);assert.equal(h.fades[0].config.useNativeDriver,true);
 assert.ok(find(tree,'VideoScene'),'Keep decoder until fade completes');h.fades[0].done!({finished:true});
 tree=await root(h);assert.equal(find(tree,'VideoScene'),undefined);assert.equal(tree.props.children[0].props.children,'app');
 h.unmount('VideoScene');h.unmount('ApprovedStartup');assert.equal(find(await root(h),'VideoScene'),undefined);
});
test('silent opt-out precedes preparation; poster covers decoding and video end cannot bypass playback',async()=>{
 const h=harness(),tree=await root(h,false),props=find(tree,'VideoScene').props;const view=await mountScene(h,props);
 for(const option of ['optout:true','muted:true','volume:0','audioMixingMode:mixWithOthers','showNowPlayingNotification:false','loop:false'])assert.ok(h.calls.indexOf(option)<h.calls.indexOf('prepare')&&h.calls.includes(option),option);
 assert.equal(find(view,'VideoView').props.contentFit,'contain');assert.ok(find(tree,'Image'));
 assert.equal(h.fades.length,0);
});
test('decoder failures end optional playback without waiting indefinitely for initialization',async()=>{
 for(const mode of ['stall','error','reject','play']){
  const h=harness(),props=find(await root(h),'VideoScene').props;
  if(mode==='stall')h.player.replaceAsync=()=>new Promise(()=>{});
  if(mode==='reject')h.player.replaceAsync=()=>Promise.reject(Error('prepare failed'));
  if(mode==='play')h.player.play=()=>{throw Error('decoder unavailable');};
  await mountScene(h,props);
  if(mode==='stall')h.timers.find(t=>t.ms===8000&&!t.cleared)!.fn();else if(mode==='error')h.events.statusChange({status:'error'});
  let tree=await root(h);tree.props.children[0].props.onLayout();await root(h);
  h.fades.at(-1)?.done?.({finished:true});assert.equal(find(await root(h),'VideoScene'),undefined);
  assert.doesNotThrow(()=>h.unmount('VideoScene'));
 }
 const h=harness();let finished=0;const b=new h.boundary({children:'video',onFailure:()=>finished++});
 b.state=h.boundary.getDerivedStateFromError();b.componentDidCatch();assert.equal(b.render(),null);assert.equal(finished,1);
});
test('background/resume and remount do not restart playback',async()=>{
 const h=harness(),props=find(await root(h),'VideoScene').props;await mountScene(h,props);h.background();h.resume();
 let tree=await root(h);tree.props.children[0].props.onLayout();await root(h);h.fades.at(-1)?.done?.({finished:true});
 assert.equal(find(await root(h),'VideoScene'),undefined);h.unmount('VideoScene');h.unmount('ApprovedStartup');
 assert.equal(find(await root(h),'VideoScene'),undefined);assert.equal(h.calls.filter(x=>x==='play').length,1);
});
test('Reduce Motion skips playback and fade; iOS uses the same lifecycle and remains silent',async()=>{
 const h=harness();h.reduced(true);let tree=await root(h);tree.props.children[0].props.onLayout();tree=await root(h);
 assert.equal(find(tree,'VideoScene'),undefined);assert.equal(h.fades.length,0);
 const ios=harness();ios.modules['react-native'].Platform.OS='ios';await mountScene(ios,find(await root(ios,false),'VideoScene').props);
 assert.ok(ios.calls.includes('allowsExternalPlayback:false'));assert.ok(ios.calls.includes('muted:true'));
});
test('a late prepare after unmount is unloaded and cannot play',async()=>{
 const h=harness(),props=find(await root(h),'VideoScene').props;let resolve:()=>void=()=>{};let unloading=0;
 h.player.replaceAsync=(value:any)=>value===null?(unloading++,Promise.resolve()):new Promise<void>(r=>{resolve=r;});
 await mountScene(h,props);h.unmount('VideoScene');resolve();await h.flush();assert.ok(unloading>=2);assert.equal(h.calls.includes('play'),false);
});
test('prepared source waits only for view layout and accessibility, not network readiness',async()=>{
 const h=harness(),props=find(await root(h,false),'VideoScene').props;
 const view=find(h.render('VideoScene',props),'VideoView');await h.flush();assert.ok(h.calls.includes('prepare'));assert.equal(h.calls.includes('play'),false);
 view.props.onLayout();await h.flush();view.props.onLayout();await h.flush();assert.equal(h.calls.filter(x=>x==='play').length,1);
});
test('lost fade callback and stalled initialization have bounded recovery',async()=>{
 const h=harness();let tree=await root(h);await mountScene(h,find(tree,'VideoScene').props);tree.props.children[0].props.onLayout();h.events.playToEnd();await root(h);
 h.timers.find(t=>t.ms===1200&&!t.cleared)!.fn();assert.equal(find(await root(h),'VideoScene'),undefined);
 const slow=harness();await root(slow,false);slow.timers.find(t=>t.ms===20000&&!t.cleared)!.fn();
 assert.throws(()=>slow.render('ApprovedStartup',{ready:false,children:'app'}),/initialization/i,'Use existing app error boundary, never bypass authentication');
});

test('decoder preparation starts while the accessibility lookup is pending, then plays once permission is known',async()=>{
 const h=harness();let resolve:(v:boolean)=>void=()=>{};
 h.modules['react-native'].AccessibilityInfo.isReduceMotionEnabled=()=>new Promise<boolean>(r=>{resolve=r;});
 let tree=await root(h,false);await mountScene(h,find(tree,'VideoScene').props);
 assert.ok(h.calls.includes('prepare'));assert.equal(h.calls.includes('play'),false);
 resolve(false);tree=await root(h,false);h.render('VideoScene',find(tree,'VideoScene').props);await h.flush();
 assert.equal(h.calls.filter(x=>x==='play').length,1);
});
test('exact first-frame still is portrait, and destination readiness changes cannot remove video early',async()=>{
 const png=readFileSync(new URL('../assets/launch/approved-first-frame.png',import.meta.url));
 assert.equal(png.readUInt32BE(16),1320);assert.equal(png.readUInt32BE(20),2868);
 assert.equal(createHash('sha256').update(png).digest('hex'),'5a9490d5c5e575bedd6783806df2002ae91cf2156d36917c48a11d5d0466c036');
 const h=harness();let tree=await root(h);tree.props.children[0].props.onLayout();await root(h);
 assert.equal(h.fades.length,0);assert.ok(find(await root(h,false),'VideoScene'));
 tree=await root(h,true);assert.ok(find(tree,'VideoScene'));assert.equal(h.fades.length,0);
});

test('a delayed accessibility response is not incorrectly converted into reduced motion after one second',async()=>{
 const h=harness();h.modules['react-native'].AccessibilityInfo.isReduceMotionEnabled=()=>new Promise(()=>{});
 let tree=await root(h);await mountScene(h,find(tree,'VideoScene').props);
 assert.equal(h.timers.some(t=>t.ms===1000),false);
 h.timers.find(t=>t.ms===8000&&!t.cleared)!.fn();tree=await root(h);tree.props.children[0].props.onLayout();await root(h);
 h.fades.at(-1)?.done?.({finished:true});assert.equal(find(await root(h),'VideoScene'),undefined,'Real stalled preparation still recovers');
});
