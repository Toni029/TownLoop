'use strict';
// Same existing schedule; only undecided new-policy requests are authorized here.
const {getApps,initializeApp}=require('firebase-admin/app');
const {getFirestore}=require('firebase-admin/firestore');
const {onSchedule}=require('firebase-functions/v2/scheduler');
if(!getApps().length)initializeApp();
exports.fulfillApprovedAccountDeletions=onSchedule({region:'us-central1',schedule:'every 5 minutes',timeZone:'Etc/UTC',timeoutSeconds:300,maxInstances:1,retryCount:0},async()=>{
 if(process.env.TOWNLOOP_ACCOUNT_DELETION_ENABLED!=='true'||process.env.TOWNLOOP_AUTOMATIC_ACCOUNT_DELETION_ENABLED!=='true'||process.env.TOWNLOOP_SCOPED_DELETION_ENABLED!=='true')return;
 await require('./accountDeletionLifecycle.cjs').authorizeOverdue(getFirestore('(default)'));
});
