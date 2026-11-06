import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import {
  canUseDatabaseCleanup, canConfirmCleanup, readCleanupJob, cleanupOutcome, toggleCleanupCategory,
} from '../src/profile/databaseCleanupModel.ts';

const counts = {records:2,documents:5,deleted:0,held:0,failed:0,remaining:5,storageDeleted:0,storageHeld:0};
const job = (patch: Record<string, unknown> = {}) => ({id:'job-1',state:'review',categories:['workOrders'],counts:{workOrders:counts},planHash:'plan-1',confirmationPhrase:'DELETE SELECTED DATA',enabled:true,completeInventory:true,...patch});

test('only explicitly approved canonical admins can access cleanup', () => {
  for (const profile of [null, {role:'vip',approved:true}, {role:'ADMIN',approved:true}, {role:'admin',approved:false}, {role:'admin'}, {role:'admin',approved:true,deletionPending:true}, {email:'master@example.invalid',role:'resident',approved:true}]) {
    assert.equal(canUseDatabaseCleanup(profile), false);
  }
  assert.equal(canUseDatabaseCleanup({role:'admin',approved:true}), true);
});

test('categories toggle independently without selecting another category', () => {
  let selected: any[] = [];
  selected = toggleCleanupCategory(selected, 'newsletters');
  assert.deepEqual(selected, ['newsletters']);
  selected = toggleCleanupCategory(selected, 'workOrders');
  assert.deepEqual(selected, ['workOrders', 'newsletters']);
  assert.deepEqual(toggleCleanupCategory(selected, 'newsletters'), ['workOrders']);
});

test('destructive confirmation requires full inventory, reviewed plan and exact untrimmed phrase', () => {
  const reviewed = readCleanupJob(job());
  assert.equal(canConfirmCleanup(reviewed, 'DELETE SELECTED DATA', false), true);
  for (const phrase of ['', 'delete selected data', ' DELETE SELECTED DATA', 'DELETE SELECTED DATA ']) {
    assert.equal(canConfirmCleanup(reviewed, phrase, false), false);
  }
  for (const patch of [{state:'planning'}, {enabled:false}, {completeInventory:false}, {planHash:undefined}]) {
    assert.equal(canConfirmCleanup(readCleanupJob(job(patch)), 'DELETE SELECTED DATA', false), false);
  }
  assert.equal(canConfirmCleanup(reviewed, 'DELETE SELECTED DATA', true), false);
});

test('malformed or incomplete server jobs fail safely before confirmation', () => {
  for (const invalid of [null, {}, job({categories:['users']}), job({categories:[]}), job({counts:{}}), job({counts:{workOrders:{...counts,documents:-1}}}), job({confirmationPhrase:'DELETE EVERYTHING'}), job({enabled:undefined}), job({state:'done'})]) {
    assert.throws(() => readCleanupJob(invalid), /verify|invalid/i);
  }
});

test('completion with holds explains retained data and never promises a full deletion', () => {
  assert.match(cleanupOutcome(readCleanupJob(job({state:'completed_with_holds'}))), /protected.*remain/i);
  assert.match(cleanupOutcome(readCleanupJob(job({state:'failed'}))), /failed/i);
  assert.match(cleanupOutcome(readCleanupJob(job({state:'cancelled'}))), /already deleted.*restored/i);
});

const require = createRequire(import.meta.url), ts = require('typescript');
function loadClient(response: unknown, failure?: unknown) {
  const calls: any[] = [];
  const module = {exports:{} as any};
  const source = ts.transpileModule(readFileSync(new URL('../src/lib/databaseCleanup.ts',import.meta.url),'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(source,{module,exports:module.exports,Error,require:(name:string) => {
    if(name==='firebase/functions') return {getFunctions:(_app:any,region:string)=>{assert.equal(region,'us-central1');return {};},httpsCallable:(_functions:any,name:string)=>async(input:any)=>{calls.push({name,input});if(failure)throw failure;return {data:response};}};
    if(name==='./firebase')return {app:{},auth:{currentUser:{uid:'admin'}}};
    if(name==='../profile/databaseCleanupModel')return {readCleanupJob};
    throw Error(`Unexpected module ${name}`);
  }});
  return {api:module.exports,calls};
}

test('client targets the single callable and validates its direct job response', async () => {
  const {api,calls}=loadClient(job());
  const result=await api.manageDatabaseCleanup({action:'preview',categories:['workOrders'],requestId:'stable-id'});
  assert.equal(result.id,'job-1');
  assert.deepEqual(JSON.parse(JSON.stringify(calls)),[{name:'manageDatabaseCleanup',input:{action:'preview',categories:['workOrders'],requestId:'stable-id'}}]);
  await assert.rejects(loadClient({}).api.manageDatabaseCleanup({action:'status',jobId:'job-1'}), /verify|invalid/i);
});

