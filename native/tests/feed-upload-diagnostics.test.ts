import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(file:string, modules:Record<string,unknown>, globals:Record<string,unknown>={}) {
 const exports:any={};
 const source=readFileSync(new URL(file,import.meta.url),'utf8');
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:(id:string)=>modules[id],console:{info(){}},__DEV__:false,performance:{now:()=>100},setInterval:()=>1,clearInterval(){},...globals});
 return exports;
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('Preview trace is bounded, redacts unknown error codes and survives module restart for export',async()=>{
 let saved='',shared='';
 const modules={ '@react-native-async-storage/async-storage':{__esModule:true,default:{setItem:async(_k:string,v:string)=>{saved=v;},getItem:async()=>saved}},'expo-updates':{channel:'preview'},'react-native':{AppState:{addEventListener:()=>({remove(){}})},Share:{share:async(v:any)=>{shared=v.message;}}}};
 const trace=load('../src/monitoring/feedUploadTrace.ts',modules);
 trace.beginFeedTrace();trace.feedStage('error',{code:'private-token',message:'private-text',url:'private-photo'});
 for(let i=0;i<200;i++)trace.feedStage('ui_commit');
 await settle();
 const restarted=load('../src/monitoring/feedUploadTrace.ts',modules);await restarted.shareFeedTrace();
 const result=JSON.parse(shared);assert.equal(result.events.length,80);assert.equal(result.events[1].code,'unknown');
 assert.equal(shared.includes('private'),false);
 assert.ok(result.events.every((e:any)=>Object.keys(e).every(k=>['stage','elapsedMs','code'].includes(k))));
});
test('Production does not record, persist or export traces',async()=>{
 let touches=0;
 const trace=load('../src/monitoring/feedUploadTrace.ts',{'@react-native-async-storage/async-storage':{__esModule:true,default:{setItem:async()=>touches++,getItem:async()=>touches++}},'expo-updates':{channel:'production'},'react-native':{AppState:{addEventListener:()=>({remove(){}})},Share:{share:async()=>touches++}}});
 trace.beginFeedTrace();trace.feedStage('picker_start');await trace.shareFeedTrace();assert.equal(touches,0);
});
test('actual feed media call traces photo-first picker, processing, draft and transfer boundaries; other folders stay silent',async()=>{
 const stages:string[]=[];
 const asset={uri:'file://fixture',type:'image',width:1200,height:800,fileSize:100};
 const modules:any={
 'expo-image-picker':{launchImageLibraryAsync:async()=>({canceled:false,assets:[asset]})},
 'expo-image-manipulator':{SaveFormat:{JPEG:'jpeg'},manipulateAsync:async()=>({uri:'file://processed'})},
 'expo-file-system/legacy':{getInfoAsync:async()=>({exists:true,size:100}),deleteAsync:async()=>{}},
 'react-native':{Platform:{OS:'android'}},
 '../../../src/services/mediaAuthorization':{ensureMediaDraft:async()=>{}},
 '../lib/firebase':{db:{},auth:{currentUser:{uid:'fixture'}}},
 '../news/actions':{approvedUser:async()=>({id:'fixture'})},
 '../media/deadline':{deadline:(p:any)=>p},
 '../media/uploadFile':{uploadFile:async(input:any)=>{input.onTransferred();return 'fixture';},uploadedFileURL:async()=> 'fixture'},
 };
 const media=load('../src/components/media.ts',modules);
 await media.pickAndUpload('feed',()=>{},false,{recordId:'fixture',collection:'discussion_feed'},{trace:(s:string)=>stages.push(s),onSelected:()=>stages.push('selection_callback')});
 assert.deepEqual(stages,['account_start','account_done','picker_start','picker_return','selection_callback','draft_start','draft_done','process_start','process_done','size_start','size_done','upload_start','transfer_done','upload_done']);
 stages.length=0;
 await media.pickAndUpload('marketplace',()=>{},false,{recordId:'fixture',collection:'marketplace_posts'},{trace:(s:string)=>stages.push(s)});
 assert.deepEqual(stages,[]);
 // A deliberately unresolved native processing promise leaves a precise last stage,
 // without the diagnostic itself blocking another JS task or starting a transfer.
 modules['expo-image-manipulator'].manipulateAsync=()=>new Promise(()=>{});
 void media.pickAndUpload('feed',()=>{},false,{recordId:'fixture',collection:'discussion_feed'},{trace:(s:string)=>stages.push(s)});
 await settle();assert.equal(stages.at(-1),'process_start');assert.equal(stages.includes('upload_start'),false);
});
