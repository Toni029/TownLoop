import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
test('Marketplace trash deletes directly while other post types retain confirmation',()=>{
 let confirmed=0,deleted=0;
 const exports:any={};
 const source=ts.transpileModule(readFileSync(new URL('../src/social/SocialFeed.tsx',import.meta.url),'utf8')+'\nexports.DeleteControlForTest = DeleteControl;',{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const jsx=(type:any,props:any)=>({type,props});
 vm.runInNewContext(source,{exports,require:(name:string)=>name==='react'?{useState:()=>[false,()=>{confirmed++;}]}:name==='react/jsx-runtime'?{jsx,jsxs:jsx}:name==='react-native'?{Pressable:'Pressable'}:{}});
 const direct=exports.DeleteControlForTest({busy:false,confirmation:false,onDelete:()=>{deleted++;}});
 direct.props.onPress();assert.equal(deleted,1);assert.equal(confirmed,0);
 const guarded=exports.DeleteControlForTest({busy:false,onDelete:()=>{deleted++;}});
 guarded.props.onPress();assert.equal(deleted,1);assert.equal(confirmed,1);
});