test('missing backend gives a useful service-pending error', async () => {
  const {api}=loadClient(null,{code:'functions/not-found'});
  await assert.rejects(api.manageDatabaseCleanup({action:'preview',categories:['workOrders'],requestId:'stable-id'}), /service.*pending|service.*setup/i);
});

function loadNative(file:string, modules:Record<string,unknown>, extra:Record<string,unknown>={}) {
  const module={exports:{} as any};
  const source=ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInNewContext(source,{module,exports:module.exports,Error,Set,...extra,require:(name:string)=>{assert.ok(name in modules,`Unexpected dependency ${name}`);return modules[name];}});
  return module.exports;
}

function nativeScreen(controllerPatch:Record<string,unknown>={}, dark=false) {
  const calls:string[]=[];
  const controller={allowed:true,selected:[],job:null,busy:false,error:'',phrase:'',step:'inventory',needsStatus:false,
    toggle:(key:string)=>calls.push(key),preview:()=>calls.push('preview'),setPhrase:()=>{},showConfirmation:()=>calls.push('review'),backToInventory:()=>{},
    confirm:()=>calls.push('confirm'),refresh:()=>{},resume:()=>{},cancel:()=>{},newSelection:()=>{},...controllerPatch};
  const jsx=(type:any,props:any)=>({type,props});
  const {DatabaseCleanup}=loadNative('../src/profile/DatabaseCleanup.tsx',{
    'react/jsx-runtime':{jsx,jsxs:jsx},'react-native':{View:'View',Text:'Text',Pressable:'Pressable',ActivityIndicator:'ActivityIndicator'},
    'lucide-react-native':{ShieldCheck:'ShieldCheck',Trash2:'Trash2',Check:'Check',AlertTriangle:'AlertTriangle',ChevronRight:'ChevronRight'},
    '../keyboard/KeyboardScrollView':{TextInput:'TextInput'},
    './databaseCleanupModel':require('../src/profile/databaseCleanupModel.ts'),
  });
  const tree=DatabaseCleanup({controller,dark});
  const all:any[]=[];
  function walk(node:any){if(!node||typeof node!=='object')return;all.push(node);for(const child of [node.props?.children].flat(Infinity))walk(child);}
  walk(tree);
  return {all,calls,text:JSON.stringify(tree)};
}

test('native screen begins with four unchecked accessible independent checkboxes and disabled preview',()=>{
  const screen=nativeScreen();
  const checks=screen.all.filter(node=>node.props.accessibilityRole==='checkbox');
  assert.equal(checks.length,4);
  assert.deepEqual(checks.map(node=>node.props.accessibilityLabel),[
    'All Work Orders','All Discussion Feed Posts','All Marketplace Listings','All Newsletters, including their RSVP Events and Pinned Highlights',
  ]);
  assert.ok(checks.every(node=>node.props.accessibilityState.checked===false));
  assert.equal(screen.all.find(node=>node.props.accessibilityLabel==='Preview selected data')?.props.disabled,true);
  checks[3].props.onPress();
  assert.deepEqual(screen.calls,['newsletters']);
  assert.equal(nativeScreen({allowed:false}).all.some(node=>node.props.accessibilityRole==='checkbox'),false);
});

test('inventory cannot delete; separate confirmation step repeats counts and enforces exact phrase',()=>{
  const reviewed=readCleanupJob(job());
  const inventory=nativeScreen({job:reviewed,selected:['workOrders']});
  assert.equal(inventory.all.some(node=>node.props.accessibilityLabel==='Delete selected data'),false);
  assert.ok(inventory.all.some(node=>node.props.accessibilityLabel==='Continue to confirmation'));
  const confirmation=nativeScreen({job:reviewed,step:'confirmation',selected:['workOrders'],phrase:'DELETE SELECTED DATA '},true);
  assert.match(confirmation.text,/All Work Orders/);
  assert.match(confirmation.text,/5 documents/);
  assert.equal(confirmation.all.find(node=>node.props.accessibilityLabel==='Delete selected data')?.props.disabled,true);
  const valid=nativeScreen({job:reviewed,step:'confirmation',selected:['workOrders'],phrase:'DELETE SELECTED DATA'});
  assert.equal(valid.all.find(node=>node.props.accessibilityLabel==='Delete selected data')?.props.disabled,false);
  assert.equal(nativeScreen({job:reviewed,step:'confirmation',phrase:'DELETE SELECTED DATA',needsStatus:true}).all.find(node=>node.props.accessibilityLabel==='Delete selected data')?.props.disabled,true);
});

