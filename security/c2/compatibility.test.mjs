import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { normalizeRecord } from './prepare-plan.mjs';
import { planLinks, applyLink } from './linkage.mjs';
const require = createRequire(import.meta.url);
const { webMembership } = require('../../functions/storageWebAccessPolicy.cjs');
const bucket = 'reviewed-bucket';
const record = { database:'(default)', id:'ticket', updateTime:'revision-1', userId:'owner', storageDraft:false, urls:[`gs://${bucket}/work_orders/photo.jpg`] };
const object = { name:'work_orders/photo.jpg', generation:'10', metageneration:'2', metadata:{uploadedBy:'historical-untrusted'} };
test('only uniquely referenced objects get metadata plans; missing references remain held', () => {
 const p=planLinks({bucket,records:[record],objects:[object,{...object,name:'work_orders/unknown.jpg'}]});
 assert.equal(p.ready.length,1);assert.equal(p.held.length,1);
 assert.deepEqual(p.ready[0].patch,{securityVersion:'1',collection:'work_orders',recordId:'ticket'});
 assert.equal('uploadedBy' in p.ready[0].patch,false);
 assert.equal(planLinks({bucket,records:[record,{...record,id:'other'}],objects:[object]}).ready.length,0);
});
test('metadata apply preserves bytes, URLs and existing metadata, and replay is a no-op',async()=>{
 const item=planLinks({bucket,records:[record],objects:[object]}).ready[0];
 let writes=0;let current={...object,metadata:{...object.metadata,firebaseStorageDownloadTokens:'synthetic-token',other:'keep'}};
 const api={bucket,readParent:async()=>record,readObject:async()=>current,patchMetadata:async(name,metadata,conditions)=>{writes++;assert.deepEqual(conditions,{generation:'10',metageneration:'2'});current={...current,metageneration:'3',metadata};}};
 assert.equal(await applyLink(item,api),'applied');assert.equal(current.metadata.firebaseStorageDownloadTokens,'synthetic-token');assert.equal(current.metadata.other,'keep');assert.equal(current.metadata.uploadedBy,'historical-untrusted');
 assert.equal(await applyLink(item,api),'already-applied');assert.equal(writes,1);
});
test('changed parents/generations fail closed without writes',async()=>{
 const item=planLinks({bucket,records:[record],objects:[object]}).ready[0];let writes=0;
 const api={bucket,readParent:async()=>({...record,updateTime:'changed'}),readObject:async()=>object,patchMetadata:async()=>writes++};
 await assert.rejects(applyLink(item,api),/Parent changed/);api.readParent=async()=>record;api.readObject=async()=>({...object,generation:'20'});
 await assert.rejects(applyLink(item,api),/Object changed/);assert.equal(writes,0);
});
test('web projection never adopts missing approval, flags or alias roles',()=>{
 for(const role of ['admin','vip','crew','resident'])assert.deepEqual(webMembership({approved:true,role}),{approved:true,role});
 for(const p of [{role:'admin'},{approved:false,role:'admin'},{approved:true,role:'staff'},{approved:true,isAdmin:true},{approved:true,role:'admin',deletionPending:true},null])assert.deepEqual(webMembership(p),{approved:false,role:''});
});

test('optional attachment-only extraction never retains comment text or URL tokens',()=>{
 const r={database:'(default)',name:'projects/demo/databases/(default)/documents/work_orders/ticket',updateTime:'v1',fields:{userId:{stringValue:'owner'},comments:{arrayValue:{values:[{mapValue:{fields:{text:{stringValue:'PRIVATE_TEXT_SENTINEL'},photoUrl:{stringValue:'https://firebasestorage.googleapis.com/v0/b/reviewed-bucket/o/work_orders%2Fproof.jpg?alt=media&token=PRIVATE_TOKEN_SENTINEL'}}}}]}}}};
 assert.equal(normalizeRecord(r,bucket).urls.length,0);
 const extracted=normalizeRecord(r,bucket,{includeEmbedded:true});assert.deepEqual(extracted.urls,['gs://reviewed-bucket/work_orders/proof.jpg']);assert.equal(extracted.referenceScope,'embedded');assert.equal(JSON.stringify(extracted).includes('SENTINEL'),false);
});

test('post-write parent races require reconciliation and never roll back tokens or bytes',async()=>{
 const item=planLinks({bucket,records:[record],objects:[object]}).ready[0];let reads=0,writes=0;
 const api={bucket,readParent:async()=>++reads===1?record:{...record,updateTime:'changed'},readObject:async()=>object,patchMetadata:async()=>writes++};
 await assert.rejects(applyLink(item,api),e=>e.requiresReconciliation===true);assert.equal(writes,1);
});
