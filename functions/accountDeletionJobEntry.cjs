'use strict';
const {getApps,initializeApp,getApp}=require('firebase-admin/app');
const {getFirestore}=require('firebase-admin/firestore');
const {getAuth}=require('firebase-admin/auth');
const {getStorage}=require('firebase-admin/storage');
const {onDocumentWritten}=require('firebase-functions/v2/firestore');
const {createRulesVerifier}=require('./deletionRulesRuntime.cjs');
if(!getApps().length)initializeApp();
exports.processAccountDeletionJob=onDocumentWritten({region:'us-central1',database:'(default)',document:'account_deletion_jobs/{jobId}',retry:true,timeoutSeconds:300,maxInstances:1,concurrency:1},async event=>{
 // Staging disables every mutation path, including completed-proof expiry.
 if(process.env.TOWNLOOP_ACCOUNT_DELETION_ENABLED!=='true'||process.env.TOWNLOOP_SCOPED_DELETION_ENABLED!=='true')return;
 const before=event.data?.before.data(),after=event.data?.after.data(),L=require('./accountDeletionLifecycle.cjs');
 if(!after&&L.isNewJob(before)){await require('./accountDeletionReceipts.cjs').expireReceipts(getFirestore('(default)'),event.params.jobId,before,{dbFor:id=>getFirestore(id)});return;}
 if(!L.isNewJob(after)||['requested','rejected','cancelled','complete','needs_review'].includes(after.status)||before?.requestId===after.requestId&&before?.executionSignal===after.executionSignal)return;
 const control=getFirestore('(default)');
 await require('./accountDeletionJob.cjs').processDeletionJob({control,jobId:event.params.jobId,requestId:after.requestId,enabled:process.env.TOWNLOOP_ACCOUNT_DELETION_ENABLED==='true'&&process.env.TOWNLOOP_SCOPED_DELETION_ENABLED==='true',dbFor:id=>getFirestore(id),auth:getAuth(),bucket:getStorage().bucket('cc-livingcommunity-app.firebasestorage.app'),verifyRules:createRulesVerifier({control,credential:getApp().options.credential})});
});
// Request-specific late uploads only; never a generic orphan cleanup service.
const {onObjectFinalized}=require('firebase-functions/v2/storage');
exports.reconcileAccountDeletionUpload=onObjectFinalized({region:'us-east1',bucket:'cc-livingcommunity-app.firebasestorage.app',retry:true,timeoutSeconds:60,maxInstances:1},async event=>{
 if(process.env.TOWNLOOP_ACCOUNT_DELETION_ENABLED!=='true'||process.env.TOWNLOOP_SCOPED_DELETION_ENABLED!=='true')return;
 const bucket=getStorage().bucket('cc-livingcommunity-app.firebasestorage.app');
 await require('./accountDeletionUpload.cjs').wakeLateUpload(getFirestore('(default)'),event.data,{liveObject:async(name,generation)=>{try{const [m]=await bucket.file(name).getMetadata();return m.generation===generation;}catch(error){if(error.code===404)return false;throw error;}}});
});
