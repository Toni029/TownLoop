'use strict';
const {initializeApp,getApps,applicationDefault}=require('firebase-admin/app');
const {getFirestore}=require('firebase-admin/firestore');
const {getAuth}=require('firebase-admin/auth');
const {getStorage}=require('firebase-admin/storage');
const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {createCleanupSafetyReader,quotaError,cleanupFailure}=require('./cleanupSafetyReads.cjs');
const {logger}=require('firebase-functions');
const {createCleanupService,createDocumentPager}=require('./databaseCleanup.cjs');
const {validatePolicy,mediaDeletionDisabled,referenceWritersVerified,PINS}=require('./databaseCleanupSafety.cjs');
const PROJECT='cc-livingcommunity-app';
const app=getApps()[0]||initializeApp({projectId:PROJECT,credential:applicationDefault()});
const db=getFirestore(app,'(default)'),auth=getAuth(app);
const databases=['(default)',PINS.namedDatabase].map(id=>getFirestore(app,id));
const {createCleanupBarriers}=require('./databaseCleanupBarriers.cjs');
const barriers=createCleanupBarriers({db,databases});
const token=async()=>{const result=await app.options.credential.getAccessToken();return result.access_token;};
const enabled=()=>process.env.TOWNLOOP_DATABASE_CLEANUP_ENABLED==='true'&&process.env.GCLOUD_PROJECT===PROJECT;
async function get(url){
 let response;try{response=await fetch(url,{headers:{Authorization:`Bearer ${await token()}`},signal:AbortSignal.timeout(15000)});}catch{throw Object.assign(Error('Safety service unavailable'),{cleanupFailure:'safety_service_unavailable'});}
 if(response.status===429)throw quotaError(Math.max(60,Math.min(3600,Number(response.headers.get('retry-after'))||60)));
 if(!response.ok)throw Object.assign(Error('Safety service unavailable'),{cleanupFailure:'safety_service_unavailable',httpStatus:response.status});
 return response.json();
}
const safetyReader=createCleanupSafetyReader({project:PROJECT,fetchJSON:get});
const rulesHash=safetyReader.rulesHash;
async function functionInventory(){
 const responses=await Promise.all(['v1','v2'].map(version=>get(`https://cloudfunctions.googleapis.com/${version}/projects/${PROJECT}/locations/-/functions?pageSize=1000`)));
 const functions=new Map();for(const response of responses)for(const fn of response.functions||[])functions.set(fn.name,fn);
 return {functions:[...functions.values()],nextPageToken:responses.some(response=>response.nextPageToken)?'incomplete':'',unreachable:responses.flatMap(response=>response.unreachable||[])};
}
async function verifySafetyNow(){
 if(!enabled())return false;
 const policy=(await db.doc('database_cleanup_policies/current').get()).data();if(!validatePolicy(policy))return false;
 const mediaPolicy=(await db.doc('deletion_policies/media').get()).data();if(!require('./deletionRulesCompatibility.cjs').mediaProvenanceMatches(policy,mediaPolicy))return false;
 const [rules,storage,inventory,named,processing]=await Promise.all([rulesHash('cloud.firestore'),rulesHash(`firebase.storage/${PINS.bucket}`),functionInventory(),rulesHash('cloud.firestore/'+databases[1].databaseId),db.collection('account_deletion_jobs').where('status','==','processing').limit(1).get()]);
 return rules===PINS.defaultRulesSha256&&storage===PINS.storageRulesSha256&&named===PINS.namedRulesSha256&&mediaDeletionDisabled(inventory)&&referenceWritersVerified(inventory,policy)&&processing.empty;
}
const verifySafety=()=>enabled()?safetyReader.verify(verifySafetyNow):Promise.resolve(false);
const {createStorageCleanup}=require('./databaseCleanupStorage.cjs');
const media=createStorageCleanup({db,databases,bucket:getStorage(app).bucket(PINS.bucket),listPage:source=>createDocumentPager({project:PROJECT,databaseId:source.databaseId,getAccessToken:token}),deploymentReady:verifySafety,verifyBarrier:barriers.verify,trustedAfter:async()=>{const policy=(await db.doc('deletion_policies/media').get()).data();return policy?.ownerApproved&&policy.storageRulesSha256===require('./deletionMediaProvenance.json').storageRulesSha256?policy.trustedUploadsAfter?.toMillis?.():NaN;}});
const service=createCleanupService({db,enabled,verifySafety,verifyIdentity:uid=>auth.getUser(uid),listPage:createDocumentPager({project:PROJECT,getAccessToken:token}),media,acquireBarriers:barriers.acquire,releaseBarriers:barriers.release,onError:(error,context)=>logger.warn('Database cleanup paused',{...context,reason:cleanupFailure(error).code,...(Number.isInteger(error.httpStatus)?{httpStatus:error.httpStatus}:{})})});
// Dedicated least-privilege cleanup identity. No scheduler can start a purge.
const options={region:'us-central1',serviceAccount:'townloop-database-cleanup@cc-livingcommunity-app.iam.gserviceaccount.com',maxInstances:1,concurrency:1};
exports.manageDatabaseCleanup=onCall({...options,timeoutSeconds:120},async request=>{
 const bearer=request.rawRequest.headers.authorization?.match(/^Bearer (.+)$/i)?.[1];
 if(!request.auth||!bearer)throw new HttpsError('unauthenticated','Sign in with an approved Admin account.');
 try{
  const identity=await auth.verifyIdToken(bearer,true);
  if(identity.uid!==request.auth.uid)throw new HttpsError('unauthenticated','Refresh your Admin session.');
  return await require('./databaseCleanupRequest.cjs').advanceCleanupRequest(service,identity.uid,request.data);
 }catch(error){
  if(error.cleanupFailure)throw new HttpsError(error.cleanupFailure==='safety_quota_limited'?'resource-exhausted':'unavailable',cleanupFailure(error).message,{reason:error.cleanupFailure,retryAfterSeconds:error.retryAfterSeconds||15});
  const safe=['unauthenticated','permission-denied','invalid-argument','failed-precondition','already-exists','not-found'];
  if(safe.includes(error.code))throw new HttpsError(error.code,error.message);
  throw new HttpsError('unavailable','The cleanup request could not be verified. Refresh its status before retrying.');
 }
});
