import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';import ts from 'typescript';import {collectionFor} from '../src/notifications/protocol.ts';
test('authorized notification outside list query keeps one document live; account switch cannot expose cached record',()=>{
 let cursor=0;const slots:any[]=[],effects:Array<()=>void>=[],listeners:any[]=[];
 let session:any={user:{uid:'b'},profile:{approved:true,role:'resident'},loading:false};let target:any={category:'discussion',conversationId:'older'};
 const exports:any={};vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/notifications/usePushDocument.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:(name:string)=>{
  if(name==='react')return{useState:(initial:any)=>{const i=cursor++;if(!(i in slots))slots[i]=initial;return[slots[i],(v:any)=>{slots[i]=typeof v==='function'?v(slots[i]):v;}];},useRef:(value:any)=>{const i=cursor++;return slots[i]||(slots[i]={current:value});},useEffect:(fn:any,deps:any[])=>{const i=cursor++,old=slots[i];if(!old||deps.some((v:any,j:number)=>v!==old.deps[j]))effects.push(()=>{old?.cleanup?.();slots[i]={deps,cleanup:fn()};});}};
  if(name==='firebase/firestore')return{doc:(_:any,collection:string,id:string)=>({collection,id}),onSnapshot:(ref:any,callback:any)=>{const item={ref,callback,stopped:false};listeners.push(item);return()=>{item.stopped=true;};}};
  if(name==='../lib/firebase')return{db:{}};if(name==='../lib/session')return{useSession:()=>session};if(name==='./InboxPushProvider')return{useInboxPush:()=>({target})};if(name==='./protocol')return{collectionFor};throw Error(name);
 }});
 const render=()=>{cursor=0;return exports.usePushDocument(['discussion']);},commit=()=>effects.splice(0).forEach(fn=>fn());
 render();commit();render();commit();assert.equal(listeners.length,1);assert.deepEqual({...listeners[0].ref},{collection:'discussion_feed',id:'older'});
 listeners[0].callback({exists:()=>true,data:()=>({title:'fixture'})});assert.equal(render().data.title,'fixture');target=null;commit();render();commit();assert.equal(listeners.length,1);
 session={...session,user:{uid:'other'}};assert.equal(render(),null);commit();assert.equal(listeners[0].stopped,true);
 listeners[0].callback({exists:()=>true,data:()=>({title:'stale'})});assert.equal(render(),null);
});
