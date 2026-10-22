const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { approved, manager, id, reportInput, reportKey, reportTarget } = require('./safetyPolicy.cjs');
const database = process.env.TOWNLOOP_FIRESTORE_DATABASE_ID || '(default)';
const options = { region: 'us-central1', maxInstances: 2, timeoutSeconds: 60 };
async function actor(request, needManager = false) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Please sign in.');
  const token = request.rawRequest.headers.authorization?.match(/^Bearer (\S+)$/i)?.[1];
  try { if (!token || (await getAuth().verifyIdToken(token, true)).uid !== request.auth.uid) throw Error(); }
  catch { throw new HttpsError('unauthenticated', 'Please sign in again.'); }
  const db = getFirestore(database), uid = request.auth.uid;
  const data = (await db.doc(`users/${uid}`).get()).data();
  if (!(needManager ? manager(data) : approved(data))) throw new HttpsError('permission-denied', 'An approved account with the required role is needed.');
  return { db, uid };
}
function validated(action) { try { return action(); } catch (e) { throw new HttpsError('invalid-argument', e.message); } }
exports.submitSafetyReport = onCall(options, async request => {
  const { db, uid } = await actor(request);
  const target = validated(() => reportInput(request.data));
  const key = reportKey(uid, target), reference = db.doc(`moderation_reports/${key}`);
  return db.runTransaction(async tx => {
    const [existing, content, quota, author] = await Promise.all([tx.get(reference), tx.get(db.doc(`${target.collection}/${target.id}`)), tx.get(db.doc(`safety_limits/${uid}`)), tx.get(db.doc(`users/${uid}`))]);
    if (!approved(author.data())) throw new HttpsError('permission-denied', 'Account approval changed.');
    if (existing.exists) return { reportId: key, status: existing.data().status }; // retries never duplicate or send automatically
    const targetUid = validated(() => reportTarget(target, content.data(), uid));
    const day = new Date().toISOString().slice(0, 10), state = quota.data() || {};
    const count = state.day === day ? state.count || 0 : 0;
    if (count >= 20) throw new HttpsError('resource-exhausted', 'Daily report limit reached. Contact the office for urgent concerns.');
    tx.set(reference, { ...target, reporterId: uid, targetUid, status: 'open', createdAt: FieldValue.serverTimestamp() });
    tx.set(db.doc(`safety_limits/${uid}`), { day, count: count + 1 }, {merge:true});
    return { reportId: key, status: 'open' };
  });
});
exports.setUserBlock = onCall(options, async request => {
  const { db, uid } = await actor(request);
  const { targetUid, blocked } = request.data || {};
  if (!id(targetUid) || targetUid === uid || typeof blocked !== 'boolean') throw new HttpsError('invalid-argument', 'Choose another resident.');
  await db.runTransaction(async tx => {
    const [target, author, quota] = await Promise.all([tx.get(db.doc(`users/${targetUid}`)),tx.get(db.doc(`users/${uid}`)),tx.get(db.doc(`safety_limits/${uid}`))]);
    if (!approved(author.data())) throw new HttpsError('permission-denied', 'Account approval changed.');
    const day = new Date().toISOString().slice(0,10), prior = quota.data() || {};
    const count = prior.blockDay === day ? prior.blockCount || 0 : 0;
    if (count >= 200) throw new HttpsError('resource-exhausted', 'Please try blocking changes again later.');
    if (!target.exists) throw new HttpsError('not-found', 'This account is unavailable.');
    const ref = db.doc(`user_blocks/${uid}/targets/${targetUid}`);
    if (blocked) tx.set(ref, { createdAt: FieldValue.serverTimestamp() }); else tx.delete(ref);
    tx.set(db.doc(`safety_limits/${uid}`),{blockDay:day,blockCount:count+1},{merge:true});
  });
  return { blocked };
});
exports.reviewSafetyReport = onCall(options, async request => {
  const { db, uid } = await actor(request, true);
  const { reportId, action, note = '' } = request.data || {};
  if (!id(reportId) || !['dismiss', 'resolve', 'remove_content'].includes(action) || typeof note !== 'string' || note.length > 1000)
    throw new HttpsError('invalid-argument', 'Choose a valid moderation action.');
  await db.runTransaction(async tx => {
    const ref = db.doc(`moderation_reports/${reportId}`);
    const [snapshot, reviewer] = await Promise.all([tx.get(ref), tx.get(db.doc(`users/${uid}`))]);
    if (!manager(reviewer.data())) throw new HttpsError('permission-denied', 'Office approval changed.');
    const report = snapshot.data();
    if (!report) throw new HttpsError('not-found', 'Report unavailable.');
    if (report.status !== 'open') return;
    if (action === 'remove_content') {
      if (!['post', 'listing', 'comment'].includes(report.kind) || !['discussion_feed', 'marketplace_posts', 'posts', 'marketItems'].includes(report.collection))
        throw new HttpsError('failed-precondition', 'User reports need office account review; no account is automatically removed.');
      const parent = db.doc(`${report.collection}/${report.id}`), content = await tx.get(parent);
      if (content.exists) {
        if (report.kind === 'comment') {
          const comments = content.data().comments || [];
          if (comments.filter(c => String(c.id) === report.commentId).length !== 1) throw new HttpsError('failed-precondition', 'Comment changed. Review it again.');
          tx.update(parent, { comments: comments.filter(c => String(c.id) !== report.commentId), updatedAt: FieldValue.serverTimestamp() });
        } else tx.delete(parent); // matching retryable media cleanup trigger handles attachments
      }
    }
    tx.update(ref, { status: action === 'dismiss' ? 'dismissed' : 'resolved', action, reviewNote: note,
      reviewedBy: uid, reviewedAt: FieldValue.serverTimestamp() });
  });
  return { reviewed: true };
});
