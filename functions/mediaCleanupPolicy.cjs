const FOLDERS = { work_orders: 'work_orders', discussion_feed: 'feed', posts: 'feed', marketplace_posts: 'marketplace', marketItems: 'marketplace' };
function linkedMedia(metadata, parent) {
  const custom = metadata?.metadata;
  return !!FOLDERS[parent.collection] && custom?.securityVersion === '1' &&
    custom.collection === parent.collection && custom.recordId === parent.recordId &&
    typeof parent.uid === 'string' && !!parent.uid && typeof custom.uploadedBy === 'string' &&
    !!custom.uploadedBy && !custom.uploadedBy.includes('/') &&
    typeof metadata.name === 'string' && metadata.name.startsWith(`${FOLDERS[parent.collection]}/`) &&
    metadata.name.split('/').length === 2 && !!metadata.generation;
}
function approvedMediaPolicy(policy, collection) {
  const cutover = policy?.trustedUploadsAfter;
  return policy?.ownerApproved === true && typeof policy.approvalReference === 'string' && !!policy.approvalReference.trim() &&
    typeof cutover?.toMillis === 'function' && Number.isFinite(cutover.toMillis()) && cutover.toMillis() > 0 &&
    policy.collections?.[collection]?.action === 'delete_linked_media_on_parent_deletion' &&
    typeof policy.collections[collection].reason === 'string' && !!policy.collections[collection].reason.trim();
}
function trustedMedia(metadata, parent, policy) {
  if (!linkedMedia(metadata, parent) || !approvedMediaPolicy(policy, parent.collection)) return false;
  // GCS server creation time, never attacker-controlled custom uploadedAt. Pre-cutover
  // metadata was writable under legacy rules and cannot establish deletion authority.
  const created = typeof metadata.timeCreated === 'string' ? Date.parse(metadata.timeCreated) : NaN;
  return Number.isFinite(created) && created >= policy.trustedUploadsAfter.toMillis();
}
module.exports = { FOLDERS, linkedMedia, approvedMediaPolicy, trustedMedia };

function parentBlocksCleanup(snapshot, job) {
  if(!snapshot.exists)return false;
  const data=snapshot.data();
  return job.detached!==true || data.personalDataRemoved!==true || !!data.userId || !!data.userEmail || !!data.photoUrl || (data.photos?.length||0)>0 || (data.comments?.length||0)>0;
}
module.exports.parentBlocksCleanup=parentBlocksCleanup;
