const {createHash}=require('node:crypto');
const {TARGETS}=require('./accountDeletionInventory.cjs');
const {objectHashes}=require('./deletionMediaReferences.cjs');
const {parentBlocksCleanup,trustedMedia}=require('./mediaCleanupPolicy.cjs');
const provenance=require('./deletionMediaProvenance.json');
const hash=value=>createHash('sha256').update(value).digest('hex');
async function hasLiveReference(dbFor,objectHash){
 for(const id of require('./accountDeletionScope.cjs').DATABASES)for(const target of TARGETS){let cursor;
  for(let page=0;;page++){if(page>=100)throw Error('inventory_bound');let q=(target.group?dbFor(id).collectionGroup(target.group):dbFor(id).collection(target.collection)).orderBy('__name__').limit(100);if(cursor)q=q.startAfter(cursor);const rows=await q.get();
   for(const doc of rows.docs)if((!target.group||/^inbox_conversations\/[^/]+\/messages\/[^/]+$/.test(doc.ref.path))&&objectHashes(doc.data()).includes(objectHash))return true;
   if(rows.size<100)break;cursor=target.group?rows.docs.at(-1).ref.path:rows.docs.at(-1).id;
  }
 }return false;
}
// Account-request jobs only. This never activates general orphan/draft cleanup.
async function processAccountMedia(control,job,{dbFor,bucket,mediaPolicy}) {
 if(job.review?.processingAuthorized!==true||job.review.decision!=='approved'||job.preflight?.jobId!==job.id||job.preflight.uid!==job.uid||job.preflight.holds?.length)throw Error('media_preflight_required');
 for(const databaseId of require('./accountDeletionScope.cjs').DATABASES){const db=dbFor(databaseId),jobs=await db.collection('media_cleanup_jobs').where('accountDeletionJobId','==',job.id).limit(100).get();
  for(const row of jobs.docs){const parent={...row.data(),databaseId};if(parent.status==='complete')continue;if(parent.uid!==job.uid||parent.databaseId!==databaseId)throw Error('media_scope_mismatch');
   if(parentBlocksCleanup(await db.doc(`${parent.collection}/${parent.recordId}`).get(),parent))throw Error('media_parent_restored');
   const manifest=job.preflight.manifest.filter(m=>m.databaseId===databaseId&&m.collection===parent.collection&&m.recordId===parent.recordId);
   if((parent.objectHashes||[]).some(h=>!manifest.some(m=>m.objectHash===h)))throw Error('media_manifest_mismatch');
   for(const item of manifest){if(item.alreadyAbsent)continue;
    if(provenance.quarantinedObjectHashes.includes(item.objectHash)||hash(item.name)!==item.objectHash)throw Error('quarantined_media');
    const file=bucket.file(item.name);let metadata;try{[metadata]=await file.getMetadata();}catch(error){if(error.code===404)continue;throw error;}
    if(metadata.generation!==item.generation||metadata.metageneration!==item.metageneration||metadata.metadata?.uploadedBy!==job.uid||!trustedMedia(metadata,parent,mediaPolicy))throw Error('media_provenance_changed');
    if(await hasLiveReference(dbFor,item.objectHash))throw Error('media_still_referenced');
    if(parentBlocksCleanup(await db.doc(`${parent.collection}/${parent.recordId}`).get(),parent))throw Error('media_parent_restored');
    await file.delete({ifGenerationMatch:item.generation,ifMetagenerationMatch:item.metageneration,ignoreNotFound:true});
   }
   await row.ref.update({status:'complete',lastAttemptAt:new Date(),completedAt:new Date()});
  }
 }
}
module.exports={processAccountMedia};
