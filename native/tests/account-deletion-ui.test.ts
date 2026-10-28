import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {validDeletionConfirmation} from '../src/profile/deletionConfirmation.ts';
const ts=createRequire(import.meta.url)('typescript');
function fixture(provider='password',failure=false){
 let cursor=0;const state:any[]=[],calls:any[]=[];let effectsStarted=false;const effects:Array<()=>void>=[];
 const jsx=(type:any,props:any)=>({type,props});
 const modules:Record<string,any>={
  react:{useEffect:(fn:()=>void)=>{if(!effectsStarted)effects.push(fn);},useRef:(v:any)=>{const i=cursor++;return state[i]||(state[i]={current:v});},useState:(initial:any)=>{const i=cursor++;if(!(i in state))state[i]=initial;return [state[i],(v:any)=>{state[i]=typeof v==='function'?v(state[i]):v;}];}},
  'react/jsx-runtime':{jsx,jsxs:jsx},
  'react-native':{ActivityIndicator:'Spinner',Pressable:'Button',Text:'Text',View:'View',StyleSheet:{create:(s:any)=>s}},
  '../keyboard/KeyboardScrollView':{TextInput:'Input'},'lucide-react-native':{Trash2:'Trash',ChevronRight:'Chevron'},'../motion/Pressable':{MotionPressable:'Button'},
  './DeletionRequestSuccess':{DeletionRequestSuccess:'Success'},'./deletionConfirmation':{validDeletionConfirmation},
  '../lib/firebase':{auth:{currentUser:{uid:'fixture',providerData:[{providerId:provider}]}}},
  '../lib/accountDeletion':{requestAccountDeletion:async(...args:any[])=>{calls.push(args);if(failure)throw Error('Request could not be submitted');return {status:'requested',jobId:'fixture'};},getAccountDeletionStatus:async()=>({status:'none'}),deletionStatusText:()=> 'Awaiting Admin/VIP review.'},
 };
 const exports:any={};
 vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/profile/AccountDeletion.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Error,require:(id:string)=>{assert.ok(id in modules,id);return modules[id];}});
 return {api:exports,calls,render:()=>{cursor=0;const tree=exports.AccountDeletion({onDone:()=>calls.push(['done'])});if(!effectsStarted){effectsStarted=true;effects.forEach(fn=>fn());}return tree;}};
}
function nodes(n:any):any[]{if(n==null||typeof n==='boolean')return [];if(Array.isArray(n))return n.flatMap(nodes);return typeof n==='object'?[n,...nodes(n.props?.children)]:[n];}
const input=(tree:any,label:string)=>nodes(tree).find(n=>n.type==='Input'&&n.props.accessibilityLabel===label);
const submit=(tree:any)=>nodes(tree).find(n=>n.type==='Button'&&n.props.accessibilityLabel==='Submit Deletion Request');
test('Edit Profile entry contains only red trash, bold request label and chevron with its navigation action',()=>{
 const f=fixture();let opened=0;const entry=f.api.AccountDeletionButton({onPress:()=>opened++}),tree=nodes(entry);
 assert.deepEqual(tree.filter(n=>typeof n==='string'),['Request Account Deletion']);
 assert.ok(tree.some(n=>n.type==='Trash'));assert.ok(tree.some(n=>n.type==='Chevron'));
 entry.props.onPress();assert.equal(opened,1);
 const source=readFileSync(new URL('../src/profile/ProfileMenu.tsx',import.meta.url),'utf8');
 assert.ok(source.includes('<AccountDeletionButton onPress={() => go("accountDeletion")} />'));
 assert.ok(source.includes('{view === "accountDeletion" && <AccountDeletion onDone={back} />}'));
});
const settle=()=>new Promise<void>(resolve=>setImmediate(resolve));
const verify=(tree:any)=>nodes(tree).find(n=>n.type==='Button'&&n.props.accessibilityLabel==='Verify and submit request');
test('one case-insensitive confirmation field leads to a separate mandatory password-verification step',async()=>{
 const f=fixture();f.render();await settle();let tree=f.render();
 assert.equal(nodes(tree).filter(n=>n.type==='Input').length,1);
 assert.equal(input(tree,'Current password'),undefined);
 assert.equal(submit(tree).props.disabled,true);
 const label='Type DELETE to confirm the deletion request';
 assert.equal(input(tree,label).props.placeholder,'Type DELETE here');
 for(const value of ['DELET','delete now','delete delete']){input(tree,label).props.onChangeText(value);tree=f.render();assert.equal(submit(tree).props.disabled,true);}
 for(const value of ['DELETE','delete','Delete','DeLeTe','dElEtE','  delete  ']){input(tree,label).props.onChangeText(value);tree=f.render();assert.equal(submit(tree).props.disabled,false);}
 submit(tree).props.onPress();tree=f.render();assert.equal(f.calls.length,0);
 assert.equal(nodes(tree).filter(n=>n.type==='Input').length,1);
 assert.ok(input(tree,'Current password'));assert.equal(input(tree,label),undefined);
 assert.equal(verify(tree).props.disabled,true);
 input(tree,'Current password').props.onChangeText('fixture-password');tree=f.render();
 const button=verify(tree);button.props.onPress();button.props.onPress();await settle();
 assert.equal(f.calls.length,1);assert.deepEqual(f.calls[0],['fixture-password','  delete  ']);
 tree=f.render();assert.equal(tree.type,'Success');tree.props.onDone();assert.deepEqual(f.calls.at(-1),['done']);
});
test('Google reauthentication stays in the secure request function and failure never shows farewell',async()=>{
 const f=fixture('google.com',true);f.render();await settle();let tree=f.render();
 assert.equal(input(tree,'Current password'),undefined);
 input(tree,'Type DELETE to confirm the deletion request').props.onChangeText('delete');tree=f.render();submit(tree).props.onPress();await settle();
 tree=f.render();assert.notEqual(tree.type,'Success');assert.ok(nodes(tree).includes('Request could not be submitted'));
 assert.equal(submit(tree).props.disabled,false);
 const source=readFileSync(new URL('../src/lib/accountDeletion.ts',import.meta.url),'utf8');
 assert.ok(source.includes('await reauthenticateDeletionGoogle()'));assert.ok(source.includes("confirmation: 'DELETE', requestOnly: true"));
});

