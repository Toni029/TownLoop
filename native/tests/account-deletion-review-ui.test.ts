import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const ts=createRequire(import.meta.url)('typescript');
function fixture(options:{role?:string;own?:boolean;pending?:boolean;fail?:boolean;reviewed?:boolean;mismatch?:boolean}={}){
 let cursor=0,started=false;const states:any[]=[],effects:Array<()=>void>=[],calls:any[]=[];let lists=0,reviewed=options.reviewed===true,resolve!:(value:any)=>void;
 const jsx=(type:any,props:any)=>({type,props});
 const modules:Record<string,any>={
  react:{useState:(initial:any)=>{const i=cursor++;if(!(i in states))states[i]=initial;return[states[i],(value:any)=>{states[i]=typeof value==='function'?value(states[i]):value;}];},useRef:(initial:any)=>{const i=cursor++;return states[i]||(states[i]={current:initial});},useEffect:(fn:()=>void)=>{if(!started)effects.push(fn);}},
  'react/jsx-runtime':{jsx,jsxs:jsx},'react-native':{Pressable:'Button',View:'View'},
  '../lib/session':{useSession:()=>({user:{uid:'reviewer'},profile:{approved:true,role:options.role||'admin'}})},
  '../news/ui':{Action:'Action',Copy:'Copy',ErrorNotice:'Error',Field:'Field'},
  '../lib/accountDeletion':{
   listAccountDeletionRequests:async()=>{lists++;return{requests:[{jobId:'fixture',name:'Fixture Resident',createdAt:Date.parse('2026-10-29T12:00:00Z'),status:reviewed?'retention_pending':'requested',canReview:!reviewed,isOwnRequest:options.own===true}],nextCursor:null};},
   reviewAccountDeletionRequest:async(...args:any[])=>{calls.push(args);if(options.fail){options.fail=false;throw Error('Fixture service unavailable');}if(options.pending)return new Promise(done=>{resolve=done;});reviewed=true;return{jobId:options.mismatch?'wrong-request':'fixture',status:'queued'};},
   deletionStatusText:(item:any)=>`Status: ${item.status}`,
  },
 };
 const exports:any={};
 vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/profile/AccountDeletionRequests.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Error,Date,require:(id:string)=>{assert(id in modules,id);return modules[id];}});
 return{calls,get lists(){return lists;},resolve:()=>{reviewed=true;resolve({jobId:'fixture',status:'queued'});},render:()=>{cursor=0;const tree=exports.AccountDeletionRequests();if(!started){started=true;effects.forEach(fn=>fn());}return tree;}};
}
function nodes(n:any):any[]{if(n==null||typeof n==='boolean')return[];if(Array.isArray(n))return n.flatMap(nodes);return typeof n==='object'?[n,...nodes(n.props?.children)]:[n];}
const settle=()=>new Promise<void>(resolve=>setImmediate(resolve));
const button=(tree:any,label:string)=>nodes(tree).find(n=>n.type==='Button'&&n.props.accessibilityLabel===label);
const field=(tree:any)=>nodes(tree).find(n=>n.type==='Field');
async function loaded(options:Parameters<typeof fixture>[0]={}){const h=fixture(options);h.render();await settle();return h;}
test('compact review has one optional note, exact colored buttons and no technical/processing controls',async()=>{
 const h=await loaded(),tree=h.render();assert.equal(nodes(tree).filter(n=>n.type==='Field').length,1);assert.equal(field(tree).props.label,'Note (optional)');
 for(const [label,color]of [['Deny','#dc2626'],['Approve','#047857']]){const b=button(tree,label);assert.equal(b.props.style({pressed:false}).backgroundColor,color);assert.equal(b.props.children.props.style.color,'#fff');assert.equal(b.props.disabled,false);}
 const text=nodes(tree).filter(n=>typeof n==='string').join(' ');assert(!/deadline|processing|reference|category|reason/i.test(text));assert(text.includes('Fixture Resident'));assert.equal(nodes(tree).filter(n=>n.type==='Button').length,2);
});
test('confirmed approval removes the review card and refresh cannot restore retained receipts',async()=>{
 const h=await loaded({role:'vip'});button(h.render(),'Approve').props.onPress();await settle();const tree=h.render();
 assert.deepEqual(h.calls,[['fixture','approved','Approved without an additional note.']]);assert.equal(button(tree,'Approve'),undefined);assert(!nodes(tree).includes('Fixture Resident'));assert(nodes(tree).includes('No pending deletion requests.'));
 const refresh=nodes(tree).find(n=>n.type==='Action');refresh.props.onPress();await settle();assert.equal(button(h.render(),'Approve'),undefined);assert(!nodes(h.render()).includes('Fixture Resident'));
});
test('provided note is saved; rapid taps cannot submit duplicate decisions',async()=>{
 const h=await loaded({pending:true});field(h.render()).props.onChangeText('  Reviewed fixture note  ');const approve=button(h.render(),'Approve');approve.props.onPress();approve.props.onPress();
 assert.equal(h.calls.length,1);assert.deepEqual(h.calls[0],['fixture','approved','Reviewed fixture note']);assert(button(h.render(),'Approve').props.disabled);h.resolve();await settle();assert.equal(button(h.render(),'Approve'),undefined);
});
test('Deny explains the policy blocker and never invents withdrawal evidence or sends a rejection',async()=>{
 const h=await loaded();button(h.render(),'Deny').props.onPress();const error=nodes(h.render()).find(n=>n.type==='Error');assert.match(error.props.message,/documented withdrawal/);assert.equal(h.calls.length,0);
});
test('failure keeps the note and permits retry without displaying success',async()=>{
 const h=await loaded({fail:true});field(h.render()).props.onChangeText('Keep this note');button(h.render(),'Approve').props.onPress();await settle();let tree=h.render();assert.equal(field(tree).props.value,'Keep this note');assert.equal(button(tree,'Approve').props.disabled,false);assert(!nodes(tree).includes('Status: approved_held'));button(tree,'Approve').props.onPress();await settle();assert.equal(h.calls.length,2);assert.equal(button(h.render(),'Approve'),undefined);
});
test('self-review is disabled and non-manager sessions cannot load or review requests',async()=>{
 const own=await loaded({own:true});const b=button(own.render(),'Approve');assert(b.props.disabled);b.props.onPress();assert.equal(own.calls.length,0);
 const resident=await loaded({role:'resident'});assert.equal(resident.lists,0);assert.equal(button(resident.render(),'Approve'),undefined);
});

test('already processed retained receipts do not appear in the pending review queue',async()=>{
 const h=await loaded({reviewed:true}),tree=h.render();assert.equal(button(tree,'Approve'),undefined);assert.equal(field(tree),undefined);assert(!nodes(tree).includes('Fixture Resident'));assert(nodes(tree).includes('No pending deletion requests.'));
});
test('a mismatched approval response leaves the request visible with a useful error',async()=>{
 const h=await loaded({mismatch:true});button(h.render(),'Approve').props.onPress();await settle();const tree=h.render();assert(button(tree,'Approve'));assert(nodes(tree).includes('Fixture Resident'));assert.match(nodes(tree).find(n=>n.type==='Error').props.message,/confirm the decision/);
});
