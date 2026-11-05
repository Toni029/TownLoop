import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
test('post and Marketplace trash request inline confirmation before deletion',()=>{
 let requested=0,deleted=0,cancelled=0;
 const exports:any={};
 const source=ts.transpileModule(readFileSync(new URL('../src/social/SocialFeed.tsx',import.meta.url),'utf8')+'\nexports.DeleteControlForTest = DeleteControl; exports.DeleteConfirmationForTest = DeleteConfirmation;',{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const jsx=(type:any,props:any)=>({type,props});
 vm.runInNewContext(source,{exports,require:(name:string)=>name==='react/jsx-runtime'?{jsx,jsxs:jsx}:name==='react-native'?{Pressable:'Pressable',View:'View'}:name==='../news/ui'?{Copy:'Copy',Action:'Action'}:{}});
 const control=exports.DeleteControlForTest({busy:false,onRequest:()=>{requested++;}});
 control.props.onPress();assert.equal(requested,1);assert.equal(deleted,0);
 for(const kind of ['post','listing']){
  const confirmation=exports.DeleteConfirmationForTest({kind,busy:false,onConfirm:()=>{deleted++;},onCancel:()=>{cancelled++;}});
  const children=confirmation.props.children;
  assert.equal(children[0].props.children.join(''),`Delete this ${kind === 'post' ? 'post' : 'listing'}?`);
  children[2].props.onPress();assert.equal(cancelled,kind==='post'?1:2);
  children[1].props.onPress();assert.equal(deleted,kind==='post'?1:2);
 }
});