test('native request normalizes confirmation for the deployed server while retaining reauthentication and request-only payloads',async()=>{
 const calls:any[]=[];const user={uid:'fixture',email:'fixture@example.invalid',providerData:[{providerId:'password'}],getIdToken:async()=>calls.push('token')};
 const modules:Record<string,any>={
  '../profile/deletionConfirmation':{validDeletionConfirmation},'../notifications/device':{},'../localData/privateMediaCache':{},'@react-native-async-storage/async-storage':{},
  'firebase/auth':{EmailAuthProvider:{credential:()=>({})},reauthenticateWithCredential:async()=>calls.push('reauth')},
  'firebase/functions':{getFunctions:()=>({}),httpsCallable:()=>async(payload:any)=>{calls.push(payload);return {data:{status:'requested',jobId:'fixture'}};}},
  '../localData/accountCleanupQueue':{createAccountCleanupQueue:()=>({})},'../localData/nativeStorage':{},'./firebase':{auth:{currentUser:user},app:{}},'./accountDeletionGoogle':{},
 };
 const exports:any={};vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/lib/accountDeletion.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Error,require:(id:string)=>{assert.ok(id in modules,id);return modules[id];}});
 for(const confirmation of ['DELETE','delete','DeLeTe','  Delete  ']){
  calls.length=0;await exports.requestAccountDeletion('fixture-password',confirmation);
  assert.equal(calls[0],'reauth');assert.equal(calls[1],'token');
  assert.equal(calls[2].confirmation,'DELETE');assert.equal(calls[2].requestOnly,true);
 }
 calls.length=0;await assert.rejects(exports.requestAccountDeletion('fixture-password','delete now'),/Type DELETE/);assert.equal(calls.length,0);
 await assert.rejects(exports.requestAccountDeletion('','delete'),/password/);
});

function successFixture(reduced=false){
 let cursor=0;const state:any[]=[],effects:Array<()=>void>=[],timers:Array<()=>void>=[];let mounted=false,complete:()=>void=()=>{},duration=0;
 class Value{constructor(_:number){}setValue(_:number){}interpolate(_:any){return 0;}}
 const jsx=(type:any,props:any)=>({type,props});
 const modules:Record<string,any>={react:{useRef:(v:any)=>{const i=cursor++;return state[i]||(state[i]={current:v});},useState:(v:any)=>{const i=cursor++;if(!(i in state))state[i]=v;return [state[i],(next:any)=>state[i]=next];},useEffect:(fn:()=>void)=>{if(!mounted)effects.push(fn);}},
 'react/jsx-runtime':{jsx,jsxs:jsx},'react-native':{View:'View',Text:'Text',StyleSheet:{create:(s:any)=>s},Easing:{inOut:(v:any)=>v,cubic:0},Animated:{Value,View:'Animated',timing:(_:any,config:any)=>{duration=config.duration;return {start:(cb:any)=>{complete=()=>cb({finished:true});},stop:()=>{}};}}},
 'lucide-react-native':{Check:'Check',Trash2:'Trash',UserRound:'User'},'../motion/Pressable':{MotionPressable:'Button'},'../home/hooks':{useReducedMotion:()=>reduced}};
 const exports:any={};vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/profile/DeletionRequestSuccess.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:(id:string)=>modules[id],setTimeout:(fn:()=>void)=>{timers.push(fn);return 1;},clearTimeout:()=>{}});
 return {render:()=>{cursor=0;const tree=exports.DeletionRequestSuccess({onDone:()=>{}});if(!mounted){mounted=true;effects.forEach(fn=>fn());}return tree;},finish:()=>complete(),timers,duration:()=>duration};
}
test('farewell waits for animation completion; reduced motion and a lost completion callback still expose Done',()=>{
 const animated=successFixture();let tree=animated.render();assert.ok(!nodes(tree).includes('Done'));
 assert.ok(animated.duration()>=1500&&animated.duration()<=2500);
 animated.finish();tree=animated.render();assert.ok(nodes(tree).includes('Done'));assert.ok(nodes(tree).includes('Request submitted · Awaiting review'));
 const reduced=successFixture(true);reduced.render();assert.ok(nodes(reduced.render()).includes('Done'));assert.equal(reduced.duration(),0);
 const interrupted=successFixture();interrupted.render();interrupted.timers[0]();assert.ok(nodes(interrupted.render()).includes('Done'));
});
