import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';import ts from 'typescript';
test('full-width Inbox action fills its column without widening other app buttons',()=>{
 const exports:any={},jsx=(type:any,props:any)=>({type,props});const source=ts.transpileModule(readFileSync(new URL('../src/news/ui.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext(source,{exports,require:(name:string)=>name==='react/jsx-runtime'?{jsx,jsxs:jsx}:name==='react-native'?{StyleSheet:{create:(v:any)=>v}}:name==='../shell/TownLoopShell'?{usePresentation:()=>({dark:false})}:{}});
 const wide=exports.Action({label:'Back to inbox',fullWidth:true,onPress(){}});assert.equal(wide.props.style({pressed:false}).width,'100%');
 const original=exports.Action({label:'Other action',onPress(){}});assert.equal(original.props.style({pressed:false}).width,undefined);
});
