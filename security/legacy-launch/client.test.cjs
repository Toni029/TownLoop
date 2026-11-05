const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function fixture({approved=true,changeAccount=false}={}){
 const writes=[],selected=[],auth={currentUser:{uid:'Alice'}},old={authorizationEpoch:'fixture-v1',messages:[{id:'old',senderId:'Bob',body:'Preserved history'}],residentId:'Alice'};
 const sdk={getFirestore:(app,database)=>{selected.push({app,database});return{database};},doc:(_db,source,id)=>({source,id}),getDocFromServer:async ref=>{if(changeAccount)auth.currentUser.uid='Mallory';return{exists:()=>true,data:()=>({approved,role:'resident',name:'Alice'})};},runTransaction:async(_db,fn)=>fn({get:async()=>({exists:()=>true,data:()=>old}),update:(ref,patch,value)=>{writes.push({ref,patch,value});if(patch.messages)Object.assign(old,patch);}}),FieldPath:class{constructor(...segments){this.segments=segments;}}};
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(__dirname+'/client.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:()=>sdk,Date});
 return{api:exports,auth,old,writes,selected};
}
test('local adapter selects only the explicit named database; pending profiles do not become message authority',async()=>{
 const f=fixture({approved:false});f.api.namedDatabase('synthetic-app');assert.equal(f.selected[0].database,'ai-studio-cclivingv27-5fc1a0f6-cd75-4964-8c9e-e219a265f7bb');
 await assert.rejects(f.api.sendExistingMessage({},f.auth,'office_chats','verified','Text','op-one'),/approved/);assert.equal(f.writes.length,0);
});
test('local adapter preserves old history, derives canonical count ID and acknowledges retry without appending twice',async()=>{
 const f=fixture(),old=JSON.stringify(f.old.messages[0]);
 await f.api.sendExistingMessage({},f.auth,'office_chats','verified',' Real reply ','op-one');
 assert.equal(f.writes.length,1);assert.equal(JSON.stringify(f.old.messages[0]),old);assert.equal(f.old.messages[1].id,'legacy_fixture-v1_Alice_1');assert.equal(f.old.messages[1].senderId,'Alice');assert.equal(f.old.messages[1].senderRole,'resident');assert.equal(f.old.messages[1].operationId,'op-one');assert.equal(f.old.messages[1].body,'Real reply');
 const retry=await f.api.sendExistingMessage({},f.auth,'office_chats','verified','Real reply','op-one');assert.equal(retry.duplicate,true);assert.equal(f.writes.length,1);
 await assert.rejects(f.api.sendExistingMessage({},f.auth,'office_chats','verified','Different text','op-one'),/message changed/);assert.equal(f.writes.length,1);
 await f.api.markExistingRead({},f.auth,'office_chats','verified');assert.equal(f.writes[1].patch.segments.join('.'),'readBy.Alice');assert.equal(f.writes[1].value,2);
});
test('account switch during authority lookup stops the local adapter before any write',async()=>{
 const f=fixture({changeAccount:true});await assert.rejects(f.api.sendExistingMessage({},f.auth,'office_chats','verified','Text','op-one'),/account changed/);assert.equal(f.writes.length,0);
});