function controllerFixture(handler:(input:any)=>Promise<any>) {
  let cursor=0, uuid=0, active=true, profile:any={id:'admin',role:'admin',approved:true};
  const slots:any[]=[], effects:(()=>void)[]=[], timers=new Map<number,()=>unknown>(), calls:any[]=[];
  let timerId=0, appListener:(state:string)=>void=()=>{};
  const model=require('../src/profile/databaseCleanupModel.ts');
  const {useDatabaseCleanup}=loadNative('../src/profile/useDatabaseCleanup.ts',{
    react:{
      useState:(initial:any)=>{const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],(value:any)=>{slots[i]=typeof value==='function'?value(slots[i]):value;}];},
      useRef:(initial:any)=>{const i=cursor++;if(!(i in slots))slots[i]={current:initial};return slots[i];},
      useEffect:(effect:()=>any,deps:any[])=>{const i=cursor++,previous=slots[i];if(!previous||deps.some((dep,j)=>!Object.is(dep,previous.deps[j])))effects.push(()=>{previous?.cleanup?.();slots[i]={deps,cleanup:effect()};});},
    },
    'react-native':{AppState:{currentState:'active',addEventListener:(_name:string,listener:any)=>{appListener=listener;return {remove:()=>{appListener=()=>{};}};}}},
    'expo-crypto':{randomUUID:()=>`request-${++uuid}`},
    '../lib/databaseCleanup':{manageDatabaseCleanup:async(input:any)=>{calls.push(input);return handler(input);}},
    './databaseCleanupModel':model,
  },{setTimeout:(callback:()=>unknown,delay:number)=>{assert.equal(delay,4000);const id=++timerId;timers.set(id,callback);return id;},clearTimeout:(id:number)=>timers.delete(id)});
  const render=()=>{cursor=0;const result=useDatabaseCleanup(profile,active);effects.splice(0).forEach(effect=>effect());return result;};
  return {render,calls,timers,setActive:(next:boolean)=>{active=next;},setProfile:(next:any)=>{profile=next;},appState:(state:string)=>appListener(state),unmount:()=>{for(const slot of slots)slot?.cleanup?.();}};
}

test('preview retries retain one request ID and no action runs without category selection',async()=>{
  let fail=true;
  const f=controllerFixture(async()=>{if(fail)throw Error('offline');return readCleanupJob(job());});
  await f.render().preview();assert.equal(f.calls.length,0);
  f.render().toggle('workOrders');
  await f.render().preview();
  await f.render().preview();
  assert.equal(f.calls.length,2);
  assert.equal(f.calls[0].requestId,f.calls[1].requestId);
  assert.equal(f.calls[0].action,'preview');
  fail=false;await f.render().preview();
  assert.equal(f.render().job.id,'job-1');
  assert.ok(f.calls.every(input=>input.action==='preview'));
});

test('polling stops off tab, in background and on unmount; foreground never resumes execution',async()=>{
  const f=controllerFixture(async()=>readCleanupJob(job({state:'running'})));
  f.render().toggle('workOrders');await f.render().preview();f.render();
  assert.equal(f.timers.size,1);
  f.setActive(false);f.render();assert.equal(f.timers.size,0);
  f.setActive(true);f.render();assert.equal(f.timers.size,1);
  f.appState('background');f.render();assert.equal(f.timers.size,0);
  f.appState('active');f.render();assert.equal(f.timers.size,1);
  const [id,callback]=[...f.timers.entries()][0];f.timers.delete(id);await callback();f.render();
  assert.deepEqual(f.calls.map(input=>input.action),['preview','status']);
  f.unmount();assert.equal(f.timers.size,0);
});

test('overlapping operations are blocked and uncertain confirmation must refresh status before retry',async()=>{
  let release:((value:any)=>void)|undefined, confirmationFailed=false;
  const f=controllerFixture(async input=>{
    if(input.action==='preview')return new Promise(resolve=>{release=resolve;});
    if(input.action==='confirm'){confirmationFailed=true;throw Error('response lost');}
    return readCleanupJob(job());
  });
  f.render().toggle('workOrders');const preview=f.render().preview();
  await f.render().preview();assert.equal(f.calls.length,1);
  release!(readCleanupJob(job()));await preview;
  await f.render().confirm();assert.equal(f.calls.length,1);
  f.render().showConfirmation();f.render().setPhrase('DELETE SELECTED DATA');
  await f.render().confirm();assert.equal(confirmationFailed,true);
  assert.equal(f.calls.at(-1).jobId,'job-1');
  assert.equal(f.calls.at(-1).planHash,'plan-1');
  assert.equal(f.calls.at(-1).confirmation,'DELETE SELECTED DATA');
  assert.equal(f.render().needsStatus,true);
  await f.render().confirm();assert.equal(f.calls.filter(input=>input.action==='confirm').length,1);
  await f.render().refresh();assert.equal(f.render().needsStatus,false);
  assert.equal(f.calls.at(-1).action,'status');
});

