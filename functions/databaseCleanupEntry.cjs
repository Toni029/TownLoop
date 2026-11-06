'use strict';
const {initializeApp,getApps,applicationDefault}=require('firebase-admin/app');
const {getFirestore}=require('firebase-admin/firestore');
const {getAuth}=require('firebase-admin/auth');
const {getStorage}=require('firebase-admin/storage');
const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {onSchedule}=require('firebase-functions/v2/scheduler');
const {createHash}=require('node:crypto');
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
async function get(url){const response=await fetch(url,{headers:{Authorization:`Bearer ${await token()}`},signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('cleanup_safety_unavailable');return response.json();}
async function rulesHash(release){
 const current=await get(`https://firebaserules.googleapis.com/v1/projects/${PROJECT}/releases/${release}`);
 if(!current.rulesetName?.startsWith(`projects/${PROJECT}/rulesets/`))throw Error('cleanup_ruleset_mismatch');
 const rules=await get(`https://firebaserules.googleapis.com/v1/${current.rulesetName}`),files=rules.source?.files;
 if(files?.length!==1||typeof files[0].content!=='string')throw Error('cleanup_ruleset_unrecognized');
 return createHash('sha256').update(files[0].content).digest('hex');
}
async function functionInventory(){
 const responses=await Promise.all(['v1','v2'].map(version=>get(`https://cloudfunctions.googleapis.com/${version}/projects/${PROJECT}/locations/-/functions?pageSize=1000`)));
 const functions=new Map();for(const response of responses)for(const fn of response.functions||[])functions.set(fn.name,fn);
 return {functions:[...functions.values()],nextPageToken:responses.some(response=>response.nextPageToken)?'incomplete':'',unreachable:responses.flatMap(response=>response.unreachable||[])};
}
async function verifySafety(){
 if(!enabled())return false;
 const policy=(await db.doc('database_cleanup_policies/current').get()).data();if(!validatePolicy(policy))return false;
 const [rules,storage,inventory,named,processing]=await Promise.all([rulesHash('cloud.firestore'),rulesHash(`firebase.storage/${PINS.bucket}`),functionInventory(),rulesHash('cloud.firestore/'+databases[1].databaseId),db.collection('account_deletion_jobs').where('status','==','processing').limit(1).get()]);
 return rules===PINS.defaultRulesSha256&&storage===PINS.storageRulesSha256&&named===PINS.namedRulesSha256&&mediaDeletionDisabled(inventory)&&referenceWritersVerified(inventory,policy)&&processing.empty;
}
const {createStorageCleanup}=require('./databaseCleanupStorage.cjs');
const media=createStorageCleanup({db,databases,bucket:getStorage(app).bucket(PINS.bucket),listPage:source=>createDocumentPager({project:PROJECT,databaseId:source.databaseId,getAccessToken:token}),deploymentReady:verifySafety,verifyBarrier:barriers.verify,trustedAfter:async()=>{const policy=(await db.doc('deletion_policies/media').get()).data();return policy?.ownerApproved&&policy.storageRulesSha256===require('./deletionMediaProvenance.json').storageRulesSha256?policy.trustedUploadsAfter?.toMillis?.():NaN;}});
const service=createCleanupService({db,enabled,verifySafety,verifyIdentity:uid=>auth.getUser(uid),listPage:createDocumentPager({project:PROJECT,getAccessToken:token}),media,acquireBarriers:barriers.acquire,releaseBarriers:barriers.release});
// Dedicated identity must be provisioned and approved separately; no existing worker identity is reused.
const options={region:'us-central1',serviceAccount:'townloop-database-cleanup@cc-livingcommunity-app.iam.gserviceaccount.com',maxInstances:1};
exports.manageDatabaseCleanup=onCall({...options,timeoutSeconds:60},async request=>{
 const bearer=request.rawRequest.headers.authorization?.match(/^Bearer (.+)$/i)?.[1];
 if(!request.auth||!bearer)throw new HttpsError('unauthenticated','Sign in with an approved Admin account.');
 try{
  const identity=await auth.verifyIdToken(bearer,true);
  if(identity.uid!==request.auth.uid)throw new HttpsError('unauthenticated','Refresh your Admin session.');
  return await service.operate(identity.uid,request.data);
 }catch(error){
  const safe=['unauthenticated','permission-denied','invalid-argument','failed-precondition','already-exists','not-found'];
  if(safe.includes(error.code))throw new HttpsError(error.code,error.message);
  throw new HttpsError('unavailable','The cleanup request could not be verified. Refresh its status before retrying.');
 }
});
exports.runDatabaseCleanup=onSchedule({...options,timeoutSeconds:120,schedule:'every 1 minutes',timeZone:'Etc/UTC',retryCount:0},async()=>{
 const deadline=Date.now()+45000;for(let step=0;step<80&&Date.now()<deadline;step++)if(!await service.tick())break;
});
