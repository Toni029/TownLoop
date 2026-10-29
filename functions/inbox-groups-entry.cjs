// Stage A exports only. No cleanup worker/scheduler is exported by this module.
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { operate } = require('./inbox-groups.cjs');
const { deliverGroup } = require('./inbox-groups-push.cjs');
const options = { region: 'us-central1', maxInstances: 4, timeoutSeconds: 60 };
exports.manageInboxConversation = onCall(options, async request => {
  try {
    if (!request.auth) throw Error('unauthenticated');
    const identity = await getAuth().getUser(request.auth.uid);
    if (identity.disabled || request.auth.token.auth_time * 1000 < Date.parse(identity.tokensValidAfterTime || '1970-01-01')) throw Error('unauthenticated');
    return await operate(getFirestore(), request.auth.uid, request.data || {}, { enabled: process.env.INBOX_GROUPS_ENABLED === 'true' });
  } catch (e) {
    const code = ['unauthenticated', 'permission-denied', 'invalid-argument', 'not-found', 'failed-precondition', 'already-exists', 'resource-exhausted'].includes(e.message) ? e.message : 'internal';
    throw new HttpsError(code, e.safeReason === 'legacy-review' ? 'This older conversation needs community office review before its participants can be updated. Its messages have not been removed.' : code === 'failed-precondition' ? 'This conversation is read-only or the group service is not active.' : 'Unable to complete the Inbox action.');
  }
});
exports.notifyInboxGroupMessage = onDocumentCreated({ ...options, database: '(default)', document: 'inbox_conversations/{conversationId}/messages/{messageId}', retry: true }, async event => {
  // Both gates default OFF; no historical backfill or scheduler.
  if (process.env.INBOX_GROUPS_ENABLED !== 'true' || process.env.INBOX_GROUP_PUSH_ENABLED !== 'true') return;
  const { sendingAllowed, recipientAllowed, deviceAllowed, transport } = require('./inbox.cjs').groupDeliveryDependencies;
  if (!sendingAllowed()) return;
  await deliverGroup(getFirestore(), event, { identity: uid => getAuth().getUser(uid), transport, recipientAllowed, deviceAllowed });
});
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
exports.revokeInboxGroupMemberships = onDocumentWritten({ ...options, database:'(default)', document:'users/{uid}', retry:true }, async event => {
  if(process.env.INBOX_GROUPS_ENABLED!=='true')return;
  await require('./inbox-group-roles.cjs').revokeChangedMemberships(getFirestore(),event.params.uid,event.data?.before.data(),event.data?.after.data(),Date.parse(event.time));
});
