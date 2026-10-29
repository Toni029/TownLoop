const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {onDocumentWrittenWithAuthContext}=require('firebase-functions/v2/firestore');
const {onSchedule}=require('firebase-functions/v2/scheduler');
const {getFirestore}=require('firebase-admin/firestore');
const {getAuth}=require('firebase-admin/auth');
const {collections}=require('./inbox-policy.cjs');
const {registerDevice,deliver,deliverContent,notificationState,checkReceipts}=require('./inbox-push.cjs');
const testers=()=>new Set((process.env.PUSH_TESTER_UIDS||'').split(',').map(s=>s.trim()).filter(Boolean));
const platforms=()=>new Set((process.env.PUSH_TESTER_PLATFORMS||'').split(',').map(s=>s.trim()).filter(s=>['android','ios'].includes(s)));
// Missing scope preserves tester-only behavior. Unknown values fail closed.
const scope=()=>process.env.PUSH_RECIPIENT_SCOPE??'testers';
const recipientAllowed=uid=>scope()==='approved'||scope()==='testers'&&testers().has(uid);
// Actual delivery also verifies canonical approval, membership, blocks and preferences.
const sendingAllowed=()=>process.env.INBOX_PUSH_ENABLED==='true'&&platforms().size>0&&(scope()==='approved'||scope()==='testers'&&testers().size>0);
const deviceAllowed=device=>platforms().has(device.platform);
const options={region:'us-central1',maxInstances:4,timeoutSeconds:60};
function deliveryTrace(){
 let remaining=12;
 return code=>{
  if(process.env.PUSH_DIAGNOSTICS_ENABLED!=='true'||!(Date.parse(process.env.PUSH_DIAGNOSTICS_UNTIL)>Date.now())||remaining--<=0)return;
  if(typeof code!=='string'||!/^[a-z_]{1,48}$/.test(code))return;
  try{console.info(JSON.stringify({component:'townloop_push',stage:code}));}catch{}
 };
}

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
 if(!sendingAllowed())return;
 await deliver(getFirestore(),event,collection,{identity:uid=>getAuth().getUser(uid),transport,recipientAllowed,deviceAllowed,trace:deliveryTrace()});
});
exports.checkInboxPushReceipts=onSchedule({...options,schedule:'every 15 minutes'},async()=>{
 if(!sendingAllowed())return;
 await checkReceipts(getFirestore(),{transport});
});

exports.getNotificationState=onCall(options,async request=>{
 try{return await notificationState(getFirestore(),request.auth?.uid,request.data||{});}
 catch(error){const code=['unauthenticated','permission-denied','invalid-argument'].includes(error.message)?error.message:'internal';throw new HttpsError(code,'Unable to update notification state.');}
});
for(const [collection,name]of [['discussion_feed','notifyDiscussion'],['work_orders','notifyWorkOrderDone']])exports[name]=onDocumentWrittenWithAuthContext({...options,database:'(default)',document:`${collection}/{documentId}`,retry:true},async event=>{
 if(!sendingAllowed())return;
 await deliverContent(getFirestore(),event,collection,{identity:uid=>getAuth().getUser(uid),transport,recipientAllowed,deviceAllowed,trace:deliveryTrace()});
});
Object.defineProperty(exports, 'groupDeliveryDependencies', { value: { sendingAllowed, recipientAllowed, deviceAllowed, transport }, enumerable: false });
