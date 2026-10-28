import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const ts=createRequire(import.meta.url)('typescript');
const element=(type:any,props:any)=>({type,props});
function load(path:string,mocks:Record<string,unknown>){
  const source=readFileSync(new URL(path,import.meta.url),'utf8');
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const exports:any={};
  vm.runInNewContext(code,{exports,require:(name:string)=>{
    if(name==='react/jsx-runtime')return {jsx:element,jsxs:element};
    if(name in mocks)return mocks[name];
    throw new Error(`Unexpected dependency: ${name}`);
  }});
  return exports;
}
function renderTree(node:any):any[]{
  if(node==null||typeof node==='boolean')return [];
  if(Array.isArray(node))return node.flatMap(renderTree);
  if(typeof node!=='object')return [node];
  if(typeof node.type==='function')return renderTree(node.type(node.props));
  return [node,...renderTree(node.props?.children)];
}
const view=load('../src/components/PendingApprovalView.tsx',{
  'react-native':{Image:'Image',ScrollView:'ScrollView',Text:'Text',View:'View',StyleSheet:{create:(x:any)=>x},useWindowDimensions:()=>({width:320,height:568})},
  'react-native-safe-area-context':{SafeAreaView:'SafeAreaView',useSafeAreaInsets:()=>({left:0,right:0,bottom:0,top:0})},
  'lucide-react-native':Object.fromEntries(['Check','Clock3','Info','LogOut','RefreshCw','Users'].map(x=>[x,x])),
  '../motion/Pressable':{MotionPressable:'Button'},
  '../../assets/approval/approved-reference.png':1,
});
test('pending view shows truthful approval stages and check-back copy with accessible working actions',()=>{
  let retried=0,signedOut=0;
  const tree=renderTree(view.PendingApprovalView({retry:()=>retried++,onSignOut:()=>signedOut++}));
  assert.ok(tree.some(n=>n.type==='ScrollView'));
  assert.ok(tree.some(n=>n.props?.accessibilityLabel==='Information submitted: completed. Awaiting approval: current. Access granted: pending.'));
  assert.ok(tree.includes('Please check back later.'));
  assert.ok(tree.includes('Your account is awaiting approval from your community office. You can return to TownLoop anytime to check your status.'));
  const buttons=tree.filter(n=>n.type==='Button');
  assert.deepEqual(buttons.map(n=>n.props.accessibilityLabel),['Try again','Sign Out']);
  buttons.forEach(n=>n.props.onPress());
  assert.equal(retried,1);assert.equal(signedOut,1);
});
test('account errors remain visible without falsely indicating pending approval',()=>{
  const tree=renderTree(view.PendingApprovalView({error:'Profile unavailable',retry:()=>{},onSignOut:()=>{}}));
  assert.ok(tree.includes('Unable to load your account'));
  assert.ok(tree.includes('Profile unavailable'));
  assert.ok(!tree.includes('Please check back later.'));
  assert.ok(!tree.some(n=>n.props?.accessibilityLabel?.includes('completed.')));
});
test('route retains existing session retry and Firebase sign-out wiring',()=>{
  const auth={fixture:true},retry=()=>{},calls:any[]=[];
  const route=load('../src/app/pending.tsx',{
    'firebase/auth':{signOut:(a:any)=>calls.push(a)},
    '../lib/firebase':{auth},'../lib/session':{useSession:()=>({retry,error:null})},
    '../components/PendingApprovalView':{PendingApprovalView:'PendingView'},
  }).default();
  assert.equal(route.props.retry,retry);
  assert.equal(route.props.error,null);
  route.props.onSignOut();assert.deepEqual(calls,[auth]);
});
