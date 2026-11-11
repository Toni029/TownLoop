'use strict';
// Prepared only, independently scoped; no index import or deployment activation.
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { getApps, initializeApp } = require('firebase-admin/app');
const { issueAuthenticated } = require('./newsletterUploadBudget.cjs');
if (!getApps().length) initializeApp();
exports.issueNewsletterUpload = onCall({region:'us-central1',maxInstances:4,timeoutSeconds:60,enforceAppCheck:false},async request=>{
 try{return await issueAuthenticated(getFirestore(),uid=>getAuth().getUser(uid),request);}
 catch(error){const candidate=error.code||error.message,code=['unauthenticated','permission-denied','invalid-argument','failed-precondition','resource-exhausted'].includes(candidate)?candidate:'internal';
  throw new HttpsError(code,code==='resource-exhausted'?'Please wait before uploading another newsletter.':'Unable to authorize this newsletter upload.');}
});
