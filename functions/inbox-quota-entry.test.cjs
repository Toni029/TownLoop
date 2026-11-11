const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('callable preserves resource-exhausted and safe retry information instead of reporting INTERNAL',async()=>{
 class HttpsError extends Error{constructor(code,message,details){super(message);Object.assign(this,{code,details});}}
 const limit=Object.assign(Error('bounded'),{code:'resource-exhausted',safeReason:'request-limit',safeMessage:'Please wait before trying again.',retryAfterMs:45000});
 const deps={'firebase-functions/v2/https':{onCall:(_,fn)=>fn,HttpsError},'firebase-functions/v2/firestore':{onDocumentCreated:(_,fn)=>fn,onDocumentWritten:(_,fn)=>fn},'firebase-admin/firestore':{getFirestore:()=>({})},'firebase-admin/auth':{getAuth:()=>({getUser:async()=>({disabled:false})})},'./inbox-groups.cjs':{operate:async()=>{throw limit;}},'./inbox-groups-push.cjs':{deliverGroup:()=>{}}};
 const m={exports:{}};vm.runInNewContext(fs.readFileSync(__dirname+'/inbox-groups-entry.cjs','utf8'),{exports:m.exports,module:m,require:name=>deps[name],process:{env:{INBOX_GROUPS_ENABLED:'true'}},Date});
 await assert.rejects(m.exports.manageInboxConversation({auth:{uid:'a',token:{auth_time:1}},data:{op:'send'}}),e=>e.code==='resource-exhausted'&&e.message==='Please wait before trying again.'&&e.details.retryAfterSeconds===45);
});
