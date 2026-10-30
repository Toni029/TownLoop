const {createHash}=require('node:crypto');
const {DATABASES}=require('./accountDeletionScope.cjs');
const {trustedMedia}=require('./mediaCleanupPolicy.cjs');
const {processAccountMedia}=require('./accountDeletionMedia.cjs');
const provenance=require('./deletionMediaProvenance.json');
// Resumable uploads accepted before revocation can finish later. Reconcile under
// the same root lease before Auth removal and during the finite receipt window.
async function reconcileLateAccountMedia(control,ref,job,{dbFor,bucket,mediaPolicy,now=Date.now()}){
 if(job.preflight?.jobId!==job.id||job.preflight.uid!==job.uid||job.preflight.holds?.length||job.review?.processingAuthorized!==true)throw Error('media_preflight_required');
 const parents=[];
 for(const databaseId of DATABASES){let cursor;for(let page=0;;page++){
  if(page>=100)throw Error('inventory_bound');let query=dbFor(databaseId).collection('media_cleanup_jobs').where('accountDeletionJobId','==',job.id).orderBy('__name__').limit(100);if(cursor)query=query.startAfter(cursor);const rows=await query.get();
  for(const row of rows.docs){const data=row.data();if(data.uid!==job.uid||data.databaseId!==databaseId)throw Error('media_scope_mismatch');parents.push({row,parent:data});}
  if(rows.size<100)break;cursor=rows.docs.at(-1).id;
 }}
 let pageToken,changed=false;const manifest=[...job.preflight.manifest];
 for(let page=0;;page++){
  if(page>=100)throw Error('inventory_bound');const [files,next]=await bucket.getFiles({autoPaginate:false,maxResults:100,...(pageToken?{pageToken}:{})});
  for(const file of files){let metadata;try{metadata=file.metadata?.generation?file.metadata:(await file.getMetadata())[0];}catch(error){if(error.code===404)continue;throw error;}
   if(metadata.metadata?.uploadedBy!==job.uid&&metadata.metadata?.ownerUid!==job.uid)continue;
   const objectHash=createHash('sha256').update(metadata.name).digest('hex');if(provenance.quarantinedObjectHashes.includes(objectHash))throw Error('quarantined_attachment_preserved');
   const matches=parents.filter(({parent})=>parent.collection===metadata.metadata?.collection&&parent.recordId===metadata.metadata?.recordId&&metadata.metadata?.uploadedBy===job.uid&&trustedMedia(metadata,parent,mediaPolicy));
   if(matches.length!==1||!metadata.metageneration)throw Error('late_media_ownership_requires_review');
   const {parent}=matches[0],entry={objectHash,name:metadata.name,generation:metadata.generation,metageneration:metadata.metageneration,databaseId:parent.databaseId,collection:parent.collection,recordId:parent.recordId};
   const index=manifest.findIndex(m=>m.objectHash===objectHash);if(index>=0)manifest[index]=entry;else manifest.push(entry);
   if(manifest.length>100)throw Error('preflight_receipt_bound');changed=true;
  }
  pageToken=next?.pageToken;if(!pageToken)break;
 }
 if(!changed)return;
 const proof={...job.preflight,manifest,lateMediaDetectedAt:new Date(now)};
 // Persist proof before requeuing; a crash at either write is safely replayed.
 await ref.update({preflight:proof});
 for(const {row,parent}of parents)if(manifest.some(m=>m.databaseId===parent.databaseId&&m.collection===parent.collection&&m.recordId===parent.recordId&&!m.alreadyAbsent))await row.ref.update({status:'queued',lastAttemptAt:new Date(now)});
 await processAccountMedia(control,{...job,preflight:proof},{dbFor,bucket,mediaPolicy});
}
module.exports={reconcileLateAccountMedia};
