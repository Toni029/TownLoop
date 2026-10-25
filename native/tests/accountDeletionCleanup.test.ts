import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
function fixture() {
 let onAuth:(user:any)=>void=()=>{},onProfile:(value:any)=>void=()=>{},reloadError:string|undefined;
 const cleared:string[]=[],signedOut:string[]=[];
 const auth={currentUser:{uid:'alice'} as any};
 const exports:any={};const source=ts.transpileModule(readFileSync(new URL('../src/lib/session.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const modules:Record<string,any>={
  react:{createContext:()=>({Provider:'Provider'}),useContext:()=>null,useEffect:(fn:any)=>fn(),useState:(initial:any)=>[initial,()=>{}]},
  'react/jsx-runtime':{jsx:()=>null},
  'react-native':{AppState:{addEventListener:()=>({remove(){}})}},
  'firebase/auth':{onAuthStateChanged:(_a:any,fn:any)=>{onAuth=fn;return()=>{};},reload:async()=>{if(reloadError)throw {code:reloadError};},signOut:async()=>{signedOut.push(auth.currentUser.uid);auth.currentUser=null;}},
  'firebase/firestore':{doc:()=>({}),onSnapshot:(_r:any,fn:any)=>{onProfile=fn;return()=>{};}},
  './firebase':{auth,db:{}},'./accountDeletion':{clearDeletedAccountCaches:async(uid:string)=>{cleared.push(uid);},retryPendingAccountCleanup:async()=>{}},
  '../../../src/services/registrationRecovery':{MISSING_REGISTRATION_MESSAGE:'missing'},'./profile':{readProfile:(x:any)=>x,friendlyError:()=> 'error'},
 };
 vm.runInNewContext(source,{exports,require:(name:string)=>modules[name]});exports.SessionProvider({children:null});
 return {auth,cleared,signedOut,start:()=>onAuth(auth.currentUser),fail:(code:string)=>{reloadError=code;},snapshot:(cached:boolean)=>onProfile({exists:()=>true,metadata:{fromCache:cached},data:()=>({deletionPending:true})})};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('cached deletion flags and ordinary auth errors never erase medications',async()=>{
 for(const code of ['auth/network-request-failed','auth/user-token-expired']){
  const h=fixture();h.fail(code);h.start();h.snapshot(true);await tick();assert.deepEqual(h.cleared,[]);
 }
});
test('authoritative processing flag clears only the confirmed account and signs it out',async()=>{
 const h=fixture();h.start();h.snapshot(false);await tick();assert.deepEqual(h.cleared,['alice']);assert.deepEqual(h.signedOut,['alice']);
});
test('verified missing Auth identity clears that account without signing out a newly switched account',async()=>{
 const h=fixture();h.fail('auth/user-not-found');h.start();h.auth.currentUser={uid:'bob'};await tick();assert.deepEqual(h.cleared,['alice']);assert.deepEqual(h.signedOut,[]);
});

test('server-confirmed disabled identity clears only its own account after reconnect',async()=>{
 const h=fixture();h.fail('auth/user-disabled');h.start();h.auth.currentUser={uid:'bob'};await tick();assert.deepEqual(h.cleared,['alice']);assert.deepEqual(h.signedOut,[]);
});
