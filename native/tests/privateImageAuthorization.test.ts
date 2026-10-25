import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as references from '../../src/services/storageReferences.ts';
function fixture(status=200){
 const requests:any[]=[],removed:string[]=[],errors:string[]=[];let callback:(u:any)=>Promise<void>=async()=>{},cleanup=()=>{};
 const auth={currentUser:{uid:'alice',isAnonymous:false,getIdToken:async()=> 'test-session-token'} as any};
 const code=ts.transpileModule(readFileSync(new URL('../src/components/PrivateImage.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const module={exports:{} as any};
 const modules:Record<string,any>={react:{useState:()=>[null,()=>{}],useEffect:(f:any)=>{cleanup=f();}},'react/jsx-runtime':{jsx:()=>null},'react-native':{Image:'Image',Platform:{OS:'android'}},'firebase/auth':{onIdTokenChanged:(_a:any,f:any)=>{callback=f;return()=>{};}},'firebase/storage':{ref:()=>({bucket:'demo.firebasestorage.app'})},'expo-file-system/legacy':{cacheDirectory:'file:///cache/',downloadAsync:async(url:string,path:string,options:any)=>{requests.push({url,path,options});return {status,uri:path};},deleteAsync:async(path:string)=>{removed.push(path);}},'../lib/firebase':{auth,storage:{}},'../../../src/services/storageReferences':references,'../localData/privateMediaCache':{accountMediaPrefix:()=> 'townloop-private-5_alice-'}};
 vm.runInNewContext(code,{module,exports:module.exports,require:(name:string)=>{if(!(name in modules))throw Error(name);return modules[name];}});
 module.exports.PrivateImage({source:{uri:'https://firebasestorage.googleapis.com/v0/b/demo.firebasestorage.app/o/marketplace%2Fphoto.jpg?alt=media&token=old-bearer'},onError:()=>errors.push('failed')});
 return {requests,removed,errors,auth,load:()=>callback(auth.currentUser),cleanup:()=>cleanup()};
}
test('private Marketplace image uses Firebase session and never forwards a legacy bearer token',async()=>{
 const h=fixture();await h.load();assert.equal(h.requests.length,1);assert.ok(h.requests[0].options.headers.Authorization.startsWith('Firebase '));assert.ok(!h.requests[0].url.includes('token='));h.cleanup();assert.equal(h.removed.length,1);
});
test('denied private image fails closed and deletes temporary cache, never retries token URL',async()=>{
 const h=fixture(403);await h.load();assert.equal(h.requests.length,1);assert.equal(h.errors.length,1);assert.equal(h.removed.length,1);
});
test('anonymous session cannot request private media',async()=>{
 const h=fixture();h.auth.currentUser.isAnonymous=true;await h.load();assert.equal(h.requests.length,0);
});
