const { createHash } = require('node:crypto');
const jobIdFor = uid => createHash('sha256').update(uid).digest('hex');
const SHARED = ['work_orders', 'discussion_feed', 'posts', 'marketplace_posts', 'marketItems', 'resident_chats', 'office_chats', 'maintenance_chats', 'marketplace_chats', 'community_events', 'community_highlights', 'newsletters', 'notification_deliveries', 'moderation_reports', 'moderation_audit'];
const OWNED_SOCIAL = new Set(['discussion_feed', 'posts', 'marketplace_posts', 'marketItems']);
function validateRequest(auth, data, now = Date.now()) {
  if (!auth?.uid) return 'unauthenticated';
  const authenticatedAt = Number(auth.token?.auth_time) * 1000;
  if (!Number.isFinite(authenticatedAt) || authenticatedAt > now + 30000 || now - authenticatedAt > 5 * 60000) return 'recent-login-required';
  if (data?.confirmation !== 'DELETE') return 'confirmation-required';
  return null;
}
function referencesUid(data, uid) {
  if (!data || typeof data !== 'object') return false;
  // Include embedded messages/comments and legacy participant objects; never compare display names.
  if (Array.isArray(data)) return data.some(item => referencesUid(item, uid));
  return Object.hasOwn(data, uid) || Object.entries(data).some(([key, value]) =>
    (['userId', 'authorId', 'authorUid', 'senderId', 'residentId', 'uid', 'id', 'createdBy', 'ownerId', 'sellerId', 'buyerId', 'resolutionAuthorId', 'completedBy', 'reporterId', 'targetUid', 'actorId', 'uploadedBy'].includes(key) && value === uid) ||
    (key === 'participantIds' && Array.isArray(value) && value.includes(uid)) ||
    (value && typeof value === 'object' && referencesUid(value, uid)));
}
function approvedRetention(policy, collection) {
  // No default retention or unreviewed destructive anonymization. A signed-off retain decision
  // must include its rationale/reference. Time-based policies require a separate reviewed worker.
  return policy?.ownerApproved === true && typeof policy.approvalReference === 'string' && policy.approvalReference.trim().length > 0 &&
    policy.collections?.[collection]?.action === 'retain' && typeof policy.collections[collection].reason === 'string' &&
    policy.collections[collection].reason.trim().length > 0;
}
function approvedSocialDeletion(policy, collection) {
  return OWNED_SOCIAL.has(collection) && policy?.ownerApproved === true &&
    typeof policy.approvalReference === 'string' && !!policy.approvalReference.trim() &&
    policy.collections?.[collection]?.action === 'delete_owned_social' &&
    typeof policy.collections[collection].reason === 'string' && !!policy.collections[collection].reason.trim();
}
function ownsSocial(record, uid) {
  // Conflicting legacy ownership never authorizes destruction.
  return record?.userId === uid && (record.authorId == null || record.authorId === uid) ||
    record?.userId == null && record?.authorId === uid;
}
function approvedSharedSocialRetention(policy, collection) {
  const shared = policy?.collections?.[collection]?.sharedReferences;
  return approvedSocialDeletion(policy, collection) && shared?.action === 'retain' && typeof shared.reason === 'string' && !!shared.reason.trim();
}
// Requests remain usable until the operator has a complete supported processing policy.
function accountPolicyReady(policy) {
  if (policy?.policyVersion === 2) return require('./accountDeletionRetention.cjs').policyReady(policy);
  return SHARED.every(collection => {
    const entry = policy?.collections?.[collection];
    if (entry?.retentionDays != null || entry?.expiresAfterDays != null) return false;
    return approvedRetention(policy, collection) ||
      (approvedSocialDeletion(policy, collection) && approvedSharedSocialRetention(policy, collection));
  });
}
module.exports = { accountPolicyReady, jobIdFor, SHARED, validateRequest, referencesUid, approvedRetention, approvedSocialDeletion, ownsSocial, approvedSharedSocialRetention };
