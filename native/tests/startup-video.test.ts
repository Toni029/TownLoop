import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import ts from 'typescript';
const source=readFileSync(new URL('../src/components/StartupLoading.tsx',import.meta.url),'utf8');
function fixture(){
 const slots:any[]=[],effects:Array<()=>any>=[],timers:Array<{fn:()=>void;ms:number}>=[];let cursor=0;
 const exports:any={};const jsx=(type:any,props:any)=>({type,props});
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{
  exports,setTimeout:(fn:any,ms:number)=>{timers.push({fn,ms});return timers.length;},clearTimeout(){},require:(name:string)=>{
   if(name==='react')return {Component:class{},useState:(initial:any)=>{const index=cursor++;if(!(index in slots))slots[index]=initial;return [slots[index],(v:any)=>{slots[index]=v;}];},useEffect:(fn:any,deps:any[])=>{const index=cursor++;const previous=slots[index];if(previous&&deps.every((value:any,i:number)=>value===previous[i]))return;slots[index]=deps;effects.push(fn);}};
   if(name==='react/jsx-runtime')return{jsx,jsxs:jsx};
   if(name==='react-native')return{AccessibilityInfo:{isReduceMotionEnabled:async()=>false,addEventListener:()=>({remove(){}})},View:'View',Image:'Image',ActivityIndicator:'Spinner',StyleSheet:{create:(s:any)=>s,absoluteFill:{position:'absolute'}}};
   if(name==='react-native-reanimated')return{default:{View:'Animated'},FadeIn:{duration:(n:number)=>n},withTiming:(n:number)=>n};
   if(name==='expo-splash-screen')return{preventAutoHideAsync:async()=>{},hideAsync:async()=>{}};
   if(name==='../home/hooks')return{useReducedMotion:()=>false};
   if(name==='./ui')return{colors:{cream:'#f3ebdc',green:'green'}};
   if(name.endsWith('.png'))return name;
   throw Error(`Unexpected dependency ${name}`);
  }});
 const render=(ready:boolean)=>{cursor=0;return exports.StartupLoading({ready,children:'app'});};
 return {render,effects,timers,async commit(){effects.splice(0).forEach(fn=>fn());await new Promise<void>(resolve=>setImmediate(resolve));}};
}
test('restores the exact original native brand motion and asset, with no media dependency',()=>{
 const old=execFileSync('git',['show','7ae4520:native/src/components/StartupLoading.tsx'],{encoding:'utf8'});
 assert.equal(source.slice(source.indexOf('const enterBrand'),source.indexOf('const styles')),old.slice(old.indexOf('const enterBrand'),old.indexOf('const styles')).replace('export function StartupLoading() {\n  const reduced = useReducedMotion();','function OriginalBrandAnimation({reduced}:{reduced:boolean}) {'));
 assert.equal(execFileSync('git',['hash-object','native/assets/townloop-brand.png'],{encoding:'utf8'}),execFileSync('git',['rev-parse','7ae4520:native/assets/townloop-brand.png'],{encoding:'utf8'}));
 assert(!source.includes("from 'expo-video'"));
});
test('ready app mounts concurrently; timer ends decoration without animation callbacks; remount never replays',async()=>{
 const h=fixture();let tree=h.render(true);assert.equal(tree.props.children[0].props.children,'app');
 await h.commit();h.render(true);await h.commit();assert(h.timers.some(t=>t.ms===300));h.timers.find(t=>t.ms===300)!.fn();
 tree=h.render(true);assert.equal(tree.props.children[1],false);
 const next=h.render(false);assert.equal(next.props.children[1],false);
});
test('initialization can finish after decoration without a logo or video holding navigation',async()=>{
 const h=fixture();h.render(false);await h.commit();h.render(false);await h.commit();h.timers.find(t=>t.ms===300)!.fn();
 assert.equal(h.render(true).props.children[0].props.children,'app');
});
