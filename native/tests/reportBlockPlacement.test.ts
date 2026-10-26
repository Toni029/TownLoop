import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
test('chat block control appears inside Report immediately after Other, not in the chat toolbar',()=>{
 const state:any[]=[];let cursor=0;const exports:any={};const jsx=(type:any,props:any)=>({type,props});
 const modules:any={react:{useState:(v:any)=>{const i=cursor++;if(!(i in state))state[i]=v;return[state[i],(n:any)=>{state[i]=n;}];},useEffect:()=>{}},'react/jsx-runtime':{jsx,jsxs:jsx},'react-native':{View:'View'},'firebase/firestore':{},'lucide-react-native':{},'../news/ui':{Action:'Action',Copy:'Copy',Field:'Field'},'./ProductDialog':{ProductDialog:'Dialog'},'../lib/firebase':{auth:{currentUser:{uid:'alice'}}},'../../../src/services/safety':{}};
 const source=ts.transpileModule(readFileSync(new URL('../src/components/SafetyActions.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext(source,{exports,require:(name:string)=>modules[name]});
 const render=()=>{cursor=0;return exports.SafetyActions({target:{kind:'user',id:'bob'},allowBlock:true,blockInReport:true});};
 function actions(node:any):any[]{if(!node||typeof node!=='object')return[];return [...(node.type==='Action'?[node]:[]),...[node.props?.children].flat(Infinity).flatMap(actions)];}
 let list=actions(render());assert.equal(list.some(n=>n.props.label==='Block user'),false);list.find(n=>n.props.label==='Report user').props.onPress();
 list=actions(render());const labels=list.map(n=>n.props.label);assert.equal(labels.indexOf('Block user'),labels.indexOf('Other')+1);
});
