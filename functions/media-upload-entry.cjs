'use strict';
// Prepared scoped exports only. Not imported by index.cjs; deployment requires separate approval.
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onObjectFinalized } = require('firebase-functions/v2/storage');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { getApps, initializeApp } = require('firebase-admin/app');
if (!getApps().length) initializeApp();
const { issueAuthenticated, finalized } = require('./mediaUploadQuota.cjs');
const MEDIA_BUCKET = 'cc-livingcommunity-app.firebasestorage.app';
const options = { region: 'us-central1', maxInstances: 4, timeoutSeconds: 60 };
exports.issueMediaUpload = onCall({ ...options, enforceAppCheck: false }, async request => {
  try {
    return await issueAuthenticated(getFirestore(), uid => getAuth().getUser(uid), request);
  } catch (error) {
    const candidate = error.code || error.message;
    const code = ['unauthenticated', 'permission-denied', 'invalid-argument', 'failed-precondition', 'already-exists', 'resource-exhausted'].includes(candidate) ? candidate : 'internal';
    throw new HttpsError(code, code === 'resource-exhausted' ? 'Please wait before uploading more files.' : 'Unable to authorize this attachment.');
  }
});
exports.completeMediaUpload = onObjectFinalized({ ...options, bucket: MEDIA_BUCKET, retry: true }, event => finalized(getFirestore(), event.data, { bucket: MEDIA_BUCKET }));
