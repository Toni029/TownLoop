/** READ ONLY. Uses an existing OAuth session supplied in memory/environment. */
import fs from 'node:fs';
import path from 'node:path';
import { normalizeRecord, prepare } from './prepare-plan.mjs';
const project='cc-livingcommunity-app',bucket=project+'.firebasestorage.app',web='ai-studio-cclivingv27-5fc1a0f6-cd75-4964-8c9e-e219a265f7bb';
const token=process.env.TOWNLOOP_METADATA_ACCESS_TOKEN;if(!token)throw Error('Existing authorized OAuth token required in environment');
const embedded=process.argv.includes('--approved-embedded-reference-extraction');
if(embedded&&(!process.argv.includes('--approval')||!process.argv[process.argv.indexOf('--approval')+1]))throw Error('Separate reference-extraction approval required');
const output=process.argv[2];if(!output)throw Error('Supply a private output directory outside Git');
async function call(url,body){const r=await fetch(url,{headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{method:'POST',body:JSON.stringify(body)}:{})});if(!r.ok)throw Error('Read-only metadata HTTP '+r.status);return r.json();}
const objects=[],records=[],memberships=[];let pageToken;
do{const q=new URLSearchParams({fields:'nextPageToken,items(name,generation,metageneration,size,contentType,timeCreated,metadata(uploadedBy,securityVersion,recordId,collection,storageDatabase))',maxResults:'1000',...(pageToken?{pageToken}:{})});const result=await call(`https://storage.googleapis.com/storage/v1/b/${bucket}/o?${q}`);objects.push(...result.items||[]);pageToken=result.nextPageToken;}while(pageToken);
for(const database of ['(default)',web]){
 const base=`https://firestore.googleapis.com/v1/projects/${project}/databases/${database}/documents:runQuery`;
 const rows=await call(base,{structuredQuery:{from:[{collectionId:'work_orders'}],select:{fields:['userId','photos','photoUrl','latestResolutionPhoto','storageDraft',...(embedded?['comments']:[])].map(fieldPath=>({fieldPath}))}}});
 for(const row of rows){if(!row.document)continue;const r={database,...row.document};const n=normalizeRecord(r,bucket,{includeEmbedded:embedded}); // Discard URL query tokens before any persistence.
  records.push({database,...(embedded?{referenceScope:'embedded'}:{}),name:r.name,updateTime:r.updateTime,fields:{userId:{stringValue:n.userId||''},storageDraft:{booleanValue:n.storageDraft},photos:{arrayValue:{values:n.urls.map(stringValue=>({stringValue}))}}}});
 }
 const people=await call(base,{structuredQuery:{from:[{collectionId:'users'}],select:{fields:['role','approved','deletionPending'].map(fieldPath=>({fieldPath}))}}});
 for(const row of people)if(row.document)memberships.push({database,name:row.document.name,readTime:row.readTime,fields:row.document.fields||{}});
}
const snapshot={project,bucket,objects,records,memberships},plan=prepare(snapshot);
fs.mkdirSync(output,{recursive:true,mode:0o700});
for(const [file,data]of [['snapshot.private.json',snapshot],['linkage-plan.private.json',plan]]){const filePath=path.join(output,file);fs.writeFileSync(filePath,JSON.stringify(data),{mode:0o600});fs.chmodSync(filePath,0o600);}
console.log(JSON.stringify({objectsChecked:objects.length,workOrderAttachments:objects.filter(o=>o.name.startsWith('work_orders/')).length,verifiedLinksReady:plan.payload.ready.length,held:plan.payload.held.length,photoBodiesDownloaded:0,commentBodiesReadInMemory:embedded,objectTokenMetadataRequested:false}));
