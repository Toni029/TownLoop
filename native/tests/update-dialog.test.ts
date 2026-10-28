import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {updateStatus} from '../src/development/updateStatus.ts';
const idle={isUpdatePending:false,isChecking:false,isDownloading:false,isStartupProcedureRunning:false,isUpdateAvailable:false};
function fixture(initial:any,platform='android'){
 let cursor=0,state={...idle,...initial},reloads=0,downloads=0,failRestart=false;
 const slots:any[]=[],effects:Array<()=>void>=[],listeners:Record<string,Function>={},exports:any={};const jsx=(type:any,props:any)=>({type,props});
 const react={useState:(initial:any)=>{const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],(v:any)=>slots[i]=typeof v==='function'?v(slots[i]):v];},useRef:(value:any)=>{const i=cursor++;return slots[i]||(slots[i]={current:value});},useEffect:(fn:any,deps:any[])=>{const i=cursor++,old=slots[i];if(!old||deps.some((v:any,j:number)=>v!==old.deps[j]))effects.push(()=>{old?.cleanup?.();slots[i]={deps,cleanup:fn()};});}};
 const native={Platform:{OS:platform},Modal:'Modal',View:'View',Text:'Text',Pressable:'Pressable',ScrollView:'ScrollView',ActivityIndicator:'Spinner',Keyboard:{addListener:(key:string,fn:Function)=>{listeners[key]=fn;return{remove(){delete listeners[key];}};}},BackHandler:{addEventListener:(key:string,fn:Function)=>{listeners[key]=fn;return{remove(){delete listeners[key];}};}},Animated:{View:'AnimatedView',Value:class{setValue(){}interpolate(){return 0;}},timing:()=>({start(){},stop(){}}),loop:()=>({start(){},stop(){}})}};
 const modules:any={'react':react,'react/jsx-runtime':{jsx,jsxs:jsx},'react-native':native,'@react-native-async-storage/async-storage':{default:{getItem:async()=>null,setItem:async()=>{}}},'expo-updates':{isEnabled:true,isEmbeddedLaunch:true,useUpdates:()=>state,reloadAsync:async()=>{reloads++;if(failRestart)throw Error('fixture');},checkForUpdateAsync:async()=>({isAvailable:true}),fetchUpdateAsync:async()=>{downloads++;}},'react-native-safe-area-context':{useSafeAreaInsets:()=>({top:0,bottom:0})},'./updateStatus':{updateStatus},'../home/hooks':{useReducedMotion:()=>false},'../motion/Pressable':{MotionPressable:'Pressable'},'lucide-react-native':new Proxy({},{get:(_,name)=>String(name)})};
 const source=readFileSync(new URL('../src/development/PreviewUpdateNotice.tsx',import.meta.url),'utf8');
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports,__DEV__:false,require:(name:string)=>{if(!(name in modules))throw Error(name);return modules[name];}});
 return {render(){cursor=0;const wrapper=exports.PreviewUpdateNotice({});const tree=wrapper?.type(wrapper.props);effects.splice(0).forEach(fn=>fn());return tree;},set:(patch:any)=>state={...state,...patch},back:()=>listeners.hardwareBackPress?.(),keyboard:(show:boolean)=>listeners[show?'keyboardDidShow':'keyboardDidHide']?.(),counts:()=>({reloads,downloads}),fail:()=>failRestart=true};
}
function nodes(n:any):any[]{if(n==null||typeof n==='boolean')return[];if(Array.isArray(n))return n.flatMap(nodes);return[n,...nodes(n.props?.children)];}
const button=(tree:any,label:string)=>nodes(tree).find(n=>n.type==='Pressable'&&n.props.accessibilityLabel===label);
const settle=()=>new Promise<void>(resolve=>setImmediate(resolve));
test('ready update is one centered dialog with a full-width green action, no second alert; repeated presses restart once',async()=>{
 const f=fixture({isUpdatePending:true});const tree=f.render();assert.equal(tree.type,'AnimatedView');assert.equal(tree.props.style.justifyContent,'center');assert.equal(tree.props.style.position,'absolute');
 const action=button(tree,'Restart to apply update');assert(action);assert.equal(action.props.style.width,'100%');assert.equal(action.props.style.backgroundColor,'#047857');
 action.props.onPress();action.props.onPress();await settle();assert.equal(f.counts().reloads,1);
});
test('Later dismisses the whole update flow for the session without reloading or interrupting download',()=>{
 const f=fixture({isUpdateAvailable:true,availableUpdate:{updateId:'same'}});let tree=f.render();button(tree,'Update later').props.onPress();
 f.set({isUpdatePending:true,downloadedUpdate:{updateId:'same'}});assert.equal(f.render(),null);assert.deepEqual(f.counts(),{reloads:0,downloads:0});
});
test('download progress comes from Expo, unavailable progress is indeterminate, idle startup checks do not open a dialog',()=>{
 const f=fixture({isChecking:true});assert.equal(f.render(),null);f.set({isChecking:false,isDownloading:true,downloadProgress:.427});
 let tree=f.render();const progress=nodes(tree).find(n=>n.type?.name==='DownloadProgress');assert.equal(progress.props.percent,42);
 f.set({downloadProgress:undefined});tree=f.render();assert.equal(nodes(tree).find(n=>n.type?.name==='DownloadProgress').props.percent,null);
});
test('failed restart preserves the downloaded update and exposes a retry instead of trapping the user',async()=>{
 const f=fixture({isUpdatePending:true});f.fail();button(f.render(),'Restart to apply update').props.onPress();await settle();
 const tree=f.render();assert.equal(button(tree,'Restart to apply update').props.disabled,false);assert(nodes(tree).some(n=>typeof n==='string'&&n.includes('Unable to restart')));assert(button(tree,'Update later'));
});

test('Android Back defers safely; an open keyboard postpones the card without losing update state',()=>{
 const f=fixture({isUpdatePending:true});f.render();f.keyboard(true);assert.equal(f.render(),null);f.keyboard(false);assert(button(f.render(),'Restart to apply update'));
 assert.equal(f.back(),true);assert.equal(f.render(),null);assert.equal(f.counts().reloads,0);
});
test('download action is guarded against repeated presses, and Later never forces a restart',async()=>{
 const f=fixture({isUpdateAvailable:true});const action=button(f.render(),'Download update');action.props.onPress();action.props.onPress();await settle();assert.equal(f.counts().downloads,1);assert.equal(f.counts().reloads,0);
});

test('iPhone uses the same centered card and full-width action without a second OS alert',()=>{
 const f=fixture({isUpdatePending:true},'ios');const tree=f.render();assert.equal(tree.type,'AnimatedView');assert.equal(tree.props.style.alignItems,'center');assert.equal(button(tree,'Restart to apply update').props.style.width,'100%');
});
