const { sendEvent } = require('./inbox-push.cjs');
const { memberAllowed, canSee, memberPath } = require('./inbox-groups.cjs');
async function deliverGroup(db, event, dependencies) {
  const now = dependencies.now ?? Date.now(), message = event.data?.data();
  const cid = event.params?.conversationId;
  if (!cid || message?.type !== 'message' || message.isSystem || message.notify !== true || message.id !== event.params.messageId ||
      !Number.isFinite(message.createdAt) || now - message.createdAt > 3600000 || message.createdAt > now + 60000 || !Array.isArray(message.visibility)) return;
  const conversation = (await db.doc(`inbox_conversations/${cid}`).get()).data();
  if (!conversation) return;
  const category = {private:'friend', office:'office', maintenance:'maintenance'}[conversation.type];
  const descriptor = { collection: 'inbox_conversations', category, documentId: cid, eventId: message.id,
    eventTime: message.createdAt, sequence: message.sequence, senderId: message.senderId, body: 'You have a new Inbox message.',
    recipientIds: conversation.memberIds.filter(uid => uid !== message.senderId) };
  await sendEvent(db, descriptor, { ...dependencies, now, deviceAllowed:device=>device.inboxGroupProtocol===3&&(dependencies.deviceAllowed?.(device)??true), verify: async (tx, uid) => {
    const [c, m, p, sender, senderProfile, liveMessage] = await Promise.all([
      tx.get(db.doc(`inbox_conversations/${cid}`)), tx.get(db.doc(memberPath(cid, uid))), tx.get(db.doc(`users/${uid}`)),
      tx.get(db.doc(memberPath(cid, message.senderId))), tx.get(db.doc(`users/${message.senderId}`)),
      tx.get(db.doc(`inbox_conversations/${cid}/messages/${message.id}`)),
    ]);
    return !!c.exists && c.data().status === 'open' && memberAllowed(c.data(), sender.data(), senderProfile.data()) &&
      liveMessage.exists && canSee(c.data(), m.data(), p.data(), liveMessage.data()) && (m.data().readSequence || 0) < message.sequence;
  }});
}
module.exports = { deliverGroup };
