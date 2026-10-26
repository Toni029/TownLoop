// Exact UID metadata only. Pure preparation: no Firebase reads or writes.
const {millis}=require('./accountDeletionRetention.cjs');
const DATABASES=Object.freeze(['(default)','ai-studio-cclivingv27-5fc1a0f6-cd75-4964-8c9e-e219a265f7bb']);
function classifyOwnership(metadata,uid,verifiedUids) {
  if(!verifiedUids.has(uid))return 'needs_review';
  const owners=['userId','authorId','ownerId','uid'].filter(key=>metadata[key]!=null).map(key=>metadata[key]);
  const ids=metadata.participantIds;
  if(ids!=null || metadata.sellerId!=null || metadata.buyerId!=null) {
    if(!Array.isArray(ids)||ids.length!==2||new Set(ids).size!==2||!ids.every(id=>verifiedUids.has(id)))return 'needs_review';
    if(metadata.sellerId!=null||metadata.buyerId!=null) {
      if(metadata.sellerId===metadata.buyerId||![metadata.sellerId,metadata.buyerId].every(id=>ids.includes(id)))return 'needs_review';
    }
    if(owners.some(id=>!ids.includes(id)))return 'needs_review';
    return ids.includes(uid)?'shared_exact_uids':'other_participants';
  }
  if(owners.length) {
    if(owners.some(id=>!verifiedUids.has(id))||new Set(owners).size!==1)return 'needs_review';
    return owners[0]===uid?'owned_exact_uid':'other_owner';
  }
  // Names, emails, sanitized aliases, a missing profile, or an absent owner are not proof.
  return 'needs_review';
}
function databaseCompletionReady(job,now=Date.now()) {
  if(typeof job.uid!=='string'||!job.uid||job.uid.length>128||job.uid.includes('/'))return false;
  const scopes=job.databaseCompletion;
  if(!Array.isArray(scopes)||scopes.length!==DATABASES.length)return false;
  return DATABASES.every(databaseId=>{
    const matches=scopes.filter(scope=>scope.databaseId===databaseId);
    if(matches.length!==1)return false;
    const s=matches[0],completed=millis(s.completedAt);
    return s.uid===job.uid && s.policyReference===job.review?.policyReference &&
      typeof s.policyReference==='string' && s.policyReference.length>0 &&
      s.inventoryComplete===true && s.recordsComplete===true && s.writesFrozen===true &&
      s.unresolvedIdentityCount===0 && s.unresolvedMediaCount===0 &&
      Number.isFinite(completed) && completed<=now && completed>=millis(job.createdAt);
  });
}
module.exports={DATABASES,classifyOwnership,databaseCompletionReady};
