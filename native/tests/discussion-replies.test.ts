import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';import ts from 'typescript';
function fixture(parentAuthor='other'){
 let stored:any={userId:'owner',storageDraft:false,comments:[{id:'parent',authorId:parentAuthor,text:'fixture'}]},writes=0;
 const exports:any={};const code=ts.transpileModule(readFileSync(new URL('../../src/services/socialIntegrity.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(code,{exports,require:(name:string)=>{
  assert.equal(name,'firebase/firestore');return{collection:()=>({}),doc:(_:any,collection:string,id:string)=>({id:id||'generated',collection}),getDoc:async()=>({data:()=>({name:'Fixture',role:'resident',approved:true})}),serverTimestamp:()=> 'server',runTransaction:async(_:any,fn:any)=>fn({get:async()=>({exists:()=>true,data:()=>stored}),update:(_:any,patch:any)=>{stored={...stored,...patch};writes++;}})};
 }});
 return {run:(reply='parent')=>exports.mutateSocial({},'sender','discussion_feed','post','comment',{text:'reply',commentId:'new',replyToCommentId:reply}),get:()=>stored,writes:()=>writes};
}
test('direct reply appends verified parent ID/index, retains all comments, idempotently retries',async()=>{
 const f=fixture();await f.run();await f.run();assert.equal(f.writes(),1);assert.equal(f.get().comments.length,2);
 assert.equal(f.get().comments[1].replyToCommentId,'parent');assert.equal(f.get().comments[1].replyToCommentIndex,0);assert.equal(f.get().comments[1].authorId,'sender');
});
test('ambiguous legacy/name-only or missing parents cannot become targeted replies',async()=>{
 await assert.rejects(()=>fixture('').run(),/cannot receive/);await assert.rejects(()=>fixture().run('missing'),/cannot receive/);
});
