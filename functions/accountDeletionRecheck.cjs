'use strict';
const L=require('./accountDeletionLifecycle.cjs'),{DATABASES}=require('./accountDeletionScope.cjs'),{jobIdFor,referencesUid}=require('./accountDeletionPolicy.cjs'),retention=require('./accountDeletionRetention.cjs');
// A request to retry is not an evidence override. Re-evaluate the same records
// and preserve every unresolved receipt; only the normal engine performs erasure.
async function recheckJob(control,ref,job,{dbFor,bucket,mediaPolicy,preflight}){
 if(!L.isNewJob(job)||!L.executionAuthorized(job)||!job.recheckRequested)return;
 if(job.preflight?.holds?.length){const proof=await preflight(job,{dbFor,bucket,mediaPolicy});await ref.update({preflight:proof,recheckRequested:false,...(proof.holds.length?{status:'needs_review',lastError:proof.holds[0].reason}:{lastError:''})});return;}
 for(const databaseId of DATABASES){const db=dbFor(databaseId),scopeRef=db.doc('account_deletion_scopes/'+jobIdFor(job.uid)),scope=(await scopeRef.get()).data();if(!scope)continue;
  if(scope.uid!==job.uid||scope.requestId!==job.requestId)throw Error('scope_identity_mismatch');
  const held=await scopeRef.collection('inventory').where('state','==','needs_review').limit(50).get();
  for(const row of held.docs)await db.runTransaction(async tx=>{const old=await tx.get(row.ref),entry=old.data();if(entry?.state!=='needs_review')return;if(typeof entry.path!=='string'||!entry.path.startsWith(entry.collection+'/'))throw Error('scope_identity_mismatch');
   const record=await tx.get(db.doc(entry.path));if(!record.exists){tx.update(row.ref,{state:'already_absent',reason:''});return;}
   const reports=await tx.get(db.collection('moderation_reports').where('collection','==',entry.collection).where('id','==',record.id).limit(1));if(!reports.empty)throw Error('reported_evidence_requires_disposition');
   const plan=retention.plan(entry.collection,record.data(),job.uid),after=['replace','replace_audit'].includes(plan.action)?plan.data:{...record.data(),...plan.patch};
   if(plan.action==='review'||!['delete_parent','delete_record'].includes(plan.action)&&referencesUid(after,job.uid))throw Error('scope_exception_requires_review');
   tx.update(row.ref,{state:'pending_redaction',reason:''});
  });
  if(scope.status==='needs_review')await scopeRef.update({phase:'v2_redact',status:'processing',verifyCursor:''});
 }
 await ref.update({recheckRequested:false,lastError:''});
}
module.exports={recheckJob};
