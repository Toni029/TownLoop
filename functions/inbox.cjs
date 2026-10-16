const { createHash } = require('node:crypto');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentWrittenWithAuthContext } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { logger } = require('firebase-functions');
const { collections, approved, member, appendedMessage, recipients } = require('./inbox-policy.cjs');
const hash = value => createHash('sha256').update(value).digest('hex');
const options = { region: 'us-central1', maxInstances: 4, timeoutSeconds: 60 };
const expoToken = token => typeof token === 'string' && /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/.test(token) && token.length < 256;
exports.registerInboxDevice = onCall(options, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  const { token, platform, remove, previousToken } = request.data || {};
  if (!expoToken(token)) throw new HttpsError('invalid-argument', 'Invalid push token.');
  const db = getFirestore(), ref = db.collection('notification_devices').doc(hash(token));
  await db.runTransaction(async tx => {
    const oldRef = expoToken(previousToken) && previousToken !== token ? db.collection('notification_devices').doc(hash(previousToken)) : null;
    const [profile, existing, oldDevice] = await Promise.all([tx.get(db.doc(`users/${request.auth.uid}`)), tx.get(ref), oldRef ? tx.get(oldRef) : null]);
    if (remove) {
      if (existing.data()?.uid === request.auth.uid) tx.delete(ref);
      return;
    }
    if (!approved(profile.data())) throw new HttpsError('permission-denied', 'An approved account is required.');
    if (!['android', 'ios'].includes(platform)) throw new HttpsError('invalid-argument', 'Unsupported platform.');
    // Token hash is unique across accounts, so a shared phone has only one owner.
    if (oldRef && oldDevice?.data()?.uid === request.auth.uid) tx.delete(oldRef);
    tx.set(ref, { uid: request.auth.uid, token, platform, updatedAt: FieldValue.serverTimestamp() });
  });
  return { registered: !remove };
});
async function send(event, collection) {
  const after = event.data?.after.data();
  if (!after || !event.authId || ['system', 'unauthenticated', 'service_account'].includes(event.authType)) return;
  const db = getFirestore();
  const senderSnap = await db.doc(`users/${event.authId}`).get();
  const sender = { ...senderSnap.data(), id: senderSnap.id };
  if (!member(collection, after, sender)) return;
  const message = appendedMessage(event.data.before.data(), after, sender);
  if (!message) return;
  const profiles = new Map();
  const add = doc => { if (doc.exists) profiles.set(doc.id, { ...doc.data(), id: doc.id }); };
  if (collection === 'resident_chats') {
    // Existing web/native participant metadata uses sanitized identifiers plus email.
    for (const p of (after.participants || []).slice(0, 2)) {
      if (typeof p.id === 'string' && p.id && !p.id.includes('/')) add(await db.doc(`users/${p.id}`).get());
      if (typeof p.email === 'string' && p.email) (await db.collection('users').where('email', '==', p.email).limit(2).get()).docs.forEach(add);
    }
  } else {
    const roles = collection === 'office_chats' ? ['admin', 'vip'] : ['crew'];
    (await db.collection('users').where('role', 'in', roles).get()).docs.forEach(add);
    if (typeof after.residentId === 'string' && after.residentId && !after.residentId.includes('/')) add(await db.doc(`users/${after.residentId}`).get());
    if (typeof after.residentEmail === 'string' && after.residentEmail) (await db.collection('users').where('email', '==', after.residentEmail).limit(2).get()).docs.forEach(add);
  }
  for (const recipient of recipients(collection, after, [...profiles.values()], sender.id)) {
    const devices = await db.collection('notification_devices').where('uid', '==', recipient.id).get();
    for (const device of devices.docs) {
      const claim = db.collection('notification_deliveries').doc(hash(`${collection}/${event.params.chatId}/${message.id}/${recipient.id}/${device.id}`));
      const claimed = await db.runTransaction(async tx => {
        const [sent, current, profile] = await Promise.all([tx.get(claim), tx.get(device.ref), tx.get(db.doc(`users/${recipient.id}`))]);
        if (sent.exists || current.data()?.uid !== recipient.id || !member(collection, after, { ...profile.data(), id: profile.id })) return false;
        tx.create(claim, { state: 'sending', createdAt: FieldValue.serverTimestamp(), deviceId: device.id, uid: recipient.id });
        return true;
      });
      if (!claimed) continue;
      try {
        // Claim before sending: retries of Firestore events cannot send duplicates.
        // Ambiguous network failures are retained for inspection, not blindly resent.
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000),
          body: JSON.stringify({ to: device.data().token, title: 'TownLoop', body: 'You have a new Inbox message.',
            sound: 'default', channelId: 'inbox', ttl: 3600,
            data: { type: 'inbox', category: collections[collection], conversationId: event.params.chatId, recipientId: recipient.id } }),
        });
        if (!response.ok) throw Error(`Expo HTTP ${response.status}`);
        const result = (await response.json()).data;
        await claim.update({ state: result?.status === 'ok' ? 'accepted' : 'rejected', ticketId: result?.id || '', error: result?.details?.error || '', checkedAt: FieldValue.serverTimestamp() });
        if (result?.details?.error === 'DeviceNotRegistered') await removeInvalidDevice(db, device.ref, recipient.id);
      } catch {
        await claim.update({ state: 'unknown', checkedAt: FieldValue.serverTimestamp() });
        logger.warn('Inbox push delivery needs inspection', { deliveryId: claim.id });
      }
    }
  }
}
async function removeInvalidDevice(db, ref, uid) {
  await db.runTransaction(async tx => { const snap = await tx.get(ref); if (snap.data()?.uid === uid) tx.delete(ref); });
}
for (const [collection, category] of Object.entries(collections)) {
  exports[`notifyInbox${category[0].toUpperCase()}${category.slice(1)}`] = onDocumentWrittenWithAuthContext({ ...options, document: `${collection}/{chatId}`, retry: true }, event => send(event, collection));
}
exports.checkInboxPushReceipts = onSchedule({ ...options, schedule: 'every 15 minutes' }, async () => {
  const db = getFirestore();
  const pending = await db.collection('notification_deliveries').where('state', '==', 'accepted').limit(100).get();
  if (pending.empty) return;
  const response = await fetch('https://exp.host/--/api/v2/push/getReceipts', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000),
    body: JSON.stringify({ ids: pending.docs.map(d => d.data().ticketId) }),
  });
  if (!response.ok) throw Error(`Expo receipt HTTP ${response.status}`);
  const receipts = (await response.json()).data || {};
  for (const delivery of pending.docs) {
    const data = delivery.data(), receipt = receipts[data.ticketId];
    if (!receipt && Date.now() - data.createdAt.toMillis() < 24 * 3600000) continue;
    await delivery.ref.update({ state: receipt?.status === 'ok' ? 'delivered' : receipt ? 'rejected' : 'receipt-expired', error: receipt?.details?.error || '', checkedAt: FieldValue.serverTimestamp() });
    if (receipt?.details?.error === 'DeviceNotRegistered') await removeInvalidDevice(db, db.doc(`notification_devices/${data.deviceId}`), data.uid);
  }
});
