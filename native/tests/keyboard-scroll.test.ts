import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {revealOffset} from '../src/keyboard/geometry.ts';

// OS keyboard events, native measurements and timers are the test boundary.
// The real shared scroll/input implementation routes focus and calculates movement.
function fixture(os: 'android'|'ios') {
 const listeners:Record<string,(e:any)=>void>={},timers=new Map<number,()=>void>();
 const effects:(()=>void)[]=[],scrolls:number[]=[];
 let nextTimer=0,focus:any=()=>{},inputY=450,keyboardTop=500,offset=0;
 const jsx=(type:any,props:any)=>({type,props});
 const exports:any={};
 const runtime:any={
  react:{createContext:()=>({Provider:'Focus'}),forwardRef:(f:any)=>f,
   useRef:(v:any)=>({current:v}),useState:(v:any)=>[v,()=>{}],useCallback:(f:any)=>f,
   useEffect:(f:any)=>{effects.push(f());},useContext:()=>focus},
  'react/jsx-runtime':{jsx,jsxs:jsx},'./geometry':{revealOffset},
  'react-native':{Platform:{OS:os},ScrollView:'Scroll',TextInput:'Input',StyleSheet:{flatten:(v:any)=>v},
   Keyboard:{addListener:(name:string,fn:any)=>{listeners[name]=fn;return{remove:()=>{delete listeners[name];}};}}},
 };
 vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/keyboard/KeyboardScrollView.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,
  {exports,require:(id:string)=>runtime[id],setTimeout:(fn:()=>void)=>{timers.set(++nextTimer,fn);return nextTimer;},clearTimeout:(id:number)=>timers.delete(id)});
 const provider=exports.ScrollView({extraKeyboardSpace:true,children:'comments'},null);
 focus=provider.props.value;
 const nativeScroll=provider.props.children;
 nativeScroll.props.ref({getNativeScrollRef:()=>({measureInWindow:(fn:any)=>fn(0,100,360,600)}),scrollTo:({y}:any)=>{scrolls.push(y);inputY-=y-offset;offset=y;nativeScroll.props.onScroll({nativeEvent:{contentOffset:{y}}});}});
 const input=exports.TextInput({keyboardActionSpace:56,multiline:true},null);
 input.props.ref({isFocused:()=>true,measureInWindow:(fn:any)=>fn(0,inputY,300,90)});
 const flush=()=>{const queued=[...timers.values()];timers.clear();queued.forEach(fn=>fn());};
 return{input,scrolls,flush,
  show:()=>listeners.keyboardDidShow({endCoordinates:{screenY:keyboardTop}}),
  resize:()=>{keyboardTop=430;listeners.keyboardDidChangeFrame({endCoordinates:{screenY:keyboardTop}});},
  cleanup:()=>effects.forEach(fn=>fn?.()),listeners};
}
for(const os of ['android','ios'] as const)test(`${os}: comment focus reveals input and Send action, rechecks keyboard height and cleans up`,()=>{
 const f=fixture(os);f.input.props.onFocus({});f.show();f.flush();
 assert.deepEqual(f.scrolls,[112]); // Input bottom540 + action56 + margin16 - keyboard500.
 f.resize();f.flush();assert.equal(f.scrolls.at(-1),182); // Absolute offset includes the first movement.
 f.cleanup();assert.equal(Object.keys(f.listeners).length,0);
});
