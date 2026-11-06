'use strict';
const {initializeApp}=require('firebase-admin/app');
const {getFirestore}=require('firebase-admin/firestore');
const {getAuth}=require('firebase-admin/auth');
const {getStorage}=require('firebase-admin/storage');
const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {createReadOnlyInventory,BUCKET}=require('./databaseCleanupReadOnly.cjs');
const PROJECT='cc-livingcommunity-app',app=initializeApp({projectId:PROJECT}),db=getFirestore(app,'(default)'),auth=getAuth(app),bucket=getStorage(app).bucket(BUCKET);
async function list(collection,filter){
 if(filter){const result=await db.collection(collection).where('collection','==',filter.collection).where('id','==',filter.id).limit(1).select('collection','id').get();return result.docs.map(s=>({path:s.ref.path,data:s.data()}));}
 // showMissing includes nested records whose parent document no longer exists.
 const token=await app.options.credential.getAccessToken();let page='',rows=[];
 do{const u=new URL(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/${collection.split('/').map(encodeURIComponent).join('/')}`);u.searchParams.set('showMissing','true');u.searchParams.set('pageSize','100');u.searchParams.append('mask.fieldPaths','state');if(page)u.searchParams.set('pageToken',page);
 const response=await fetch(u,{headers:{Authorization:`Bearer ${token.access_token}`},signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('inventory_read_failed');const result=await response.json();rows.push(...(result.documents||[]).map(d=>({path:d.name.split('/documents/')[1],data:{state:d.fields?.state?.stringValue}})));if(rows.length>2500)throw new HttpsError('resource-exhausted','Preview exceeds its safe inventory limit. Select fewer categories.');page=result.nextPageToken||'';
 }while(page);return rows;
}
const inventory=createReadOnlyInventory({identity:uid=>auth.getUser(uid),read:async(path,fieldMask)=>{const [s]=await db.getAll(db.doc(path),{fieldMask});return{exists:s.exists,data:s.data()};},children:async path=>(await db.doc(path).listCollections()).map(c=>c.path),list,bucketPolicy:async()=>{const [metadata]=await bucket.getMetadata();return metadata;},files:async(prefix,mode,limit)=>{const [rows,next]=await bucket.getFiles({prefix,autoPaginate:false,maxResults:limit+1,...(mode==='versions'?{versions:true}:mode==='softDeleted'?{softDeleted:true}:{})});if(next?.pageToken||rows.length>limit)throw new HttpsError('resource-exhausted','File inventory exceeds its safe preview limit.');return rows.map(f=>({name:f.name,metadata:f.metadata}));}});
exports.previewDatabaseCleanup=onCall({region:'us-central1',serviceAccount:`townloop-cleanup-preview@${PROJECT}.iam.gserviceaccount.com`,timeoutSeconds:120,memory:'256MiB',maxInstances:1,concurrency:1},async request=>{
 const bearer=request.rawRequest.headers.authorization?.match(/^Bearer (.+)$/i)?.[1];
 if(!request.auth||!bearer)throw new HttpsError('unauthenticated','Sign in with an approved Admin account.');
 try{const token=await auth.verifyIdToken(bearer,true);if(token.uid!==request.auth.uid)throw new HttpsError('unauthenticated','Refresh your session.');return await inventory(token.uid,request.data);}
 catch(error){if(['permission-denied','unauthenticated','invalid-argument','failed-precondition','resource-exhausted'].includes(error.code))throw new HttpsError(error.code,error.message);throw new HttpsError('unavailable','The read-only inventory could not be completed. Try fewer categories or retry. No data was changed.');}
});
