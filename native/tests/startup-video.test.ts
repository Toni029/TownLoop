// Executes the actual component/hooks and UI-completion bridge with a deterministic clock.
// This verifies lifecycle/timing, not native frame rendering or physical-device behavior.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import ts from 'typescript';
const source=readFileSync(new URL('../src/components/StartupLoading.tsx',import.meta.url),'utf8');
function fixture(reduced=false){
 let now=0,nextId=0,owner='root',cursor=0,ready=true,dirty=true,brandMounted=false,state='active';
 let root:any,brand:any;const slots:Record<string,any[]>={root:[],brand:[]},jobs:Array<()=>void>=[];
 const timers=new Map<number,{at:number;fn:()=>void}>(),motions:any[]=[],listeners=new Map<string,Set<(s:any)=>void>>();
 const schedule=(fn:()=>void,ms:number)=>{const id=++nextId;timers.set(id,{at:now+ms,fn});return id;};
 const cancel=(id:number)=>timers.delete(id);
 const equal=(a:any[],b:any[])=>a&&a.length===b.length&&a.every((x,i)=>x===b[i]);
 const hooks={
  Component:class{},
  useState:(initial:any)=>{const list=slots[owner],i=cursor++;if(!list[i]){const slot={value:typeof initial==='function'?initial():initial,set:(value:any)=>{slot.value=typeof value==='function'?value(slot.value):value;dirty=true;}};list[i]=slot;}return[list[i].value,list[i].set];},
  useRef:(initial:any)=>{const list=slots[owner],i=cursor++;return list[i]||(list[i]={current:initial});},
  useCallback:(fn:any,deps:any[])=>{const list=slots[owner],i=cursor++;if(!list[i]||!equal(list[i].deps,deps))list[i]={deps,fn};return list[i].fn;},
  useEffect:(fn:any,deps:any[])=>{const list=slots[owner],i=cursor++,old=list[i];if(old&&equal(old.deps,deps))return;const slot={deps,cleanup:old?.cleanup};list[i]=slot;jobs.push(()=>{slot.cleanup?.();slot.cleanup=fn();});},
 };
 const jsx=(type:any,props:any)=>({type,props});
 const exports:any={};
 class ClockDate extends Date{static now(){return now;}}
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{
  exports,Date:ClockDate,setTimeout:schedule,clearTimeout:cancel,requestAnimationFrame:(fn:any)=>schedule(fn,16),cancelAnimationFrame:cancel,
  require:(name:string)=>{
   if(name==='react')return hooks;
   if(name==='react/jsx-runtime')return{jsx,jsxs:jsx};
   if(name==='react-native')return{
    AccessibilityInfo:{isReduceMotionEnabled:async()=>reduced,addEventListener:()=>({remove(){}})},
    AppState:{get currentState(){return state;},addEventListener:(kind:string,fn:any)=>{if(!listeners.has(kind))listeners.set(kind,new Set());listeners.get(kind)!.add(fn);return{remove:()=>listeners.get(kind)!.delete(fn)};}},
    View:'View',Image:'Image',ActivityIndicator:'Spinner',StyleSheet:{create:(s:any)=>s,absoluteFill:{position:'absolute'}},
   };
   if(name==='react-native-reanimated')return{
    default:{View:'Animated'},FadeIn:{duration:(n:number)=>n},ReduceMotion:{System:'system'},Easing:{quad:'quad',inOut:(v:any)=>v},
    useSharedValue:(initial:any)=>hooks.useRef({value:initial}).current,useAnimatedStyle:(fn:any)=>fn(),runOnJS:(fn:any)=>fn,
    cancelAnimation:()=>{for(const m of motions.filter(m=>!m.done)){m.done=true;cancel(m.timer);m.callback(false);}},
    withTiming:(value:any,config:any,callback:any)=>{const m:any={config,callback,done:false};m.timer=schedule(()=>{m.done=true;callback(true);},config.duration);motions.push(m);return value;},
   };
   if(name==='expo-splash-screen')return{preventAutoHideAsync:async()=>{},hideAsync:async()=>{}};
   if(name==='./ui')return{colors:{cream:'#f3ebdc',green:'green'}};
   if(name.endsWith('.png'))return name;
   throw Error(`Unexpected dependency ${name}`);
  },
 });
 async function flush(){
  for(let i=0;i<12;i++){
   dirty=false;owner='root';cursor=0;root=exports.StartupLoading({ready,children:'app'});
   const candidate=root.props.children[1]?.props?.children?.props?.children;
   if(typeof candidate?.type==='function'){
    owner='brand';cursor=0;brand=candidate.type(candidate.props);brandMounted=true;
   }else if(brandMounted){for(const slot of slots.brand)slot?.cleanup?.();slots.brand=[];brandMounted=false;brand=null;}
   jobs.splice(0).forEach(fn=>fn());await new Promise<void>(resolve=>setImmediate(resolve));
   if(!dirty&&!jobs.length)break;
  }
 }
 return {
  motions,duration:exports.STARTUP_DURATION_MS,now:()=>now,
  async render(value=true){ready=value;await flush();},
  async visible(){assert(brand);brand.props.onLayout();brand.props.children.props.children[0].props.onLoad();await flush();await this.advance(32);},
  open:()=>root.props.children[0]!==false,
  async advance(ms:number){const end=now+ms;for(;;){const next=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;now=next[1].at;timers.delete(next[0]);next[1].fn();await flush();}now=end;await flush();},
  async appState(value:string){state=value;for(const fn of [...listeners.get('change')||[]])fn(value);await flush();},
  async imageError(){brand.props.children.props.children[0].props.onError();await flush();},
  async interrupt(){const m=motions.at(-1);m.done=true;cancel(m.timer);m.callback(false);await flush();},
  stallCompletion(){const m=motions.at(-1);cancel(m.timer);},
  async earlyCompletion(){const m=motions.at(-1);cancel(m.timer);m.done=true;m.callback(true);await flush();},
  async remount(){for(const group of Object.values(slots))for(const slot of group)slot?.cleanup?.();slots.root=[];slots.brand=[];brandMounted=false;await flush();},
 };
}
test('preserves original brand asset, composition, opacity/scale endpoints and no media dependency',()=>{
 const old=execFileSync('git',['show','7ae4520:native/src/components/StartupLoading.tsx'],{encoding:'utf8'});
 assert.equal(source.slice(source.indexOf('const styles ='),source.indexOf('class LaunchBoundary')).trim(),old.slice(old.indexOf('const styles =')).trim());
 assert.equal(execFileSync('git',['hash-object','native/assets/townloop-brand.png'],{encoding:'utf8'}),execFileSync('git',['rev-parse','7ae4520:native/assets/townloop-brand.png'],{encoding:'utf8'}));
 assert(source.includes('scale:0.97+0.03*progress.value'));assert(!source.includes("from 'expo-video'"));
});
test('early readiness cannot dismiss startup before 3.2 visible seconds; motion spans the whole timeline',async()=>{
 const h=fixture();await h.render();assert(!h.open());await h.advance(2000);assert(!h.open());assert.equal(h.motions.length,0);
 await h.visible();assert.equal(h.motions[0].config.duration,3200);
 await h.advance(3199);assert(!h.open());await h.advance(1);assert(h.open());
});
test('slow initialization waits for readiness without replaying completed motion',async()=>{
 const h=fixture();await h.render(false);await h.visible();await h.advance(3200);assert(!h.open());
 await h.advance(8000);assert.equal(h.motions.length,1);await h.render(true);assert(h.open());
 await h.appState('background');await h.advance(10000);await h.appState('active');assert.equal(h.motions.length,1);assert(h.open());
});
test('background time is excluded and resume continues the remaining motion rather than replaying',async()=>{
 const h=fixture();await h.render();await h.visible();await h.advance(1000);await h.appState('background');await h.advance(10000);assert(!h.open());
 await h.appState('active');await h.advance(32);assert.equal(h.motions.at(-1).config.duration,2200);
 await h.advance(2199);assert(!h.open());await h.advance(1);assert(h.open());
});
test('Reduce Motion shows the same static brand for the minimum visible interval',async()=>{
 const h=fixture(true);await h.render();await h.visible();assert.equal(h.motions.length,0);await h.advance(3199);assert(!h.open());await h.advance(1);assert(h.open());
});
test('decode failure and interrupted animation skip safely; missing completion has bounded recovery',async()=>{
 const failed=fixture();await failed.render();await failed.imageError();assert(failed.open());
 const interrupted=fixture();await interrupted.render();await interrupted.visible();await interrupted.interrupt();assert(interrupted.open());
 const stalled=fixture();await stalled.render();await stalled.visible();stalled.stallCompletion();await stalled.advance(5199);assert(!stalled.open());await stalled.advance(1);assert(stalled.open());
 const decode=fixture();await decode.render();await decode.advance(5000);assert(decode.open());
});
test('completed remount never replays; each fresh JS process gets its own cold launch',async()=>{
 const h=fixture();await h.render();await h.visible();await h.advance(3200);await h.remount();assert(h.open());assert.equal(h.motions.length,1);
 const fresh=fixture();await fresh.render();assert(!fresh.open());await fresh.visible();assert.equal(fresh.motions.length,1);
});

test('an early UI completion callback cannot bypass the minimum visible clock',async()=>{
 const h=fixture();await h.render();await h.visible();await h.earlyCompletion();await h.advance(3199);assert(!h.open());await h.advance(1);assert(h.open());
});

test('authentication/readiness changes cannot restart or shorten active motion',async()=>{
 const h=fixture();await h.render(false);await h.visible();await h.advance(1000);await h.render(true);assert(!h.open());assert.equal(h.motions.length,1);await h.advance(2199);assert(!h.open());await h.advance(1);assert(h.open());
});
