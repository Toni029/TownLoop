import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const jsx=(type:any,props:any)=>({type,props});
const ui=ts.createSourceFile('ui.tsx',readFileSync(new URL('../src/news/ui.tsx',import.meta.url),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const action=ui.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='Action')!;
const exports:any={};
vm.runInNewContext(ts.transpileModule(action.getText(ui),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS}}).outputText,
 {exports,usePresentation:()=>({dark:false}),Pressable:'Pressable',Copy:'Copy',require:()=>({jsx,jsxs:jsx})});
test('icon-only Report retains green flag, accessible name and touch target without visible text',()=>{
 const node=exports.Action({label:'Report',icon:'Flag',tone:'light',compact:true,iconOnly:true,onPress(){}});
 assert.equal(node.props.accessibilityLabel,'Report');
 const children=[node.props.children].flat().filter(Boolean);
 assert.equal(children.length,1);
 assert.equal(children[0].type,'Flag');
 assert.equal(children[0].props.color,'#064e3b');
 const style=node.props.style({pressed:false});
 assert.ok(style.minHeight>=44&&style.width>=44);
 const normal=exports.Action({label:'Keep existing action',onPress(){}});
 assert.equal(normal.props.children.at(-1).props.children,'Keep existing action');
});
for(const kind of ['post','marketplace','comment','user'])test(`${kind}: shared report icon still opens its reporting dialog`,()=>{
 let cursor=0;const state:any[]=[];
 const e:any={};
 vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/components/SafetyActions.tsx',import.meta.url),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS}}).outputText,{exports:e,require:(name:string)=>{
  if(name==='react/jsx-runtime')return{jsx,jsxs:jsx};
  if(name==='react')return{useEffect(){},useState:(initial:any)=>{const i=cursor++;if(!(i in state))state[i]=initial;return[state[i],(v:any)=>{state[i]=v;}];}};
  if(name==='react-native')return{View:'View'};
  if(name==='lucide-react-native')return{Flag:'Flag',ShieldOff:'ShieldOff'};
  if(name==='../news/ui')return{Action:'Action',Copy:'Copy',Field:'Field',ErrorNotice:'ErrorNotice'};
  if(name==='./ProductDialog')return{ProductDialog:'ProductDialog'};
  if(name==='../lib/firebase')return{auth:{currentUser:{uid:'self'}},app:{},db:{}};
  return{};
 }});
 const render=()=>{cursor=0;return e.SafetyActions({target:{kind,id:'target',authorId:'other'}});};
 const control=render().props.children[0].props.children[0];
 assert.equal(control.props.iconOnly,true);
 assert.match(control.props.label,/Report/);
 control.props.onPress();
 assert.equal(render().props.children.at(-1).type,'ProductDialog');
});
