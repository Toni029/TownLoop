import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const ts=createRequire(import.meta.url)('typescript');
function fixture(provider='password'){
 let cursor=0;const state:any[]=[],calls:any[]=[];
 const jsx=(type:any,props:any)=>({type,props});
 const modules:Record<string,any>={
  react:{useEffect:()=>{},useState:(initial:any)=>{const i=cursor++;if(!(i in state))state[i]=initial;return [state[i],(v:any)=>{state[i]=typeof v==='function'?v(state[i]):v;}];}},
  'react/jsx-runtime':{jsx,jsxs:jsx},
  'react-native':{ActivityIndicator:'Spinner',Pressable:'Button',Text:'Text',View:'View',StyleSheet:{create:(s:any)=>s}},
  '../keyboard/KeyboardScrollView':{TextInput:'Input'},'lucide-react-native':{Trash2:'Trash',ChevronRight:'Chevron'},'../motion/Pressable':{MotionPressable:'Button'},
  '../lib/firebase':{auth:{currentUser:{uid:'fixture',providerData:[{providerId:provider}]}}},
  '../lib/accountDeletion':{requestAccountDeletion:async(...args:any[])=>{calls.push(args);return {status:'requested',jobId:'fixture'};},getAccountDeletionStatus:async()=>({status:'none'}),deletionStatusText:()=> 'Awaiting Admin/VIP review.'},
 };
 const exports:any={};
 vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/profile/AccountDeletion.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:(id:string)=>{assert.ok(id in modules,id);return modules[id];}});
 return {api:exports,calls,render:()=>{cursor=0;return exports.AccountDeletion();}};
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
 assert.ok(source.includes('{view === "accountDeletion" && <AccountDeletion />}'));
});
test('concise confirmation preserves required password verification and exact DELETE gating',async()=>{
 const f=fixture();let tree=f.render();
 assert.ok(nodes(tree).includes('Type DELETE below to confirm your request.'));
 assert.ok(nodes(tree).includes('Your account will not be deleted immediately. Your request will be reviewed.'));
 assert.equal(submit(tree).props.disabled,true);
 const label='Type DELETE to confirm the deletion request';
 assert.equal(input(tree,label).props.placeholder,'DELETE');
 assert.ok(input(tree,'Current password'));
 for(const value of ['delete','DELETE ','DELET']){input(tree,label).props.onChangeText(value);tree=f.render();assert.equal(submit(tree).props.disabled,true);}
 input(tree,'Current password').props.onChangeText('fixture-password');input(tree,label).props.onChangeText('DELETE');tree=f.render();
 assert.equal(submit(tree).props.disabled,false);
 submit(tree).props.onPress();await new Promise<void>(resolve=>setImmediate(resolve));
 assert.equal(f.calls.length,1);assert.deepEqual(f.calls[0],['fixture-password','DELETE']);
 tree=f.render();assert.equal(submit(tree),undefined);
 assert.ok(nodes(tree).includes('Awaiting Admin/VIP review.'));
 assert.ok(nodes(tree).some(n=>n.props?.accessibilityLabel==='Refresh deletion request status'));
});
test('Google accounts retain backend-driven reauthentication without a redundant password field',()=>{
 const f=fixture('google.com');assert.equal(input(f.render(),'Current password'),undefined);
 const source=readFileSync(new URL('../src/lib/accountDeletion.ts',import.meta.url),'utf8');
 assert.ok(source.includes('await reauthenticateDeletionGoogle()'));assert.ok(source.includes('requestOnly: true'));
});
