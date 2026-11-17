'use strict';
const {createHash}=require('node:crypto');
const CATEGORIES=Object.freeze({workOrders:['work_orders','work_order_numbers'],discussion:['discussion_feed','posts'],marketplace:['marketplace_posts','marketItems','marketplace_chats'],newsletters:['newsletters','community_events','community_highlights','newsletter_analysis_jobs']});
const FIELDS=['legalHold','evidenceHold','retentionHold','hold','holds','retention','retainUntil','retentionUntil','deleteAfter','evidence','reported','reportId','reportIds','isAiExtracted','newsletterId','state','status','retentionVersion','completedAt','retentionDueAt','retentionExpiresAt','collection','id'];
const BUCKET='cc-livingcommunity-app.firebasestorage.app';
const fail=(code,message)=>{throw Object.assign(Error(message),{code});};
const hash=x=>createHash('sha256').update(x).digest('hex');
// This module accepts read capabilities only. No cleanup engine, job, write or delete API is used.
function createReadOnlyInventory({read,children,list,files,bucketPolicy,identity,now=Date.now,maxDocuments=2500,maxFiles=1000}){
 return async(uid,input)=>{
  if(!uid)fail('unauthenticated','Sign in with an approved Admin account.');
  const [user,revoked,auth]=await Promise.all([read(`users/${uid}`,['role','approved','deletionPending']),read(`account_access_revocations/${uid}`,['createdAt']),identity(uid)]);
  if(auth.disabled||revoked.exists||user.data?.role!=='admin'||user.data?.approved!==true||user.data?.deletionPending===true)fail('permission-denied','A currently approved Admin account is required.');
  if(input?.action!=='preview')fail('failed-precondition','This service is read-only. Cleanup jobs and deletion are disabled.');
  const categories=Object.keys(CATEGORIES).filter(k=>input.categories?.includes(k));
  if(!Array.isArray(input.categories)||!categories.length||categories.length!==input.categories.length)fail('invalid-argument','Select valid categories.');
  const cursor=input.cursor??0;if(!Number.isInteger(cursor)||cursor<0||cursor>maxFiles)fail('invalid-argument','Invalid file preview page.');
  let visited=0;const deadline=now()+75000,counts={},storageScope={},items=[],rootIds=new Set();
  const bound=()=>{if(++visited>maxDocuments||now()>deadline)fail('resource-exhausted','Read-only inventory exceeded its safety limit. Select fewer categories; no data was changed.');};
  const activeAnalysis=categories.includes('newsletters')?(await list('newsletter_analysis_jobs')).some(row=>['queued','running','retrying'].includes(row.data?.state)):false;
  const held=data=>FIELDS.some(k=>/Hold$|^hold$|^holds$|^retention$|^evidence$|^reported$|^reportId/.test(k)&&data[k]!=null&&data[k]!==false&&data[k]!=='' )||data.retentionVersion!=null||['retainUntil','retentionUntil','deleteAfter','retentionDueAt','retentionExpiresAt'].some(k=>data[k]!=null);
  const reports=new Set((await list('moderation_reports')).map(row=>JSON.stringify([row.data?.collection,row.data?.id])));
  async function subtree(path,depth=0,listed){
   bound();if(depth>8)fail('resource-exhausted','Nested inventory exceeds the safe preview limit. No data was changed.');
   const snap=typeof listed?.exists==='boolean'?listed:await read(path,FIELDS);let documents=snap.exists?1:0,protectedData=snap.exists&&held(snap.data);
   // Root traversal stays serial. At most four child branches run together;
   // deeper traversal is serial so concurrency never multiplies with depth.
   for(const collection of await children(path)){
    const rows=await list(collection),batchSize=depth===0?4:1;
    for(let offset=0;offset<rows.length;offset+=batchSize){
     const results=await Promise.all(rows.slice(offset,offset+batchSize).map(row=>subtree(row.path,depth+1,row)));
     for(const result of results){documents+=result.documents;protectedData ||= result.protectedData;}
    }
   }
   return{documents,protectedData};
  }
  for(const category of categories){
   const count=counts[category]={records:0,documents:0,deleted:0,held:0,failed:0,remaining:0,storageDeleted:0,storageHeld:0};
   for(const collection of CATEGORIES[category])for(const row of await list(collection)){
    const snap=typeof row.exists==='boolean'?row:await read(row.path,FIELDS),data=snap.data||{};
    let ambiguous=false;
    if(['community_events','community_highlights'].includes(collection)){
     if(data.isAiExtracted!==true)continue;
     ambiguous=typeof data.newsletterId!=='string'||!data.newsletterId||data.newsletterId.includes('/')||!(await read(`newsletters/${data.newsletterId}`,['id'])).exists;
    }
    const tree=await subtree(row.path,0,snap);rootIds.add(row.path);count.records++;count.documents+=tree.documents;count.remaining+=tree.documents;
    const reported=reports.has(JSON.stringify([collection,row.path.split('/')[1]]));
    if(collection==='marketplace_chats'||tree.protectedData||ambiguous||reported||category==='newsletters'&&activeAnalysis)count.held++;
   }
   const policy=await bucketPolicy();
   const scope=storageScope[category]={files:0,bytes:0,exclusive:0,held:0,missing:0,remaining:0,reasons:[]};
   const prefix={workOrders:'work_orders/',discussion:'feed/',marketplace:'marketplace/',newsletters:'newsletters/'}[category];
   const seen=new Set();
   for(const mode of ['current','versions','softDeleted'])for(const file of await files(prefix,mode,maxFiles)){
    const metadata=file.metadata||{},generation=String(metadata.generation||''),key=file.name+'\0'+generation;
    if(seen.has(key))continue;seen.add(key);
    if(items.length>=maxFiles||now()>deadline)fail('resource-exhausted','File preview exceeded its safe limit. Select fewer categories. No data was changed.');
    if(typeof file.name!=='string'||file.name.length>1024||/[?#\\\x00-\x1f\x7f]/.test(file.name)||!file.name.startsWith(prefix)||file.name.split('/').some(p=>!p||p==='.'||p==='..'))fail('failed-precondition','A file path requires operator review. No data was changed.');
    const md=metadata.metadata||{},owner=`${md.collection}/${md.recordId}`;
    const provenance=md.securityVersion==='1'&&!!md.uploadedBy&&rootIds.has(owner)&&CATEGORIES[category].includes(md.collection);
    const protectedFile=policy.versioning?.enabled||Number(policy.softDeletePolicy?.retentionDurationSeconds)>0||Number(policy.retentionPolicy?.retentionPeriod)>0||metadata.temporaryHold||metadata.eventBasedHold||metadata.retention||metadata.softDeleteTime;
    const reason=protectedFile?'protected_record':!provenance?'ownership_unverified':'read_only_execution_disabled';
    const bytes=Number(metadata.size);if(!Number.isSafeInteger(bytes)||bytes<0)fail('failed-precondition','File size could not be verified. No data was changed.');
    items.push({path:file.name,category,status:'held',bytes,reason,...(/^\d+$/.test(generation)?{generation}:{})});scope.files++;scope.bytes+=bytes;scope.held++;scope.remaining++;
    let record=scope.reasons.find(r=>r.code===reason);if(!record){record={code:reason,count:0};scope.reasons.push(record);}record.count++;
   }
   count.storageHeld=scope.held;
  }
  items.sort((a,b)=>a.category.localeCompare(b.category)||a.path.localeCompare(b.path)||String(a.generation).localeCompare(String(b.generation)));
  return{id:'readonly_'+hash(JSON.stringify(categories)).slice(0,40),readOnly:true,state:'review',categories,counts,storageScope,confirmationPhrase:'DELETE SELECTED DATA',enabled:false,completeInventory:true,message:'Live read-only inventory. No cleanup job was created. All deletion is disabled. Counts can change as residents use TownLoop; file exclusivity is not certified by this preview. Marketplace conversations are counted as candidates and held pending authoritative listing and content verification.',filePage:{items:items.slice(cursor,cursor+100),...(items.length>cursor+100?{nextCursor:String(cursor+100)}:{})}};
 };
}
module.exports={createReadOnlyInventory,CATEGORIES,BUCKET,FIELDS};
