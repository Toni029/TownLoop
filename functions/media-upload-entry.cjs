'use strict';
// Prepared scoped exports only. Not imported by index.cjs; deployment requires separate approval.
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onObjectFinalized } = require('firebase-functions/v2/storage');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { getStorage } = require('firebase-admin/storage');
const { getApps, initializeApp } = require('firebase-admin/app');
if (!getApps().length) initializeApp();
const { issueAuthenticated, finalized } = require('./mediaUploadQuota.cjs');
const MEDIA_BUCKET = 'cc-livingcommunity-app.firebasestorage.app';
const options = { region: 'us-central1', maxInstances: 4, timeoutSeconds: 60 };
exports.issueMediaUpload = onCall({ ...options, enforceAppCheck: false }, async request => {
  try {
    if(request.data?.action==='authorizeReferences')return await require('./recordMediaOwnership.cjs').authorizeAuthenticated(getFirestore(),getStorage().bucket(MEDIA_BUCKET),uid=>getAuth().getUser(uid),request);
    return await issueAuthenticated(getFirestore(), uid => getAuth().getUser(uid), request);
  } catch (error) {
    const candidate = error.code || error.message;
    const code = ['unauthenticated', 'permission-denied', 'invalid-argument', 'failed-precondition', 'already-exists', 'resource-exhausted'].includes(candidate) ? candidate : 'internal';
    throw new HttpsError(code, code === 'resource-exhausted' ? 'Please wait before uploading more files.' : 'Unable to authorize this attachment.');
  }
});
exports.completeMediaUpload = onObjectFinalized({ ...options, region:'us-east1', bucket: MEDIA_BUCKET, retry: true }, async event => {
 const db=getFirestore();await finalized(db,event.data,{bucket:MEDIA_BUCKET});
 if(process.env.TOWNLOOP_POST_DELETE_MEDIA_ENABLED!=='true')return;
 const m=event.data?.metadata;if(!m||!['marketplace_posts','discussion_feed','work_orders'].includes(m.collection)||typeof m.recordId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(m.recordId))return;
 if((await db.doc(m.collection+'/'+m.recordId).get()).exists)return;
 const jobs=await db.collection('media_cleanup_jobs').where('kind','==','post_delete_v1').where('collection','==',m.collection).where('recordId','==',m.recordId).limit(1).get();
 if(!jobs.empty)await require('./postMediaCleanup.cjs').handleDeletedPost(db,getStorage().bucket(MEDIA_BUCKET),jobs.docs[0].data());
});
