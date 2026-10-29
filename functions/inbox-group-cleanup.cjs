// Stage B is a pure, non-destructive planner. Deliberately no Firebase export or worker.
function planConversationCleanup({ conversation, members, messages, attachments = [], evidence = [], now = Date.now() }) {
  const holds = [];
  if (!conversation || conversation.status !== 'cleanup_pending' || members.some(m => m.status === 'active')) holds.push('active_or_incomplete_membership');
  if (conversation?.legacySource && !conversation.legacyVerified) holds.push('unverified_legacy_source');
  const retainedMessages = new Set();
  for (const item of evidence) {
    if (!item.messageId || !item.basis || !Number.isFinite(item.expiresAt) || item.expiresAt <= now) {
      holds.push('evidence_review_required'); continue;
    }
    retainedMessages.add(item.messageId);
  }
  const eligibleAttachments = [], retainedAttachments = [];
  for (const file of attachments) {
    if (!file.path || file.quarantined || !file.verifiedExclusive || file.referenceCount !== 1 || file.conversationId !== conversation?.id || retainedMessages.has(file.messageId)) retainedAttachments.push(file.path || 'unresolved');
    else eligibleAttachments.push(file.path);
  }
  if (retainedAttachments.length) holds.push('shared_quarantined_or_unverified_media');
  return { executable: false, stageBEnabled: false, holds: [...new Set(holds)],
    candidateMessageIds: messages.filter(m => !retainedMessages.has(m.id)).map(m => m.id), retainedMessageIds: [...retainedMessages],
    eligibleAttachmentPaths: eligibleAttachments, retainedAttachmentPaths: retainedAttachments,
    conversationRemovalAllowed: holds.length === 0 && retainedMessages.size === 0,
    requiredCleanup: ['messages', 'memberships', 'notification_events', 'notification_reads', 'notification_deliveries', 'conversation', 'verified_exclusive_media'],
  };
}
module.exports = { planConversationCleanup };
