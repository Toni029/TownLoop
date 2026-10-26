import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
function fixture(width:number,os:string){
 const state:any[]=[];let cursor=0;const jsx=(type:any,props:any)=>({type,props});
 const modules:any={react:{useRef:(v:any)=>({current:v}),useState:(v:any)=>{const i=cursor++;if(!(i in state))state[i]=v;return[state[i],(next:any)=>{state[i]=typeof next==='function'?next(state[i]):next;}];}},'react/jsx-runtime':{jsx,jsxs:jsx},'react-native':{KeyboardAvoidingView:'Keyboard',Platform:{OS:os},Pressable:'Pressable',Text:'Text',View:'View',StyleSheet:{create:(v:any)=>v},useWindowDimensions:()=>({width})},'../keyboard/KeyboardScrollView':{ScrollView:'Scroll',TextInput:'Input'},'../lib/community':{useCommunity:()=>({community:'cecil_pines'})},'../lib/googleSignIn':{googleSignInAvailable:()=>false}};
 const source=ts.transpileModule(readFileSync(new URL('../src/app/sign-in.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const exports:any={};vm.runInNewContext(source,{exports,require:(name:string)=>modules[name]||{}});
 return ()=>{cursor=0;return exports.default();};
}
function find(node:any,label:string,parent?:any):any {if(!node||typeof node!=='object')return;if(node.props?.accessibilityLabel===label)return{node,parent};for(const child of [node.props?.children].flat(Infinity)){const found=find(child,label,node);if(found)return found;}}
const style=(v:any)=>Object.assign({},...[v].flat(Infinity).filter(Boolean));
test('Android and iOS fields reserve separate icon, text and visibility-button space at narrow and wide sizes',()=>{
 for(const os of ['android','ios'])for(const width of [320,390,800]){
  const render=fixture(width,os),tree=render();
  for(const label of ['Resident Email Address','Password']){
   const {node,parent}=find(tree,label),row=style(parent.props.style),input=style(node.props.style),icon=style(parent.props.children[0].props.style);
   assert.equal(node.props.underlineColorAndroid,'transparent');assert.equal(row.flexDirection,'row');assert.equal(row.alignItems,'center');assert.equal(input.flex,1);assert.equal(input.minWidth,0);assert.equal(input.width,undefined);assert.equal(icon.position,undefined);assert.equal(icon.flexShrink,0);assert.equal(icon.width,20);
  }
  const field=find(tree,'Resident Email Address');let focused=0;field.node.props.ref.current={focus:()=>{focused++;}};field.parent.props.onPress();assert.equal(focused,1);
  const eye=style(find(tree,'Show password').node.props.style);assert.equal(eye.position,undefined);assert.equal(eye.width,44);
 }
});
test('focus retains placeholders and long typed values remain inside the text slot, including visible passwords',()=>{
 const render=fixture(320,'android');let tree=render();find(tree,'Resident Email Address').node.props.onFocus();tree=render();
 assert.equal(find(tree,'Resident Email Address').node.props.placeholder,'e.g. resident@cecilpines.com');assert.equal(find(tree,'Resident Email Address').node.props.value,'');
 const email='a'.repeat(180)+'@example.invalid',password='b'.repeat(160);find(tree,'Resident Email Address').node.props.onChangeText(email);find(tree,'Password').node.props.onChangeText(password);tree=render();
 assert.equal(find(tree,'Resident Email Address').node.props.value,email);assert.equal(find(tree,'Password').node.props.value,password);assert.equal(find(tree,'Password').node.props.secureTextEntry,true);
 find(tree,'Show password').node.props.onPress();tree=render();assert.equal(find(tree,'Password').node.props.secureTextEntry,false);assert.equal(find(tree,'Password').node.props.value,password);assert(find(tree,'Hide password'));
});
