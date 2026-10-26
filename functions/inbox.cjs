const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {onDocumentWrittenWithAuthContext}=require('firebase-functions/v2/firestore');
const {onSchedule}=require('firebase-functions/v2/scheduler');
const {getFirestore}=require('firebase-admin/firestore');
const {getAuth}=require('firebase-admin/auth');
const {collections}=require('./inbox-policy.cjs');
const {registerDevice,deliver,checkReceipts}=require('./inbox-push.cjs');
const options={region:'us-central1',maxInstances:4,timeoutSeconds:60};
async function transport(path,body){
 const headers={'Content-Type':'application/json'};
 // Optional Expo enhanced push security credential is server-only, never bundled.
 if(process.env.EXPO_ACCESS_TOKEN)headers.Authorization=`Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
 const response=await fetch(`https://exp.host/--/api/v2/push/${path}`,{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('push_transport_failed');return response.json();
}
exports.registerInboxDevice=onCall(options,async request=>{
 try{return await registerDevice(getFirestore(),request.auth?.uid,request.data||{},{authTime:request.auth?.token.auth_time});}
 catch(error){const code=['unauthenticated','permission-denied','invalid-argument'].includes(error.message)?error.message:'internal';throw new HttpsError(code,'Unable to update notification registration.');}
});
for(const [collection,category]of Object.entries(collections))exports[`notifyInbox${category[0].toUpperCase()}${category.slice(1)}`]=onDocumentWrittenWithAuthContext({...options,database:'(default)',document:`${collection}/{chatId}`,retry:true},async event=>{
 if(process.env.INBOX_PUSH_ENABLED!=='true')return;
 await deliver(getFirestore(),event,collection,{identity:uid=>getAuth().getUser(uid),transport});
});
exports.checkInboxPushReceipts=onSchedule({...options,schedule:'every 15 minutes'},async()=>{
 if(process.env.INBOX_PUSH_ENABLED!=='true')return;
 await checkReceipts(getFirestore(),{transport});
});
