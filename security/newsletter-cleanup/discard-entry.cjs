'use strict';
// Isolated manual discard only: no scheduler, Gemini secret or account-deletion import.
const {getApps,initializeApp,getApp}=require('firebase-admin/app');
const {getFirestore}=require('firebase-admin/firestore');
const {getAuth}=require('firebase-admin/auth');
const {getStorage}=require('firebase-admin/storage');
const {createHash}=require('node:crypto');
const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {purgeDraft}=require('./newsletterDraftCleanup.cjs');
if(!getApps().length)initializeApp();
exports.discardNewsletterDraft=onCall({region:'us-central1',timeoutSeconds:300,maxInstances:1,serviceAccount:'883715389126-compute@developer.gserviceaccount.com'},async request=>{
 if(!request.auth?.uid)throw new HttpsError('unauthenticated','Sign in again.');
 const db=getFirestore('(default)'),profile=(await db.doc('users/'+request.auth.uid).get()).data();
 if(profile?.approved!==true||profile.deletionPending===true||!['admin','vip'].includes(profile.role))throw new HttpsError('permission-denied','Only approved Admin/VIP accounts can discard uploads.');
 const account=await getAuth().getUser(request.auth.uid);if(account.disabled)throw new HttpsError('permission-denied','Sign in again.');
 try{
  if(process.env.TOWNLOOP_NEWSLETTER_DRAFT_DISCARD_ENABLED!=='true')throw Object.assign(Error('Manual newsletter discard is not active. Nothing was removed.'),{code:'failed-precondition'});
  const token=(await getApp().options.credential.getAccessToken()).access_token;
  const read=async url=>{const r=await fetch(url,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('rules-check-unavailable');return r.json();};
  const release=await read('https://firebaserules.googleapis.com/v1/projects/cc-livingcommunity-app/releases/cloud.firestore'),set=await read('https://firebaserules.googleapis.com/v1/'+release.rulesetName);
  if(createHash('sha256').update(set.source.files.map(f=>f.content).join('\n')).digest('hex')!=='8d105d51885783e5b98993ca185d0ac968abf4d1eb423f53d78710e78dcc9047')throw Object.assign(Error('Newsletter discard requires matching publication/write protections. Nothing was removed.'),{code:'failed-precondition'});
  return await purgeDraft(db,request.data?.newsletterId,{actor:request.auth.uid,reason:'discarded',enabled:process.env.TOWNLOOP_NEWSLETTER_DRAFT_DISCARD_ENABLED==='true',assertStorageEmpty:async id=>{
  const [files]=await getStorage().bucket('cc-livingcommunity-app.firebasestorage.app').getFiles({prefix:`newsletters/${id}/`,maxResults:1,autoPaginate:false});
  if(files.length)throw Object.assign(Error('This upload has historical Storage files whose exclusive ownership requires review. No Storage files were deleted.'),{code:'failed-precondition'});
 }});}
 catch(e){const code=['permission-denied','failed-precondition'].includes(e.code)?e.code:'unavailable';throw new HttpsError(code,code==='unavailable'?'Discard could not finish. Retry; the published newsletter is unchanged.':e.message);}
});
