'use strict';
// Pure preparation + dependency-injected worker. Importing never registers or enables a trigger.
const {createHash}=require('node:crypto');
const {trustedMedia}=require('./mediaCleanupPolicy.cjs');
const {canonicalPath,references}=require('./databaseCleanupStorage.cjs');
const {protectedRecord}=require('./databaseCleanup.cjs');
const BUCKET='cc-livingcommunity-app.firebasestorage.app';
const FOLDERS=Object.freeze({marketplace_posts:'marketplace',discussion_feed:'feed'});
const AGE_MS=48*60*60*1000;
const hash=value=>createHash('sha256').update(value).digest('hex');
const uidValid=value=>typeof value==='string'&&!!value&&!value.includes('/')&&value.length<=128;
function owner(data){const ids=['userId','authorId','uid','ownerId'].map(k=>data?.[k]).filter(v=>v!=null);return ids.length&&ids.every(uidValid)&&new Set(ids).size===1?ids[0]:null;}
function attachments(data){return Object.fromEntries(['media','mediaUrl','itemMediaUrl','photoUrl','photos','videoUrl','videos','imageUrl','attachments'].filter(key=>data?.[key]!=null).map(key=>[key,data[key]]));}
function eventJob({databaseId,collection,recordId,eventId,before,after,now=Date.now()}){
 if(!FOLDERS[collection]||!databaseId||!/^[A-Za-z0-9_-]{1,128}$/.test(recordId||'')||!eventId)throw Error('Invalid social scope');
 if(!before)return null;
 const old=references(attachments(before)),next=after?references(attachments(after)):{paths:[],unknown:[]};
 const paths=old.paths.filter(path=>!next.paths.includes(path));
 if(after&&!paths.length&&!old.unknown.some(value=>!next.unknown.includes(value)))return null;
 const uid=owner(before),hold=!uid?'ownership_unverified':protectedRecord(before,now)||after&&protectedRecord(after,now)?'protected_record':old.unknown.some(value=>!next.unknown.includes(value))?'ambiguous_reference':null;
 return {id:hash(JSON.stringify([databaseId,collection,recordId,eventId])),databaseId,collection,recordId,uid:uid||'',mode:after?'detached':'deleted',paths:paths.slice(0,200),hold:paths.length>200?'inventory_incomplete':hold,status:'queued',notBefore:now,createdAt:now};
}
function orphanJob(metadata,databaseId,now=Date.now()){
 const custom=metadata?.metadata,created=Date.parse(metadata?.timeCreated);
 if(!FOLDERS[custom?.collection]||canonicalPath(metadata.name)!==metadata.name||!metadata.name.startsWith(`${FOLDERS[custom.collection]}/`)||!/^[A-Za-z0-9_-]{1,128}$/.test(custom.recordId||''))return null;
 return {id:hash(JSON.stringify(['orphan',databaseId,metadata.name,metadata.generation||'unknown'])),databaseId,collection:custom.collection,recordId:custom.recordId,uid:uidValid(custom.uploadedBy)?custom.uploadedBy:'',mode:'orphan',paths:[metadata.name],generation:String(metadata.generation||''),hold:Number.isFinite(created)?null:'untrusted_creation_time',notBefore:Number.isFinite(created)?created+AGE_MS:now,createdAt:now,status:'queued'};
}
function inspectObject(metadata,parent,policy,bucketPolicy,now=Date.now()){
 if(bucketPolicy?.versioning?.enabled===true||Number(bucketPolicy?.retentionPolicy?.retentionPeriod)>0||metadata.temporaryHold===true||metadata.eventBasedHold===true||metadata.retention!=null||metadata.retentionExpirationTime&&(!Number.isFinite(Date.parse(metadata.retentionExpirationTime))||Date.parse(metadata.retentionExpirationTime)>now)||protectedRecord(metadata.metadata||{},now)||metadata.metadata?.quarantined==='true'||metadata.metadata?.quarantine==='true')return 'protected_record';
 if(!FOLDERS[parent.collection]||metadata.bucket!==BUCKET||canonicalPath(metadata.name)!==metadata.name||!/^[1-9]\d*$/.test(String(metadata.generation||''))||!/^[1-9]\d*$/.test(String(metadata.metageneration||''))||!uidValid(parent.uid)||metadata.metadata?.uploadedBy!==parent.uid||!trustedMedia(metadata,parent,policy))return 'ownership_unverified';
 return null;
}
/** Recovery proof uses generation-qualified normal and soft-deleted GETs, never active-name 404 alone. */
async function reconcileRecovery(record,deps,now){
 let updated={...record,status:'pending'};
 try{
  if(!deps.readSoftDeleted||!deps.readGeneration||!deps.persistRecovery)return updated;
  const soft=await deps.readSoftDeleted(record.path,record.generation);
  if(soft){
   const hardDeleteAt=Date.parse(soft.hardDeleteTime),softDeleteAt=Date.parse(soft.softDeleteTime);
   if(soft.bucket===BUCKET&&soft.name===record.path&&String(soft.generation)===record.generation&&Number.isFinite(hardDeleteAt)&&Number.isFinite(softDeleteAt)&&hardDeleteAt>=softDeleteAt){
    updated={...updated,hardDeleteAt,softDeleteAt,activeRemoved:true};
   }
  }else if(Number.isFinite(record.hardDeleteAt)&&record.hardDeleteAt>0&&now>=record.hardDeleteAt&&await deps.readGeneration(record.path,record.generation)===null){
   updated={...updated,status:'verified_expired',verifiedExpiredAt:now,activeRemoved:true};
  }
  await deps.persistRecovery(updated);
 }catch{ /* Permission/transport/inconsistent metadata never proves recovery expiry. */ }
 return updated;
}
async function runJob(job,deps){
 const {now=Date.now}=deps,result={status:'retained',deleted:0,missing:0,deletedPaths:[],missingPaths:[],unresolved:[]};
 const hold=(path,reason)=>result.unresolved.push({path,reason});
 if(job.notBefore>now())return {...result,status:'queued'};
 if(job.hold){hold('',job.hold);return result;}
 if(!FOLDERS[job.collection]||!['deleted','detached','orphan'].includes(job.mode)){hold('','invalid_scope');return result;}
 if(!deps.withReferenceFence){hold('','reference_writers_unfenced');return result;}
 try{
  await deps.withReferenceFence(async assertFrozen=>{
   if(!await assertFrozen())throw Error('reference_writers_unfenced');
   const parent=await deps.readParent(job);
   if(deps.hasEvidence&&await deps.hasEvidence(job)){hold('','reported_evidence');return;}
   if(job.mode==='deleted'&&parent){hold('','parent_restored');return;}
   if(parent&&protectedRecord(parent,now())){hold('','protected_record');return;}
   const recovery=deps.readRecovery?await deps.readRecovery():job.recovery||[];
   const candidates=[...new Set([...job.paths,...recovery.map(row=>row.path),...(job.mode==='deleted'?await deps.listOwned(job):[])])];
   if(candidates.length>200)throw Error('inventory_incomplete');
   const policy=await deps.readPolicy(),bucketPolicy=await deps.readBucket();
   for(const path of candidates){
    if(!path.startsWith(`${FOLDERS[job.collection]}/`)){hold(path,'ownership_unverified');continue;}
    let metadata=await deps.readObject(path),pending=recovery.find(row=>row.path===path);
    if(pending&&(pending.activeRemoved===true||!metadata)){
     const proof=await reconcileRecovery(pending,deps,now());
     if(proof.status!=='verified_expired')hold(path,'recovery_pending');
     if(metadata&&String(metadata.generation)!==pending.generation)hold(path,'object_changed');
     continue;
    }
    if(pending&&String(metadata.generation)!==pending.generation){hold(path,'object_changed');continue;}
    if(!metadata){if(Number(bucketPolicy?.softDeletePolicy?.retentionDurationSeconds)>0)hold(path,'recovery_generation_unknown');else{result.missing++;result.missingPaths.push(path);}continue;}
    const reason=metadata.name!==path?'ownership_unverified':job.mode==='orphan'&&String(metadata.generation)!==job.generation?'object_changed':inspectObject(metadata,job,policy,bucketPolicy,now());
    if(reason){hold(path,reason);continue;}
    const refs=await deps.scanReferences(path);
    if(refs.shared||refs.ambiguous){hold(path,refs.shared?'shared_reference':'ambiguous_reference');continue;}
    // The fence is held across the entire inventory and Storage request. Rechecking alone is insufficient.
    await deps.assertLease();if(!await assertFrozen())throw Error('reference_writers_unfenced');
    const softSeconds=Number(bucketPolicy?.softDeletePolicy?.retentionDurationSeconds)||0;
    if(softSeconds>0&&!pending){
     if(!deps.persistRecovery){hold(path,'recovery_tracking_unavailable');continue;}
     pending={path,generation:String(metadata.generation),metageneration:String(metadata.metageneration),expectedRecoveryUntil:now()+softSeconds*1000,hardDeleteAt:null,softDeleteAt:null,activeRemoved:false,status:'pending'};
     await deps.persistRecovery(pending);
    }
    try{await deps.deleteObject(path,{ifGenerationMatch:String(metadata.generation),ifMetagenerationMatch:String(metadata.metageneration)});result.deleted++;result.deletedPaths.push(path);if(pending){pending={...pending,activeRemoved:true};await deps.persistRecovery(pending);const proof=await reconcileRecovery(pending,deps,now());if(proof.status!=='verified_expired')hold(path,'recovery_pending');}}
    catch(error){if(error.code===404){if(pending){const proof=await reconcileRecovery(pending,deps,now());if(proof.status!=='verified_expired')hold(path,'recovery_pending');}else{result.missing++;result.missingPaths.push(path);}continue;}if(error.code===412){hold(path,'object_changed');continue;}throw error;}
   }
  });
 }catch(error){hold('',/^(reference_writers_unfenced|inventory_incomplete|in_flight_deletion|cleanup_lease_lost)$/.test(error.message)?error.message:'retry_required');}
 result.status=result.unresolved.length?(result.unresolved.every(row=>row.reason==='recovery_pending')?'recovery_pending':'retained'):'complete';return result;
}
module.exports={BUCKET,FOLDERS,AGE_MS,eventJob,orphanJob,inspectObject,runJob,reconcileRecovery};
