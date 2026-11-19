import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const ts=createRequire(import.meta.url)('typescript');
function fixture(options:{role?:string;own?:boolean;pending?:boolean;fail?:boolean;reviewed?:boolean;mismatch?:boolean;status?:string;canRetry?:boolean}={}){
 let cursor=0,started=false;const states:any[]=[],effects:Array<()=>void>=[],calls:any[]=[];let lists=0,reviewed=options.reviewed===true,resolve!:(value:any)=>void;
 const jsx=(type:any,props:any)=>({type,props});
 const modules:Record<string,any>={
  react:{useState:(initial:any)=>{const i=cursor++;if(!(i in states))states[i]=initial;return[states[i],(value:any)=>{states[i]=typeof value==='function'?value(states[i]):value;}];},useRef:(initial:any)=>{const i=cursor++;return states[i]||(states[i]={current:initial});},useEffect:(fn:()=>void)=>{if(!started)effects.push(fn);}},
  'react/jsx-runtime':{jsx,jsxs:jsx},'react-native':{Pressable:'Button',View:'View'},
  '../lib/firebase':{auth:{currentUser:{uid:'reviewer'}}},
  '../lib/session':{useSession:()=>({user:{uid:'reviewer'},profile:{approved:true,role:options.role||'admin'}})},
  '../news/ui':{Action:'Action',Copy:'Copy',ErrorNotice:'Error',Field:'Field'},
  '../lib/accountDeletion':{
   listAccountDeletionRequests:async()=>{lists++;return{requests:[{jobId:'fixture',requestId:'request-3',workflowVersion:options.reviewed?2:3,name:'Fixture Resident',createdAt:Date.parse('2026-10-29T12:00:00Z'),status:options.status||(reviewed?'retention_pending':'requested'),canRetry:options.canRetry===true,canReview:!reviewed&&!options.status,isOwnRequest:options.own===true}],nextCursor:null};},
   reviewAccountDeletionRequest:async(...args:any[])=>{calls.push(args);if(options.fail){options.fail=false;throw Error('Fixture service unavailable');}if(options.pending)return new Promise(done=>{resolve=done;});reviewed=true;return{jobId:options.mismatch?'wrong-request':'fixture',status:'queued',requestId:'request-3'};},
   deletionStatusText:(item:any)=>`Status: ${item.status}`,
  },
 };
 const exports:any={};
 vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/profile/AccountDeletionRequests.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Error,Date,require:(id:string)=>{assert(id in modules,id);return modules[id];}});
 return{calls,get lists(){return lists;},resolve:()=>{reviewed=true;resolve({jobId:'fixture',status:'queued',requestId:'request-3'});},render:()=>{cursor=0;let tree=exports.AccountDeletionRequests();while(typeof tree?.type==='function')tree=tree.type(tree.props);if(!started){started=true;effects.forEach(fn=>fn());}return tree;}};
}
function nodes(n:any):any[]{if(n==null||typeof n==='boolean')return[];if(Array.isArray(n))return n.flatMap(nodes);return typeof n==='object'?[n,...nodes(n.props?.children)]:[n];}
const settle=()=>new Promise<void>(resolve=>setImmediate(resolve));
const button=(tree:any,label:string)=>nodes(tree).find(n=>n.type==='Button'&&n.props.accessibilityLabel===label);
const field=(tree:any)=>nodes(tree).find(n=>n.type==='Field');
async function loaded(options:Parameters<typeof fixture>[0]={}){const h=fixture(options);h.render();await settle();return h;}
test('compact review preserves colored decision buttons and shows processing status',async()=>{
 const h=await loaded(),tree=h.render();assert.equal(nodes(tree).filter(n=>n.type==='Field').length,1);assert.equal(field(tree).props.label,'Note (optional)');
 for(const [label,color]of [['Deny','#dc2626'],['Approve','#047857']]){const b=button(tree,label);assert.equal(b.props.style({pressed:false}).backgroundColor,color);assert.equal(b.props.children.props.style.color,'#fff');assert.equal(b.props.disabled,false);}
 const text=nodes(tree).filter(n=>typeof n==='string').join(' ');assert(text.includes('Status: requested'));assert(text.includes('Fixture Resident'));assert.equal(nodes(tree).filter(n=>n.type==='Button').length,2);
});
test('confirmed approval keeps the processing card visible and refresh shows historical status',async()=>{
 const h=await loaded({role:'vip'});button(h.render(),'Approve').props.onPress();await settle();const tree=h.render();
 assert.equal(h.calls[0][1],'approved');assert.equal(button(tree,'Approve'),undefined);assert(nodes(tree).includes('Fixture Resident'));assert(nodes(tree).includes('Status: queued'));
 const refresh=nodes(tree).find(n=>n.type==='Action');refresh.props.onPress();await settle();assert.equal(button(h.render(),'Approve'),undefined);assert(nodes(h.render()).includes('Fixture Resident'));
});
test('provided note is saved; rapid taps cannot submit duplicate decisions',async()=>{
 const h=await loaded({pending:true});field(h.render()).props.onChangeText('  Reviewed fixture note  ');const approve=button(h.render(),'Approve');approve.props.onPress();approve.props.onPress();
 assert.equal(h.calls.length,1);assert.equal(h.calls[0][2],'Reviewed fixture note');assert(button(h.render(),'Approve').props.disabled);h.resolve();await settle();assert.equal(button(h.render(),'Approve'),undefined);
});
test('rejection requires explicit confirmation, reason category, explanation and reference',async()=>{
 const h=await loaded();button(h.render(),'Deny').props.onPress();let tree=h.render();assert.equal(h.calls.length,0);
 const fields=nodes(tree).filter(n=>n.type==='Field');assert(fields.some(n=>n.props.label==='Documented reason'));
 const confirm=()=>nodes(h.render()).find(n=>n.type==='Action'&&n.props.label==='Confirm rejection');assert(confirm().props.disabled);
 fields.find(n=>n.props.label==='Documented reason').props.onChangeText('Verified request does not identify a valid account');
 fields.find(n=>n.props.label==='Documentation reference').props.onChangeText('Office case 41');
 confirm().props.onPress();await settle();assert.equal(h.calls[0][1],'rejected');assert.equal(h.calls[0][3].reasonCategory,'invalid_request');assert.equal(h.calls[0][3].reasonReference,'Office case 41');
});
test('failure keeps the note and permits retry without displaying success',async()=>{
 const h=await loaded({fail:true});field(h.render()).props.onChangeText('Keep this note');button(h.render(),'Approve').props.onPress();await settle();let tree=h.render();assert.equal(field(tree).props.value,'Keep this note');assert.equal(button(tree,'Approve').props.disabled,false);assert(!nodes(tree).includes('Status: approved_held'));button(tree,'Approve').props.onPress();await settle();assert.equal(h.calls.length,2);assert.equal(button(h.render(),'Approve'),undefined);
});
test('self-review is disabled and non-manager sessions cannot load or review requests',async()=>{
 const own=await loaded({own:true});const b=button(own.render(),'Approve');assert(b.props.disabled);b.props.onPress();assert.equal(own.calls.length,0);
 const resident=await loaded({role:'resident'});assert.equal(resident.lists,0);assert.equal(button(resident.render(),'Approve'),undefined);
});

