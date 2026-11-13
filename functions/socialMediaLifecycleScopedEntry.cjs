'use strict';
// Isolated deployable adapter. Not imported by index.cjs. No approved manifest or enablement is supplied.
const {initializeApp,getApps,applicationDefault}=require('firebase-admin/app');
const {getFirestore}=require('firebase-admin/firestore');
const {getStorage}=require('firebase-admin/storage');
const {createDocumentPager}=require('./databaseCleanup.cjs');
const {DATABASES}=require('./accountDeletionScope.cjs');
const {PINS,createSocialMediaReadiness}=require('./socialMediaLifecycleReadiness.cjs');
const {createSocialMediaLifecycleHandlers}=require('./socialMediaLifecycleEntry.cjs');
const app=getApps()[0]||initializeApp({projectId:PINS.project,credential:applicationDefault()});
const db=getFirestore(app,'(default)'),databases=DATABASES.map(id=>getFirestore(app,id));
const token=async()=>{const credential=app.options.credential;if(!credential)throw Error('Worker credential unavailable');return (await credential.getAccessToken()).access_token;};
async function request(url,method='GET',body){
 const response=await fetch(url,{method,headers:{Authorization:`Bearer ${await token()}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('Social lifecycle authoritative verification unavailable');return response.json();
}
const enabled=()=>process.env.TOWNLOOP_SOCIAL_MEDIA_WORKER_ENABLED==='true'&&process.env.GCLOUD_PROJECT===PINS.project;
const queueEnabled=()=>process.env.TOWNLOOP_SOCIAL_MEDIA_QUEUE_ENABLED==='true'&&process.env.GCLOUD_PROJECT===PINS.project;
const deploymentReady=createSocialMediaReadiness({db,request});
const service=createSocialMediaLifecycleHandlers({db,databases,bucket:getStorage(app).bucket(PINS.bucket),enabled,queueEnabled,deploymentReady,serviceAccount:PINS.workerServiceAccount,listPage:source=>createDocumentPager({project:PINS.project,databaseId:source.databaseId,getAccessToken:token})});
Object.assign(exports,service.handlers);
