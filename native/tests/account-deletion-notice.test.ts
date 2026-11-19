import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const ts=createRequire(import.meta.url)('typescript');
function fixture(){
 let cursor=0,started=false;const state:any[]=[],effects:Array<()=>void>=[],calls:any[]=[];let resume:Function=()=>{},resolve:Function=()=>{};
 let session:any={user:{uid:'a'},profile:{source:{accountDeletionNotice:{requestId:'r1',decision:'rejected',reason:'Unable to verify the request'}}},loading:false};
 const auth:any={currentUser:{uid:'a'}};const jsx=(type:any,props:any)=>({type,props});
 const modules:Record<string,any>={react:{useRef:(v:any)=>{const i=cursor++;return state[i]||(state[i]={current:v});},useState:(v:any)=>{const i=cursor++;if(!(i in state))state[i]=v;return[state[i],(next:any)=>{state[i]=typeof next==='function'?next(state[i]):next;}];},useEffect:(fn:()=>void)=>{if(!started)effects.push(fn);}},'react/jsx-runtime':{jsx,jsxs:jsx},'react-native':{AppState:{addEventListener:(_:any,fn:Function)=>{resume=fn;return {remove(){}};}},View:'View',Text:'Text'},'../motion/Pressable':{MotionPressable:'Button'},'../lib/session':{useSession:()=>session},'../lib/firebase':{auth},'../lib/accountDeletion':{getAccountDeletionStatus:async(options:any)=>{calls.push(options);if(options?.ackNotice)return new Promise(done=>{resolve=done;});return {accountDeletionNotice:session.profile.source.accountDeletionNotice};}}};
 const exports:any={};vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/profile/AccountDeletionNotice.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:(id:string)=>{assert(id in modules,id);return modules[id];}});
 return {calls,render:()=>{cursor=0;let tree=exports.AccountDeletionNotice();while(typeof tree?.type==='function')tree=tree.type(tree.props);if(!started){started=true;effects.forEach(fn=>fn());}return tree;},resume:()=>resume('active'),ack:()=>resolve({}),switch:()=>{session={user:{uid:'b'},profile:{source:{}},loading:false};auth.currentUser={uid:'b'};}};
}
function nodes(n:any):any[]{if(n==null||typeof n==='boolean')return[];if(Array.isArray(n))return n.flatMap(nodes);return typeof n==='object'?[n,...nodes(n.props?.children)]:[n];}
const settle=()=>new Promise<void>(resolve=>setImmediate(resolve));
test('rejection notice persists until acknowledged, refreshes on foreground, and acknowledges the exact generation',async()=>{
 const h=fixture();h.render();await settle();let tree=h.render();assert(nodes(tree).includes('Unable to verify the request'));assert(nodes(tree).some(n=>typeof n==='string'&&n.includes('new verified request')));
 h.resume();await settle();assert.equal(h.calls.length,2);
 nodes(h.render()).find(n=>n.type==='Button').props.onPress();assert.equal(h.calls.at(-1).ackNotice,'r1');assert(nodes(h.render()).includes('Unable to verify the request'));
 h.ack();await settle();assert.equal(h.render(),null);
});
test('a notice and a late acknowledgement never appear in a different account session',async()=>{
 const h=fixture();h.render();await settle();nodes(h.render()).find(n=>n.type==='Button').props.onPress();h.switch();assert.equal(h.render(),null);h.ack();await settle();assert.equal(h.render(),null);
});
