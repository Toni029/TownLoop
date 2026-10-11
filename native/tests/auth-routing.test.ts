import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const ts=createRequire(import.meta.url)('typescript');
const source=ts.createSourceFile('layout.tsx',readFileSync(new URL('../src/app/_layout.tsx',import.meta.url),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
// Check the real screen order and inherited guards that determine Expo's fallback route.
function availableScreens(user:object|null,profile:{approved:boolean}|null):string[]{
 const routes:string[]=[];
 function visit(node:any,allowed=true){
  if(ts.isJsxElement(node)&&node.openingElement.tagName.getText(source)==='Stack.Protected'){
   const guard=node.openingElement.attributes.properties.find((p:any)=>p.name?.text==='guard')?.initializer?.expression;
   const enabled=guard?Function('user','profile',`return ${guard.getText(source)}`)(user,profile):false;
   node.children.forEach((child:any)=>visit(child,allowed&&enabled));return;
  }
  if(ts.isJsxSelfClosingElement(node)&&node.tagName.getText(source)==='Stack.Screen'&&allowed){
   const name=node.attributes.properties.find((p:any)=>p.name?.text==='name')?.initializer?.text;
   if(name)routes.push(name);
  }
  ts.forEachChild(node,(child:any)=>visit(child,allowed));
 }
 visit(source);return routes;
}
test('successful login cannot fall back to a public community or login screen',()=>{
 assert.deepEqual(availableScreens({uid:'resident'},{approved:true}),['(tabs)','account']);
});
test('pending and missing profiles route to account status, never community selection',()=>{
 assert.deepEqual(availableScreens({uid:'pending'},{approved:false}),['pending']);
 assert.deepEqual(availableScreens({uid:'missing'},null),['pending']);
});
test('signed-out users retain community selection and sign-in',()=>{
 assert.deepEqual(availableScreens(null,null),['communities','sign-in']);
});
