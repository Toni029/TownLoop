const { onDocumentDeleted } = require('firebase-functions/v2/firestore');
const { onObjectFinalized } = require('firebase-functions/v2/storage');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore, FieldValue, FieldPath } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { createHash } = require('node:crypto');
const { FOLDERS, linkedMedia, approvedMediaPolicy, trustedMedia } = require('./mediaCleanupPolicy.cjs');
const database = process.env.TOWNLOOP_FIRESTORE_DATABASE_ID || '(default)';
const options = { region: 'us-central1', maxInstances: 1, timeoutSeconds: 300 };
const hash = value => createHash('sha256').update(value).digest('hex');
async function enqueue(db, parent, eventId) {
  const ref = db.doc(`media_cleanup_jobs/${hash(eventId)}`);
  await db.runTransaction(async tx => {
    const [existing, currentParent] = await Promise.all([tx.get(ref), tx.get(db.doc(`${parent.collection}/${parent.recordId}`))]);
    // Parent creation rules consult this server-only tombstone. IDs of removed records
    // cannot be reused while Storage is being cleaned up; restored records win safely.
    if (currentParent.exists) return;
    tx.set(db.doc(`media_deletion_tombstones/${parent.collection}/records/${parent.recordId}`), { deletedAt: FieldValue.serverTimestamp() });
    if (!existing.exists) tx.create(ref, { ...parent, status: 'queued', pageToken: '',
      createdAt: FieldValue.serverTimestamp(), lastAttemptAt: FieldValue.serverTimestamp() });
  });
}
for (const collection of Object.keys(FOLDERS)) {
  exports[`cleanupDeleted_${collection}`] = onDocumentDeleted({ ...options, database, document: `${collection}/{recordId}`, retry: true }, async event => {
    const data = event.data?.data();
    // Ownershipless legacy data cannot authorize Storage destruction.
    const uid = data?.userId ?? data?.authorId;
    if (typeof uid !== 'string' || !uid || (data.userId != null && data.authorId != null && data.userId !== data.authorId)) return;
    await enqueue(getFirestore(database), { collection, recordId: event.params.recordId, uid }, event.id);
  });
}
// Covers an upload completing after the parent-deletion trigger has already listed its folder.
// Storage events must use the existing bucket's US-EAST1 location, even when this export is not selected.
exports.cleanupLateOrphanMedia = onObjectFinalized({ ...options, bucket: 'cc-livingcommunity-app.firebasestorage.app', region: 'us-east1', retry: true }, async event => {
  const object = event.data, custom = object.metadata;
  if (!custom || !FOLDERS[custom.collection] || !/^[A-Za-z0-9_-]{1,128}$/.test(custom.recordId || '') ||
      typeof custom.uploadedBy !== 'string' || !custom.uploadedBy || custom.uploadedBy.includes('/')) return;
  const parent = { collection: custom.collection, recordId: custom.recordId, uid: custom.uploadedBy };
  if (!linkedMedia(object, parent)) return;
  const db = getFirestore(database);
  if (!(await db.doc(`${parent.collection}/${parent.recordId}`).get()).exists) await enqueue(db, parent, event.id);
});
exports.resumeMediaCleanup = onSchedule({ ...options, schedule: 'every 15 minutes', timeZone: 'Etc/UTC' }, async () => {
  const db = getFirestore(database), bucket = getStorage().bucket();
  const jobs = await db.collection('media_cleanup_jobs').where('status', '==', 'queued').orderBy('lastAttemptAt').limit(10).get();
  for (const job of jobs.docs) {
    const parent = job.data();
    try {
      if (!FOLDERS[parent.collection] || typeof parent.recordId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(parent.recordId)) throw Error('Invalid parent');
      const policy = (await db.doc('deletion_policies/media').get()).data();
      if (!approvedMediaPolicy(policy, parent.collection)) {
        await job.ref.update({ lastAttemptAt: FieldValue.serverTimestamp(), lastError: 'pending_owner_policy_and_trusted_upload_cutover' }); continue;
      }
      if ((await db.doc(`${parent.collection}/${parent.recordId}`).get()).exists) {
        await job.ref.update({ status: 'parent_restored', lastAttemptAt: FieldValue.serverTimestamp() }); continue;
      }
      const [files, next] = await bucket.getFiles({ prefix: `${FOLDERS[parent.collection]}/`, autoPaginate: false, maxResults: 100, ...(parent.pageToken ? { pageToken: parent.pageToken } : {}) });
      let reviewRequired = parent.reviewRequired === true;
      for (const file of files) {
        let metadata;
        try { [metadata] = await file.getMetadata(); } catch (error) { if (error.code === 404) continue; throw error; }
        if (!linkedMedia(metadata, parent)) continue;
        if (!trustedMedia(metadata, parent, policy)) { reviewRequired = true; continue; }
        // Recheck immediately before destruction; generation guards object replacement races.
        if ((await db.doc(`${parent.collection}/${parent.recordId}`).get()).exists) throw Error('Parent restored');
        try { await file.delete({ ifGenerationMatch: metadata.generation, ignoreNotFound: true }); }
        catch (error) { if (error.code !== 404) throw error; }
      }
      await job.ref.update({ pageToken: next?.pageToken || '', reviewRequired, status: next?.pageToken ? 'queued' : reviewRequired ? 'pending_legacy_review' : 'complete', lastAttemptAt: FieldValue.serverTimestamp(), lastError: FieldValue.delete() });
    } catch { await job.ref.update({ lastAttemptAt: FieldValue.serverTimestamp(), lastError: 'retry_required' }); }
  }
});
exports.expireMediaDrafts = onSchedule({ ...options, schedule: 'every 60 minutes', timeZone: 'Etc/UTC' }, async () => {
  const db = getFirestore(database);
  // Cursor retained server-side so fresh/invalid drafts cannot starve older records.
  for (const collection of Object.keys(FOLDERS)) {
    const policy = (await db.doc('deletion_policies/media').get()).data();
    if (!approvedMediaPolicy(policy, collection) || policy.collections[collection].expireUploadDrafts !== true) continue;
    const cursor = db.doc(`media_cleanup_cursors/${collection}`), state = (await cursor.get()).data();
    let query = db.collection(collection).where('storageDraft', '==', true).orderBy(FieldPath.documentId()).limit(100);
    if (state?.lastId) query = query.startAfter(state.lastId);
    const drafts = await query.get();
    for (const draft of drafts.docs) await db.runTransaction(async tx => {
      const current = await tx.get(draft.ref), live = current.data(), expiry = live?.storageDraftExpiresAt;
      // Fifteen-minute upload safety margin exceeds the client 120-second upload deadline.
      if (typeof current.createTime?.toMillis === 'function' && current.createTime.toMillis() >= policy.trustedUploadsAfter.toMillis() &&
          live?.storageDraft === true && typeof expiry?.toMillis === 'function' && expiry.toMillis() + 15 * 60000 < Date.now()) tx.delete(draft.ref);
    });
    await cursor.set({ lastId: drafts.size === 100 ? drafts.docs.at(-1).id : '' });
  }
});