test('legacy retained receipts remain visible and read-only',async()=>{
 const h=await loaded({reviewed:true}),tree=h.render();assert.equal(button(tree,'Approve'),undefined);assert.equal(field(tree),undefined);assert(nodes(tree).includes('Fixture Resident'));assert(nodes(tree).includes('Status: retention_pending'));
});
test('a mismatched approval response leaves the request visible with a useful error',async()=>{
 const h=await loaded({mismatch:true});button(h.render(),'Approve').props.onPress();await settle();const tree=h.render();assert(button(tree,'Approve'));assert(nodes(tree).includes('Fixture Resident'));assert.match(nodes(tree).find(n=>n.type==='Error').props.message,/confirm the decision/);
});

test('every processing outcome remains visible without review controls',async()=>{
 for(const status of ['processing','retrying','failed','complete']){
  const h=await loaded({status});const tree=h.render();assert(nodes(tree).includes(`Status: ${status}`));assert(nodes(tree).includes('Fixture Resident'));assert.equal(button(tree,'Approve'),undefined);
 }
});
test('retry is available only when authorized and requires generation-bound confirmation',async()=>{
 const h=await loaded({status:'failed',canRetry:true});let tree=h.render();
 nodes(tree).find(n=>n.type==='Action'&&n.props.label==='Retry processing').props.onPress();assert.equal(h.calls.length,0);
 tree=h.render();nodes(tree).find(n=>n.type==='Action'&&n.props.label==='Confirm retry').props.onPress();await settle();
 assert.equal(h.calls[0][1],'retry');assert.equal(h.calls[0][3].requestId,'request-3');assert(nodes(h.render()).includes('Status: queued'));
});
