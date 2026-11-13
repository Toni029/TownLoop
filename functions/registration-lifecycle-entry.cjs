// Isolated opt-in exports. No functions are deployed or schedules enabled by this file.
const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {onSchedule}=require('firebase-functions/v2/scheduler');
const {defineSecret}=require('firebase-functions/params');
const {getFirestore}=require('firebase-admin/firestore');
const {getAuth}=require('firebase-admin/auth');
const {createRegistrationLifecycle,ms}=require('./registrationLifecycle.cjs');
const hmac=defineSecret('TOWNLOOP_REGISTRATION_EMAIL_HMAC');
const options={region:'us-central1',serviceAccount:'townloop-registration-api@cc-livingcommunity-app.iam.gserviceaccount.com',minInstances:0,memory:'256MiB',maxInstances:2,timeoutSeconds:90,secrets:[hmac]};
async function service(){
 if(process.env.TOWNLOOP_REGISTRATION_API_ENABLED!=='true'||process.env.GCLOUD_PROJECT!=='cc-livingcommunity-app')throw new HttpsError('failed-precondition','Registration service update is pending. Please contact support.');
 const db=getFirestore('(default)'),policy=(await db.doc('registration_policy/active').get()).data();
 if(policy?.approved!==true||!Number.isFinite(ms(policy.trustedAuthAfter))||ms(policy.trustedAuthAfter)<=0)throw new HttpsError('failed-precondition','Registration security setup is pending.');
 return createRegistrationLifecycle({db,auth:getAuth(),secret:()=>hmac.value(),trustedAuthAfter:ms(policy.trustedAuthAfter)});
}
async function caller(request){try{const header=request.rawRequest?.headers?.authorization;if(!request.auth?.uid||typeof header!=='string'||!header.startsWith('Bearer '))throw Error();const decoded=await getAuth().verifyIdToken(header.slice(7),true);if(decoded.uid!==request.auth.uid)throw Error();return decoded.uid;}catch{throw new HttpsError('unauthenticated','Please sign in again.');}}
function callable(run){return onCall(options,async request=>{try{const uid=await caller(request);if(request.data?.expectedUid!==uid)throw new HttpsError('failed-precondition','Your account changed. Reopen this screen.');const api=await service();return await run(api,uid,request.data);}catch(e){if(e instanceof HttpsError)throw e;const allowed=['permission-denied','invalid-argument','failed-precondition','unauthenticated'];throw new HttpsError(allowed.includes(e.code)?e.code:'unavailable',allowed.includes(e.code)?e.message:'Registration could not finish. Please retry; no approval was granted.');}});}
exports.submitResidentRegistration=callable((api,uid,data)=>api.submit(uid,data));
exports.manageRegistrationLifecycle=callable((api,uid,data)=>api.manage(uid,data));
exports.processRegistrationLifecycle=onSchedule({...options,serviceAccount:'townloop-registration-cleanup@cc-livingcommunity-app.iam.gserviceaccount.com',maxInstances:1,timeoutSeconds:300,schedule:'every 60 minutes',timeZone:'Etc/UTC',retryCount:3,minBackoffSeconds:60,maxBackoffSeconds:300},async()=>{if(process.env.TOWNLOOP_REGISTRATION_API_ENABLED!=='true'||process.env.TOWNLOOP_REGISTRATION_WORKER_ENABLED!=='true'||process.env.GCLOUD_PROJECT!=='cc-livingcommunity-app')return;const api=await service();const result=await api.sweep();console.info('[Registration lifecycle]',{expired:result.expired,reminded:result.reminded,processed:result.outcomes.length});});
