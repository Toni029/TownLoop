'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {eventJob,orphanJob,inspectObject,runJob,BUCKET,AGE_MS}=require('./socialMediaLifecycle.cjs');
const provenance=require('./deletionMediaProvenance.json');
const now=Date.parse('2026-11-13T12:00:00Z');
const parent={databaseId:'(default)',collection:'marketplace_posts',recordId:'item1',uid:'seller'};
const media={name:'marketplace/photo.jpg',bucket:BUCKET,generation:'17',metageneration:'2',size:'100',timeCreated:new Date(now-AGE_MS-1).toISOString(),metadata:{securityVersion:'1',collection:parent.collection,recordId:parent.recordId,uploadedBy:'seller'}};
const policy={ownerApproved:true,approvalReference:'synthetic',storageRulesSha256:provenance.storageRulesSha256,trustedUploadsAfter:{toMillis:()=>1},collections:{marketplace_posts:{action:'delete_linked_media_on_parent_deletion',reason:'synthetic'}}};
const makeJob=(before={userId:'seller',media:[media.name]},after=null)=>eventJob({...parent,eventId:'event1',before,after,now});
test('deletions and edits queue minimal detached references, never text or private messages',()=>{
 const deleted=makeJob({userId:'seller',description:'private text',media:[media.name]});
 assert.equal(deleted.mode,'deleted');assert.deepEqual(deleted.paths,[media.name]);assert.ok(!JSON.stringify(deleted).includes('private text'));
 const edit=makeJob({userId:'seller',media:[media.name,'marketplace/keep.jpg']},{userId:'seller',media:['marketplace/keep.jpg']});
 assert.equal(edit.mode,'detached');assert.deepEqual(edit.paths,[media.name]);
 assert.equal(makeJob({userId:'seller'},{userId:'seller'}),null);
 assert.throws(()=>eventJob({...parent,collection:'work_orders',before:{userId:'seller'},after:null,eventId:'e'}),/scope/);
});
test('ambiguous owners, evidence and unknown media produce unresolved holds',()=>{
 assert.equal(makeJob({userId:'seller',authorId:'other',media:[media.name]}).hold,'ownership_unverified');
 assert.equal(makeJob({userId:'seller',evidenceHold:true,media:[media.name]}).hold,'protected_record');
 assert.equal(makeJob({userId:'seller',mediaUrl:'https://unknown.example/image.jpg'}).hold,'ambiguous_reference');
});
test('48 hour orphan grace uses server creation time and stable generation identity',()=>{
 const a=orphanJob({...media,timeCreated:new Date(now-AGE_MS+1).toISOString()},'(default)',now);
 assert.equal(a.notBefore,now+1);assert.equal(a.mode,'orphan');
 assert.equal(orphanJob({...media,name:'work_orders/image.jpg'},'(default)',now),null);
 assert.notEqual(a.id,orphanJob({...media,generation:'18'},'(default)',now).id);
});
test('only proven owned, correctly scoped unheld generations can be removed',()=>{
 assert.equal(inspectObject(media,parent,policy,{},now),null);
 for(const [patch,reason] of [[{metadata:{...media.metadata,uploadedBy:'other'}},'ownership_unverified'],[{generation:''},'ownership_unverified'],[{bucket:'other'},'ownership_unverified'],[{temporaryHold:true},'protected_record'],[{metadata:{...media.metadata,evidenceHold:'true'}},'protected_record'],[{metadata:{...media.metadata,databaseId:'named'}},'ownership_unverified']])assert.equal(inspectObject({...media,...patch},parent,policy,{},now),reason);
 assert.equal(inspectObject(media,parent,policy,{versioning:{enabled:true}},now),'protected_record');
});
function deps(overrides={}){
 const calls=[];return {calls,now:()=>now,readParent:async()=>null,listOwned:async()=>[media.name],readObject:async()=>media,readPolicy:async()=>policy,readBucket:async()=>({}),scanReferences:async()=>({shared:false,ambiguous:false}),withReferenceFence:async body=>body(async()=>true),assertLease:async()=>{},deleteObject:async(name,conditions)=>{calls.push([name,conditions]);},...overrides};
}
test('conditional deletion is retry-idempotent and completes only with no unresolved files',async()=>{
 const d=deps(),job=makeJob();let result=await runJob(job,d);assert.equal(result.status,'complete');assert.equal(result.deleted,1);
 assert.deepEqual(d.calls,[[media.name,{ifGenerationMatch:'17',ifMetagenerationMatch:'2'}]]);
 result=await runJob(job,deps({readObject:async()=>null}));assert.equal(result.status,'complete');assert.equal(result.missing,1);
});
test('private chat references, unknown references, restored parent, missing fence and changed object retain files',async()=>{
 for(const [override,reason] of [[{scanReferences:async()=>({shared:true,ambiguous:false})},'shared_reference'],[{scanReferences:async()=>({shared:false,ambiguous:true})},'ambiguous_reference'],[{readParent:async()=>({userId:'seller'})},'parent_restored'],[{withReferenceFence:undefined},'reference_writers_unfenced'],[{deleteObject:async()=>{throw Object.assign(Error('changed'),{code:412});}},'object_changed']]){
  const d=deps(override),result=await runJob(makeJob(),d);assert.equal(result.status,'retained');assert.ok(result.unresolved.some(x=>x.reason===reason));assert.equal(d.calls.length,0);
 }
});
test('edits and orphans scan current parent and never delete newly referenced media',async()=>{
 const edit=makeJob({userId:'seller',media:[media.name]},{userId:'seller',media:[]});
 const d=deps({scanReferences:async()=>({shared:true,ambiguous:false})});
 assert.equal((await runJob(edit,d)).status,'retained');
 const young=orphanJob({...media,timeCreated:new Date(now).toISOString()},'(default)',now);
 assert.equal((await runJob(young,d)).status,'queued');assert.equal(d.calls.length,0);
});
test('expired fences, incomplete inventories and transient failures remain retryable',async()=>{
 for(const override of [{withReferenceFence:async body=>body(async()=>false)},{scanReferences:async()=>{throw Error('incomplete');}},{deleteObject:async()=>{throw Error('network');}}]){
  const d=deps(override),result=await runJob(makeJob(),d);assert.notEqual(result.status,'complete');assert.equal(d.calls.length,0);
 }
});
test('soft-delete recovery permits active removal but never reports bytes purged on active 404',async()=>{
 const records=[];let live=media;
 const soft={...media,softDeleteTime:new Date(now).toISOString(),hardDeleteTime:new Date(now+7*86400000).toISOString()};
 const d=deps({readBucket:async()=>({softDeletePolicy:{retentionDurationSeconds:'604800'}}),readObject:async()=>live,readRecovery:async()=>records,persistRecovery:async record=>{const i=records.findIndex(x=>x.path===record.path&&x.generation===record.generation);if(i<0)records.push(record);else records[i]=record;},readSoftDeleted:async()=>soft,readGeneration:async()=>live,deleteObject:async()=>{live=null;}});
 let result=await runJob(makeJob(),d);assert.equal(result.status,'recovery_pending');assert.equal(result.deleted,1);assert.equal(records[0].generation,'17');assert.equal(records[0].hardDeleteAt,now+7*86400000);
 result=await runJob(makeJob(),d);assert.equal(result.status,'recovery_pending');assert.equal(result.deleted,0);
 d.now=()=>now+8*86400000;d.readSoftDeleted=async()=>null;d.readGeneration=async()=>null;
 result=await runJob(makeJob(),d);assert.equal(result.status,'complete');assert.equal(records[0].status,'verified_expired');
});
test('multiple soft-deleted images retain per-generation progress across delete failure and retry',async()=>{
 const records=[],second={...media,name:'marketplace/second.jpg',generation:'18'};const live=new Map([[media.name,media],[second.name,second]]);let fail=true;
 const d=deps({listOwned:async()=>[...live.keys()],readObject:async path=>live.get(path)||null,readBucket:async()=>({softDeletePolicy:{retentionDurationSeconds:'604800'}}),readRecovery:async()=>records,persistRecovery:async record=>{const i=records.findIndex(x=>x.path===record.path);if(i<0)records.push(record);else records[i]=record;},readSoftDeleted:async(path,generation)=>live.has(path)?null:{...media,name:path,generation,softDeleteTime:new Date(now).toISOString(),hardDeleteTime:new Date(now+7*86400000).toISOString()},readGeneration:async(path)=>live.get(path)||null,deleteObject:async path=>{if(path===second.name&&fail)throw Error('network');live.delete(path);}});
 const job=makeJob({userId:'seller',media:[media.name,second.name]});
 let result=await runJob(job,d);assert.equal(result.status,'retained');assert.equal(live.size,1);assert.equal(records.length,2);
 fail=false;result=await runJob(job,d);assert.equal(result.status,'recovery_pending');assert.equal(live.size,0);assert.equal(result.deleted,1);
 d.now=()=>now+8*86400000;d.readSoftDeleted=async()=>null;
 assert.equal((await runJob(job,d)).status,'complete');
});
test('soft recovery without observed authoritative deadline or supported reads stays unresolved',async()=>{
 const record={path:media.name,generation:'17',expectedRecoveryUntil:now-1,activeRemoved:true,status:'pending',hardDeleteAt:null};
 const d=deps({readRecovery:async()=>[record],readObject:async()=>null,persistRecovery:async()=>{},readSoftDeleted:async()=>null,readGeneration:async()=>null});
 assert.equal((await runJob(makeJob(),d)).status,'recovery_pending');
 d.readSoftDeleted=async()=>{throw Error('permission denied');};
 assert.equal((await runJob(makeJob(),d)).status,'recovery_pending');
});
