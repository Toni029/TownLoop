const {objectHashes}=require('./deletionMediaReferences.cjs');
const {createHmac}=require('node:crypto');
const { FieldPath, FieldValue } = require('firebase-admin/firestore');
const { jobIdFor, referencesUid } = require('./accountDeletionPolicy.cjs');
const retention = require('./accountDeletionRetention.cjs');
const {INVENTORY_VERSION,TARGETS,legacyPathReferencesUid,inventoryReferencesUid}=require('./accountDeletionInventory.cjs');
const timestamp = () => FieldValue.serverTimestamp();
/** Bounded durable phases. Called only through the existing leased, disabled worker. */
async function processRetentionStep(db, auth, ref, job, scope = {}) {
  const uid = job.uid, dates = retention.deadlines(job.createdAt, job.review?.reviewedAt);
  if (dates.requiresDeadlineReview || !Number.isFinite(retention.millis(job.review?.reviewedAt))) { await ref.update({status:'needs_review',lastError:'missing_submission_time'}); return; }
  const policy = scope.policy || (await db.doc('deletion_policies/account').get()).data();
  if (!retention.policyReady(policy) || job.review?.policyReference !== policy.approvalReference) {
    await ref.update({status:'pending_owner_approval',lastError:'policy_changed_or_incomplete'}); return;
  }
  if (job.phase === 'requested' || job.phase === 'disable') {
    const profile = await db.doc(`users/${uid}`).get(), batch = db.batch();
    if(profile.exists) batch.update(profile.ref,{deletionPending:true,...(scope.databaseId?{approved:false}:{})});
    batch.delete(db.doc(`resident_directory/${uid}`));
    batch.update(ref,{phase:'v2_inventory',status:'processing',collectionIndex:0,cursor:'',inventoryVersion:INVENTORY_VERSION,...dates});await batch.commit();return;
  }
  if(job.phase==='v2_inventory') {
    const target=TARGETS[job.collectionIndex],collection=target?.collection;
    if(!collection){await ref.update({phase:'v2_redact',inventoryComplete:true,inventoryVersion:INVENTORY_VERSION});return;}
    let query=(target.group?db.collectionGroup(target.group):db.collection(collection)).orderBy(FieldPath.documentId()).limit(100);if(job.cursor)query=query.startAfter(job.cursor);
    const page=await query.get(),batch=db.batch();
    for(const record of page.docs)if((!target.group||/^inbox_conversations\/[^/]+\/messages\/[^/]+$/.test(record.ref.path))&&inventoryReferencesUid(record.ref.path,record.data(),uid))batch.set(ref.collection('inventory').doc(jobIdFor(record.ref.path)),{path:record.ref.path,collection,state:'pending_redaction',expiresAt:new Date(dates.retentionDueAt)});
    batch.update(ref,page.size<100?{collectionIndex:job.collectionIndex+1,cursor:''}:{cursor:target.group?page.docs.at(-1).ref.path:page.docs.at(-1).id});await batch.commit();return;
  }
  if(job.phase==='v2_redact') {
    const page=await ref.collection('inventory').where('state','==','pending_redaction').limit(50).get();
    for(const receipt of page.docs)await db.runTransaction(async tx=>{
      const current=await tx.get(receipt.ref);if(current.data()?.state!=='pending_redaction')return;
      const path=current.data().path, recordRef=db.doc(path), record=await tx.get(recordRef);
      if(!record.exists){tx.update(receipt.ref,{state:'already_absent'});return;}
      // A UID in a legacy document ID needs a reviewed relocation, not a data-only patch.
      if(legacyPathReferencesUid(path,uid)){tx.update(receipt.ref,{state:'needs_review',reason:'legacy_identity_in_record_path'});return;}
      const before=record.data(), plan=retention.plan(current.data().collection,before,uid,scope.redactionKey?`deleted_${createHmac('sha256',scope.redactionKey).update(`${scope.databaseId}/${path}/${uid}`).digest('hex').slice(0,24)}`:undefined);
      // Reports currently reference live content, not an independent evidence snapshot.
      // Preserve the source and attachments until an explicit evidence disposition exists.
      const reports=await tx.get(db.collection('moderation_reports').where('collection','==',current.data().collection).where('id','==',record.id).limit(1));
      if(!reports.empty){tx.update(receipt.ref,{state:'needs_review',reason:'reported_evidence_requires_disposition'});return;}
      if(plan.action==='review'){tx.update(receipt.ref,{state:'needs_review',reason:plan.reason});return;}
      const after=['replace','replace_audit'].includes(plan.action)?plan.data:{...before,...plan.patch};
      if(!['delete_parent','delete_record'].includes(plan.action)&&referencesUid(after,uid)){tx.update(receipt.ref,{state:'needs_review',reason:'unresolved_identity_fields'});return;}
      if(plan.action==='delete_record'){tx.delete(recordRef);tx.update(receipt.ref,{state:'redacted'});return;}
      if(plan.action==='delete_parent') {
        const cleanupJobId=jobIdFor(`account:${ref.path}:${path}`),cleanup=db.doc(`media_cleanup_jobs/${cleanupJobId}`),existing=await tx.get(cleanup);
        if(!existing.exists)tx.create(cleanup,{collection:current.data().collection,recordId:record.id,uid,accountDeletionJobId:ref.path.split('/').at(-1),...(scope.databaseId?{databaseId:scope.databaseId,expiresAt:new Date(dates.retentionDueAt),objectHashes:objectHashes(before)}:{}),status:'queued',pageToken:'',createdAt:timestamp(),lastAttemptAt:timestamp()});
        tx.set(db.doc(`media_deletion_tombstones/${current.data().collection}/records/${record.id}`),{deletedAt:timestamp()});
        tx.delete(recordRef);tx.update(receipt.ref,{state:'redacted',cleanupJobId});
      }else{
        // Full replacement is restricted to owned Work Orders; ticket reservations are never touched.
        if(['replace','replace_audit'].includes(plan.action))tx.set(recordRef,{...plan.data,...(plan.action==='replace'?{personalDataRemoved:true}:{}),...(plan.action==='replace_audit'?{deletionExpiresAt:dates.retentionDueAt}: {})});else if(Object.keys(plan.patch).length)tx.update(recordRef,plan.patch);
        const commentMedia=Array.isArray(before.comments)&&before.comments.some(c=>(c.authorId===uid||c.userId===uid)&&(c.photoUrl||c.media?.length));
        const removedMedia=plan.action==='replace'&&(before.photoUrl||before.photos?.length||before.comments?.some(c=>c.photoUrl));
        if(removedMedia) {
          // The parent remains as anonymous maintenance history, so use a narrowly
          // scoped cleanup job which rechecks that the personal/media fields stay absent.
          const cleanupJobId=jobIdFor(`detached:${ref.path}:${path}`);
          // Deterministic set is safe on transaction retry; receipt state gates re-entry.
          tx.set(db.doc(`media_cleanup_jobs/${cleanupJobId}`),{collection:current.data().collection,recordId:record.id,uid,detached:true,accountDeletionJobId:ref.path.split('/').at(-1),...(scope.databaseId?{databaseId:scope.databaseId,expiresAt:new Date(dates.retentionDueAt),objectHashes:objectHashes(before)}:{}),status:'queued',pageToken:'',createdAt:timestamp(),lastAttemptAt:timestamp()});
          tx.update(receipt.ref,{state:'redacted',cleanupJobId});
        } else if(commentMedia&&scope.databaseId){
          const cleanupJobId=jobIdFor(`comment:${ref.path}:${path}`),comments=before.comments.filter(c=>c.authorId===uid||c.userId===uid);
          tx.set(db.doc(`media_cleanup_jobs/${cleanupJobId}`),{collection:current.data().collection,recordId:record.id,uid,databaseId:scope.databaseId,commentAuthorOnly:true,objectHashes:objectHashes({comments}),expiresAt:new Date(dates.retentionDueAt),accountDeletionJobId:ref.path.split('/').at(-1),status:'queued',pageToken:'',createdAt:timestamp(),lastAttemptAt:timestamp()});
          tx.update(receipt.ref,{state:'redacted',cleanupJobId});
        } else tx.update(receipt.ref,{state:commentMedia?'needs_review':'redacted',...(commentMedia?{reason:'removed_comment_media_requires_exact_link_review'}:{}),...(plan.action==='replace_audit'?{expireRecord:true}:{})});
      }
    });
    if(page.empty)await ref.update({phase:'private',status:'processing',policyVersion:2});
    return;
  }
}
module.exports={processRetentionStep};
