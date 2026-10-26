import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
function fixture() {
 const values:any[]=[],animations:any[]=[],gestures:any[]=[],cleanups:Function[]=[];let closes=0;
 const shared=(initial:any)=>{const v={value:initial,get(){return this.value;},set(next:any){this.value=next?.animation?next.target:next;}};values.push(v);return v;};
 const gesture=(kind:string)=>{const g:any={kind};for(const method of ['minDistance','maxPointers','numberOfTaps','onStart','onUpdate','onEnd','onFinalize'])g[method]=(arg:any)=>{g[method+'Value']=arg;return g;};gestures.push(g);return g;};
 const jsx=(type:any,props:any)=>({type,props});
 const modules:any={
  react:{useCallback:(fn:any)=>fn,useEffect:(fn:any)=>{const cleanup=fn();if(cleanup)cleanups.push(cleanup);},useRef:(v:any)=>({current:v}),useState:(initial:any)=>[initial,()=>{}]},
  'react/jsx-runtime':{jsx,jsxs:jsx},
  'react-native':{ActivityIndicator:'Spinner',Image:{},Modal:'Modal',Pressable:'Pressable',StyleSheet:{create:(s:any)=>s,absoluteFill:{}},Text:'Text',View:'View',useWindowDimensions:()=>({width:400,height:800})},
  'react-native-safe-area-context':{SafeAreaView:'SafeArea'},
  'react-native-gesture-handler':{Gesture:{Pinch:()=>gesture('pinch'),Pan:()=>gesture('pan'),Tap:()=>gesture('tap'),Simultaneous:(...args:any[])=>args,Exclusive:(...args:any[])=>args},GestureDetector:'GestureDetector',GestureHandlerRootView:'Root'},
  'react-native-reanimated':{default:{View:'AnimatedView'},Easing:{cubic:'cubic',out:(e:any)=>e},ReduceMotion:{System:'system'},cancelAnimation:()=>{},runOnJS:(f:any)=>f,useAnimatedStyle:(fn:any)=>({read:fn}),useSharedValue:shared,withTiming:(target:any,config:any,finish:any)=>{const a={animation:true,target,config,finish};animations.push(a);return a;}},
  './PrivateImage':{PrivateImage:'Image'},'../../../src/services/storageReferences':{authenticatedStoragePath:()=>true},'../lib/firebase':{storage:{}},'firebase/storage':{ref:()=>({bucket:'fixture'})},'lucide-react-native':{ChevronLeft:'Left',ChevronRight:'Right',X:'Close'},'./SystemBars':{SystemBars:'Bars'},
 };
 const exports:any={};const source=ts.transpileModule(readFileSync(new URL('../src/components/MarketplaceGallery.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext(source,{exports,require:(name:string)=>{assert(name in modules,name);return modules[name];},setTimeout:()=>1,clearTimeout:()=>{}});
 const tree=exports.MarketplaceGallery({media:[{type:'image',url:'fixture'}],title:'Fixture',onClose:()=>{closes++;}});tree.props.onShow();animations.length=0;
 return {tree,values,animations,gestures,cleanups,closes:()=>closes};
}
function find(node:any,predicate:(node:any)=>boolean):any {if(!node||typeof node!=='object')return;if(predicate(node))return node;for(const child of [node.props?.children].flat(Infinity)){const found=find(child,predicate);if(found)return found;}}
test('close fades the entire gallery without shrinking or resetting zoom, and finishes only once',()=>{
 const f=fixture(),[alpha,entrance,,scale,x,y, , , ,locked]=f.values;
 scale.set(2.5);x.set(40);y.set(-30);const size=entrance.get();
 find(f.tree,(n:any)=>n.props?.accessibilityLabel==='Close photo gallery').props.onPress();
 assert.equal(alpha.get(),0);assert.equal(scale.get(),2.5);assert.equal(x.get(),40);assert.equal(y.get(),-30);assert.equal(entrance.get(),size);assert.equal(locked.get(),true);
 const scene=find(f.tree,(n:any)=>n.props?.style?.some?.((s:any)=>s.read?.().opacity===0));assert(scene);
 assert.equal(f.animations.length,1);assert.equal(f.animations[0].config.reduceMotion,'system');assert.equal(f.closes(),0);
 f.tree.props.onRequestClose();assert.equal(f.animations.length,1);
 f.animations[0].finish(true);f.animations[0].finish(true);assert.equal(f.closes(),1);
});
test('swipe dismissal dissolves in place without a scale or position jump',()=>{
 const f=fixture(),pan=f.gestures.find(g=>g.kind==='pan');pan.onStartValue();pan.onUpdateValue({translationX:0,translationY:150});
 assert.equal(f.values[5].get(),150);pan.onEndValue({translationX:0,translationY:150,velocityY:1200});
 assert.equal(f.values[5].get(),150);assert.equal(f.values[3].get(),1);assert.equal(f.animations.length,1);assert.equal(f.animations[0].config.duration,220);
 for(const cleanup of f.cleanups)cleanup();f.animations[0].finish(true);assert.equal(f.closes(),0);
});
