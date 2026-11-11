'use strict';
const {initializeApp,getApps}=require('firebase-admin/app');
const {getFirestore}=require('firebase-admin/firestore');
const {getAuth}=require('firebase-admin/auth');
const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {GoogleAuth}=require('google-auth-library');
const {charge}=require('./abuseLimits.cjs');
const {createCleanupQuotaGateway,createPrivateInventoryInvoker,PROJECT,GATEWAY_SERVICE_ACCOUNT}=require('./databaseCleanupQuotaGateway.cjs');
const app=getApps().find(a=>a.name==='townloop-request-controls')||initializeApp({projectId:PROJECT},'townloop-request-controls');
const db=getFirestore(app,'(default)'),auth=getAuth(app);
const gateway=createCleanupQuotaGateway({verifyIdentity:token=>auth.verifyIdToken(token,true),read:async(path,fieldMask)=>{const[s]=await db.getAll(db.doc(path),{fieldMask});return{exists:s.exists,data:s.data()};},charge:(...args)=>charge(db,...args),invoke:createPrivateInventoryInvoker({googleAuth:new GoogleAuth()})});
exports.previewDatabaseCleanup=onCall({region:'us-central1',serviceAccount:GATEWAY_SERVICE_ACCOUNT,timeoutSeconds:120,memory:'256MiB',maxInstances:1,concurrency:1,invoker:'public',enforceAppCheck:false},async request=>{
 try{return await gateway(request);}
 catch(error){const codes=['unauthenticated','permission-denied','invalid-argument','failed-precondition','resource-exhausted','unavailable'];if(codes.includes(error?.code))throw new HttpsError(error.code,error.message,error.details);throw new HttpsError('unavailable','The read-only preview is temporarily unavailable. No data was deleted.');}
});
