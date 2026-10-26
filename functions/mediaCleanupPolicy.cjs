const {createHash}=require('node:crypto');
const provenance=require('./deletionMediaProvenance.json');
const objectHash=name=>createHash('sha256').update(name||'').digest('hex');
const {millis}=require('./accountDeletionRetention.cjs');
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
  if(provenance.quarantinedObjectHashes.includes(objectHash(metadata?.name))||!approvedMediaPolicy(policy,parent.collection))return false;
  const legacy=verifiedLegacyMedia(metadata,parent,policy);
  if(!linkedMedia(metadata,parent)&&!legacy)return false;
  if(metadata.metadata?.quarantined==='true'||metadata.metadata?.quarantine===true)return false;
  if(parent.commentAuthorOnly===true&&(!parent.objectHashes?.includes(objectHash(metadata.name))||metadata.metadata?.uploadedBy!==parent.uid))return false;
  const created=typeof metadata.timeCreated==='string'?Date.parse(metadata.timeCreated):NaN;
  // Reviewed C2 rules permit securityVersion=1 only against default-database parents;
  // hosted-web legacy creation explicitly forbids that metadata. Verify this rules hash before activation.
  const nativeProvenance=parent.databaseId==='(default)'&&policy.storageRulesSha256===provenance.storageRulesSha256&&
    !metadata.metadata?.databaseId&&metadata.metadata?.securityVersion==='1';
  if(parent.databaseId&&metadata.metadata?.databaseId!==parent.databaseId&&!nativeProvenance&&!legacy)return false;
  return legacy||Number.isFinite(created)&&created>=policy.trustedUploadsAfter.toMillis();
}
module.exports = { FOLDERS, linkedMedia, approvedMediaPolicy, trustedMedia };

function parentBlocksCleanup(snapshot, job) {
  if(!snapshot.exists)return false;
  const data=snapshot.data();
  if(job.commentAuthorOnly===true)return (data.comments||[]).some(c=>c.authorId===job.uid||c.userId===job.uid);
  return job.detached!==true || data.personalDataRemoved!==true || !!data.userId || !!data.userEmail || !!data.photoUrl || (data.photos?.length||0)>0 || (data.comments?.length||0)>0;
}
module.exports.parentBlocksCleanup=parentBlocksCleanup;

function verifiedLegacyMedia(metadata,parent,policy) {
 if(typeof metadata?.name!=='string'||metadata.name.split('/').length!==2||!metadata.name.startsWith(`${FOLDERS[parent.collection]}/`))return false;
 const key=objectHash(metadata?.name),excluded=provenance.quarantinedObjectHashes;
 if(!Array.isArray(excluded)||excluded.length!==6||new Set(excluded).size!==6||!excluded.every(h=>/^[a-f0-9]{64}$/.test(h))||excluded.includes(key))return false;
 if(policy?.quarantinedObjectHashes?.includes(key))return false;
 const proof=policy.verifiedLegacyObjects?.[key];
 if(!proof||!parent.databaseId||metadata.metadata?.databaseId&&metadata.metadata.databaseId!==parent.databaseId)return false;
 return proof.databaseId===parent.databaseId&&proof.collection===parent.collection&&proof.recordId===parent.recordId&&proof.ownerUid===parent.uid&&
  proof.accountDeletionJobId===parent.accountDeletionJobId&&!!parent.accountDeletionJobId&&proof.policyReference===policy.approvalReference&&
  proof.generation===metadata.generation&&proof.metageneration===metadata.metageneration&&!!proof.metageneration&&
  millis(proof.expiresAt)>Date.now()&&millis(proof.expiresAt)<=millis(parent.expiresAt);
}
module.exports.verifiedLegacyMedia=verifiedLegacyMedia;
