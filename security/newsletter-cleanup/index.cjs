'use strict';
const {initializeApp,getApps}=require('firebase-admin/app');
const {getFirestore}=require('firebase-admin/firestore');
const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {onSchedule}=require('firebase-functions/v2/scheduler');
const {purgeDraft,sweepDrafts}=require('./newsletterDraftCleanup.cjs');
if(!getApps().length)initializeApp();
const db=getFirestore('(default)');
// Requires separate deployment + rules + explicit activation approval.
const enabled=()=>process.env.TOWNLOOP_NEWSLETTER_DRAFT_PURGE_ENABLED==='true'&&process.env.TOWNLOOP_NEWSLETTER_DRAFT_FENCE_VERIFIED==='v1';
const options={region:'us-central1',serviceAccount:'townloop-newsletter-cleanup@cc-livingcommunity-app.iam.gserviceaccount.com',maxInstances:1,timeoutSeconds:300};
exports.discardNewsletterDraft=onCall(options,async request=>{
 if(!request.auth?.uid)throw new HttpsError('unauthenticated','Please sign in again.');
 try{return await purgeDraft(db,request.data?.newsletterId,{actor:request.auth.uid,reason:'discarded',enabled:enabled()});}
 catch(error){const known=['permission-denied','failed-precondition'].includes(error.code);throw new HttpsError(known?error.code:'unavailable',known?error.message:'Discard could not finish. Retry; the published newsletter is unchanged.');}
});
exports.cleanupAbandonedNewsletterDrafts=onSchedule({...options,schedule:'every 60 minutes',timeZone:'Etc/UTC'},()=>sweepDrafts(db,{enabled:enabled()}));