test('revoking admin access discards inventory and ignores an in-flight response',async()=>{
  let release:((value:any)=>void)|undefined;
  const f=controllerFixture(async()=>new Promise(resolve=>{release=resolve;}));
  f.render().toggle('workOrders');const pending=f.render().preview();
  f.setProfile({id:'admin',role:'vip',approved:true});f.render();
  release!(readCleanupJob(job()));await pending;
  assert.equal(f.render().allowed,false);
  assert.equal(f.render().job,null);
  assert.deepEqual(Array.from(f.render().selected),[]);
  await f.render().preview();assert.equal(f.calls.length,1);
});

test('failed and paused jobs are never automatically restarted; explicit resume and cancel target the retained job',async()=>{
  const f=controllerFixture(async input=>readCleanupJob(job({state:input.action==='cancel'?'cancelled':input.action==='resume'?'running':'failed'})));
  f.render().toggle('workOrders');await f.render().preview();f.render();
  assert.equal(f.timers.size,0);
  f.appState('background');f.render();f.appState('active');f.render();
  assert.deepEqual(f.calls.map(input=>input.action),['preview']);
  await f.render().resume();f.render();
  assert.equal(f.calls.at(-1).action,'resume');assert.equal(f.calls.at(-1).jobId,'job-1');
  await f.render().cancel();f.render();
  assert.equal(f.calls.at(-1).action,'cancel');assert.equal(f.render().job.state,'cancelled');
  assert.equal(f.timers.size,0);
});

test('disabled service and incomplete inventory never expose a usable confirmation action',()=>{
  for(const patch of [{enabled:false},{completeInventory:false}]) {
    const screen=nativeScreen({job:readCleanupJob(job(patch)),step:'confirmation',phrase:'DELETE SELECTED DATA'});
    assert.equal(screen.all.find(node=>node.props.accessibilityLabel==='Delete selected data')?.props.disabled,true);
  }
});

test('a changed reviewed plan invalidates the typed authorization before it can be sent',async()=>{
  const f=controllerFixture(async input=>readCleanupJob(job(input.action==='status'?{planHash:'plan-2',counts:{workOrders:{...counts,records:3,documents:7}}}:{})));
  f.render().toggle('workOrders');await f.render().preview();
  f.render().showConfirmation();f.render().setPhrase('DELETE SELECTED DATA');
  await f.render().refresh();
  assert.equal(f.render().job.planHash,'plan-2');
  assert.equal(f.render().job.counts.workOrders.documents,7);
  assert.equal(f.render().phrase,'');
  assert.equal(f.render().step,'inventory');
  await f.render().confirm();
  assert.deepEqual(f.calls.map(input=>input.action),['preview','status']);
});

test('disabled execution still polls read-only inventory and cancellation progress',async()=>{
  const f=controllerFixture(async input=>readCleanupJob(job({enabled:false,state:input.action==='status'?'cancelled':'planning'})));
  f.render().toggle('workOrders');await f.render().preview();f.render();
  assert.equal(f.timers.size,1,'disabled execution must not suppress inventory status');
  f.render().showConfirmation();f.render().setPhrase('DELETE SELECTED DATA');await f.render().confirm();
  assert.deepEqual(f.calls.map(input=>input.action),['preview']);
  await f.render().cancel();f.render();
  assert.equal(f.timers.size,1,'disabled execution must not suppress cancellation status');
  await f.render().refresh();f.render();
  assert.equal(f.render().job.state,'cancelled');
  assert.equal(f.timers.size,0);
  assert.deepEqual(f.calls.map(input=>input.action),['preview','cancel','status']);
});

test('client accepts an actual callable-encoded planning response with absent optional fields',async()=>{
  const {encode}=require('../../functions/node_modules/firebase-functions/lib/common/providers/https.js');
  // The callable encoder converts present undefined properties to null. The service omits absent optional fields.
  const {planHash:_hash,...planning}=job({state:'planning'});
  const {api}=loadClient(encode(planning));
  const result=await api.manageDatabaseCleanup({action:'preview',categories:['workOrders'],requestId:'request-1'});
  assert.equal(result.state,'planning');
  assert.equal(result.planHash,undefined);
  assert.equal(canConfirmCleanup(result,'DELETE SELECTED DATA',false),false);
});
