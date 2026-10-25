/** Approved read-only projections. No content, message arrays, photos, tokens, or individual IDs are output/saved. */
const {createHash}=require('node:crypto');
const {WEB_DATABASE}=require('../../functions/storageWebAccessPolicy.cjs');
const {objectSha256}=require('../c2/quarantine-manifest.json');
const auth=require(process.env.TOWNLOOP_FIREBASE_AUTH_MODULE);
const project='cc-livingcommunity-app',bucket=project+'.firebasestorage.app';
const owners=['userId','authorId','ownerId','uploadedBy','sellerId','buyerId','residentId'];
const categories=['work_orders','discussion_feed','posts','marketplace_posts','marketItems','marketplace_chats','resident_chats','office_chats','maintenance_chats','newsletters'];
const decode=v=>v?.stringValue??(v?.integerValue!==undefined?Number(v.integerValue):undefined)??v?.booleanValue??v?.arrayValue?.values?.map(decode);
async function main(){
 const account=auth.getGlobalDefaultAccount();if(!account)throw Error('Existing authorized operator session unavailable');
 const t=await auth.getAccessToken(account.tokens.refresh_token,['https://www.googleapis.com/auth/cloud-platform','https://www.googleapis.com/auth/firebase']);
 async function api(url,body){const r=await fetch(url,{headers:{Authorization:'Bearer '+t.access_token,'Content-Type':'application/json'},...(body?{method:'POST',body:JSON.stringify(body)}:{})});if(!r.ok){const e=new Error('Metadata HTTP '+r.status);e.status=r.status;throw e;}return r.json();}
 async function rows(db,collection,fields){const all=[];let cursor;
  for(let page=0;page<100;page++){
   const q={from:[{collectionId:collection}],select:{fields:fields.map(fieldPath=>({fieldPath}))},orderBy:[{field:{fieldPath:'__name__'},direction:'ASCENDING'}],limit:100,...(cursor?{startAt:{values:[{referenceValue:cursor}],before:false}}:{})};
   const result=await api(`https://firestore.googleapis.com/v1/projects/${project}/databases/${db}/documents:runQuery`,{structuredQuery:q});
   const docs=result.flatMap(x=>x.document?[x.document]:[]);all.push(...docs);if(docs.length<100)return all;cursor=docs.at(-1).name;
  }throw Error('Approved scan bound reached; no wider scan attempted');
 }
 const profiles=new Map(),summary={project,checkedAt:new Date().toISOString(),databases:[],storage:{},backups:{},noContentRead:true};
 for(const db of ['(default)',WEB_DATABASE])profiles.set(db,new Set((await rows(db,'users',['__name__'])).map(x=>x.name.split('/').at(-1))));
 for(const db of ['(default)',WEB_DATABASE]){
  const dbSummary={database:db,profileIdentityCount:profiles.get(db).size,categories:[]},parents=new Map();
  for(const collection of categories){
   const fields=[...owners,'participantIds','identityVersion','storageDraft','photoUrl','pdfUrl','resolutionAuthorId','deletionExpiresAt'];
   const docs=await rows(db,collection,fields),count={collection,total:docs.length,verifiedProfileOwner:0,missingOrConflictingOwner:0,canonicalParticipants:0,legacyOrUnclassifiedChat:0,bearerTopLevelReferences:0};
   for(const doc of docs){const d=Object.fromEntries(Object.entries(doc.fields||{}).map(([k,v])=>[k,decode(v)]));const id=doc.name.split('/').at(-1);const owning=collection==='newsletters'?[]:['resident_chats','office_chats','maintenance_chats','marketplace_chats'].includes(collection)?[]:['work_orders','discussion_feed','posts','marketplace_posts','marketItems'].includes(collection)?[d.userId,d.authorId].filter(Boolean):owners.map(k=>d[k]).filter(Boolean);
    const distinct=[...new Set(owning)];const proven=distinct.length===1&&profiles.get(db).has(distinct[0]);
    if(proven)count.verifiedProfileOwner++;else count.missingOrConflictingOwner++;
    parents.set(collection+'/'+id,{uid:proven?distinct[0]:null});
    if(collection.endsWith('_chats')){const ids=d.participantIds;if(d.identityVersion===2&&Array.isArray(ids)&&ids.length===2&&ids[0]!==ids[1]&&ids.every(x=>profiles.get(db).has(x)))count.canonicalParticipants++;else count.legacyOrUnclassifiedChat++;}
    for(const key of ['photoUrl','pdfUrl'])if(typeof d[key]==='string'){try{const u=new URL(d[key]);if(u.hostname==='firebasestorage.googleapis.com'&&u.searchParams.has('token'))count.bearerTopLevelReferences++;}catch{}}
   }dbSummary.categories.push(count);
  }dbSummary.parents=parents;summary.databases.push(dbSummary);
 }
 const left=profiles.get('(default)'),right=profiles.get(WEB_DATABASE);summary.sharedExactProfileUids=[...left].filter(x=>right.has(x)).length;
 let pageToken;const objects=[];
 do{const params=new URLSearchParams({maxResults:'1000',fields:'nextPageToken,items(name,metadata(uploadedBy,securityVersion,recordId,collection,storageDatabase))',...(pageToken?{pageToken}:{})});const r=await api(`https://storage.googleapis.com/storage/v1/b/${bucket}/o?${params}`);objects.push(...r.items||[]);pageToken=r.nextPageToken;if(objects.length>10000)throw Error('Storage scan bound reached');}while(pageToken);
 const st={total:objects.length,quarantined:0,verifiedParentOwner:0,unverifiedOrNonParentObjects:0,folders:{}};
 for(const o of objects){const folder=o.name.split('/')[0];st.folders[folder]=(st.folders[folder]||0)+1;if(objectSha256.includes(createHash('sha256').update(o.name).digest('hex'))){st.quarantined++;continue;}
  const m=o.metadata||{},db=m.storageDatabase||'(default)',parent=summary.databases.find(d=>d.database===db)?.parents.get(m.collection+'/'+m.recordId);
  if(m.securityVersion==='1'&&parent?.uid&&m.uploadedBy===parent.uid)st.verifiedParentOwner++;else st.unverifiedOrNonParentObjects++;
 }summary.storage=st;for(const d of summary.databases)delete d.parents;
 for(const db of ['(default)',WEB_DATABASE]){
  const info=await api(`https://firestore.googleapis.com/v1/projects/${project}/databases/${db}`);
  const schedules=await api(`https://firestore.googleapis.com/v1/projects/${project}/databases/${db}/backupSchedules`).catch(e=>({unverifiedHTTP:e.status}));
  summary.backups[db]={pointInTimeRecoveryEnablement:info.pointInTimeRecoveryEnablement||'unspecified',versionRetentionPeriod:info.versionRetentionPeriod,backupSchedules:schedules.unverifiedHTTP?schedules:(schedules.backupSchedules||[]).map(s=>({retention:s.retention,daily:!!s.dailyRecurrence,weekly:!!s.weeklyRecurrence}))};
 }
 const b=await api(`https://storage.googleapis.com/storage/v1/b/${bucket}?fields=versioning,softDeletePolicy,retentionPolicy,lifecycle`);summary.backups.storage=b;
 const copies=await api(`https://storage.googleapis.com/storage/v1/b?project=${project}&fields=items(name,versioning,softDeletePolicy,retentionPolicy,lifecycle),nextPageToken`);
 summary.backups.projectBuckets=(copies.items||[]).map(b=>({isApplicationBucket:b.name===bucket,isReleaseBackup:/backup/i.test(b.name),versioning:b.versioning,softDeletePolicy:b.softDeletePolicy,retentionPolicy:b.retentionPolicy,lifecycle:b.lifecycle}));
 summary.backups.bucketInventoryComplete=!copies.nextPageToken;
 console.log(JSON.stringify(summary,null,2));
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
