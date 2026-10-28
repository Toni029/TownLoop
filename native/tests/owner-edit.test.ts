import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const model:any={exports:{},require:()=>({})};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/workorders/model.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,model);
const canEditRequest=model.exports.canEditRequest;
import {categoryMenuBounds} from '../src/workorders/categoryMenuBounds.ts';
function fixture(path:string,data:Record<string,any>,uid='owner'){
 const writes:any[]=[];let allocations=0;
 const user={id:uid,role:'resident',approved:true};
 const firestore={doc:(_:any,collection:string,id:string)=>({collection,id}),collection:(_:any,c:string)=>c,serverTimestamp:()=> 'server-time',runTransaction:async(_:any,fn:any)=>fn({get:async()=>({exists:()=>true,data:()=>data}),update:(ref:any,patch:any)=>writes.push({ref,patch})})};
 const modules:any={
  'firebase/firestore':firestore,'../lib/firebase':{db:{}},'../news/actions':{approvedUser:async()=>user},'../news/model':{singleFlight:()=>async(_:any,fn:any)=>fn()},
  './model':path.includes('workorders')?{canEditRequest}:{formatPrice:(p:string)=>p==='0'?'FREE':p},
  '../../../src/data/workOrderCategories':{getCategoryEmoji:()=> '🔧'},'../../../src/data/allocateWorkOrder':{allocateWorkOrder:()=>{allocations++;}},
  '../../../src/utils/permissions':{},'../../../src/services/socialIntegrity':{},'../../../src/services/marketplaceChatProtocol':{},'../notifications/device':{},
 };
 const context:any={exports:{},require:(id:string)=>modules[id]};vm.runInNewContext(ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
 return {api:context.exports,writes,user,allocations:()=>allocations};
}
test('seller edit updates the same Firebase document and preserves comments, ownership, availability and creation date',async()=>{
 const data={storageDraft:false,userId:'owner',comments:[{text:'existing'}],sold:true,createdAt:123};const f=fixture('../src/social/actions.ts',data);
 await f.api.editListing('listing-1',{title:' New name ',description:' New details ',price:'0',media:[]});
 assert.equal(f.writes[0].ref.id,'listing-1');assert.equal(f.writes[0].patch.title,'New name');assert.equal(f.writes[0].patch.price,'FREE');
 assert.deepEqual(Object.keys(f.writes[0].patch).sort(),['description','media','mediaUrl','price','title','updatedAt']);assert.equal(data.comments.length,1);assert.equal(data.sold,true);
});
test('unrelated residents and managers cannot use the seller edit path; invalid drafts never write',async()=>{
 for(const role of ['resident','admin','vip','crew']){const f=fixture('../src/social/actions.ts',{storageDraft:false,userId:'other'});f.user.role=role;await assert.rejects(f.api.editListing('x',{title:'Name',description:'Details',price:'FREE',media:[]}),/seller/);assert.equal(f.writes.length,0);}
 const f=fixture('../src/social/actions.ts',{storageDraft:false,userId:'owner'});await assert.rejects(f.api.editListing('x',{title:' ',description:'Details',price:'FREE',media:[]}),/title/);assert.equal(f.writes.length,0);
});
test('request edits preserve ticket allocation, queue status, comments and completion history',async()=>{
 const data={storageDraft:false,userId:'owner',status:'In Progress',ticketNumber:1234,comments:[{text:'crew comment'}]};const f=fixture('../src/workorders/actions.ts',data);
 await f.api.editWorkOrder('order-1',{title:' Updated repair ',description:' Details ',category:'Plumbing',photos:['existing-photo']});
 assert.equal(f.allocations(),0);assert.equal(f.writes[0].ref.id,'order-1');assert.deepEqual(Object.keys(f.writes[0].patch).sort(),['category','categoryEmoji','description','photoUrl','photos','title','updatedAt']);assert.equal(data.status,'In Progress');assert.equal(data.ticketNumber,1234);
});
test('Done and cross-account requests are rejected inside the save transaction',async()=>{
 for(const data of [{userId:'owner',status:'Done'},{userId:'other',status:'Queued'}]){const f=fixture('../src/workorders/actions.ts',{...data,storageDraft:false});await assert.rejects(f.api.editWorkOrder('order-1',{title:'Repair',description:'Details',category:'Plumbing',photos:[]}),/creator/);assert.equal(f.writes.length,0);}
 assert.equal(canEditRequest({userId:'owner',status:'Queued'},{id:'owner'}),true);assert.equal(canEditRequest({status:'Queued'},{id:'owner'}),false);
});
test('category overlay fits narrow phones and safe areas above or below its trigger',()=>{
 for(const screen of [{width:320,height:568},{width:430,height:932},{width:667,height:300}])for(const y of [80,screen.height-100]){
 const insets={top:30,bottom:24,left:0,right:0},b=categoryMenuBounds({x:20,y,width:screen.width-40,height:44},screen,insets);
 assert.ok(b.top>=insets.top+8);assert.ok(b.top+b.maxHeight<=screen.height-insets.bottom-8);assert.ok(b.left>=8);assert.ok(b.left+b.width<=screen.width-8);
 }
});

test('removing all listing media does not resurrect a historical photo URL',()=>{
 const context:any={exports:{},require:()=>({})};vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/social/model.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
 const legacy=context.exports.readListing('item',{photoUrl:'legacy-photo'});assert.equal(legacy.media.length,1);
 const edited=context.exports.readListing('item',{photoUrl:'legacy-photo',media:[],mediaUrl:''});assert.equal(edited.media.length,0);assert.equal(edited.photoUrl,'');
});
