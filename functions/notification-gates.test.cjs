const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function fixture(env={}){
 const exports={},calls=[],logs=[];const handler=(_options,fn)=>fn;
 vm.runInNewContext(fs.readFileSync(__dirname+'/inbox.cjs','utf8'),{exports,console:{info:line=>logs.push(JSON.parse(line))},process:{env},require:name=>{
  if(name==='firebase-functions/v2/https')return{onCall:handler,HttpsError:class extends Error{}};
  if(name==='firebase-functions/v2/firestore')return{onDocumentWrittenWithAuthContext:handler};
  if(name==='firebase-functions/v2/scheduler')return{onSchedule:handler};
  if(name==='firebase-admin/firestore')return{getFirestore:()=>({})};
  if(name==='firebase-admin/auth')return{getAuth:()=>({getUser:async()=>({})})};
  if(name==='./inbox-policy.cjs')return require('./inbox-policy.cjs');
  if(name==='./inbox-push.cjs')return{deliver:async(_db,_e,_c,options)=>calls.push(options),deliverContent:async(_db,_e,_c,options)=>calls.push(options),checkReceipts:async()=>calls.push('receipts')};
  throw Error(name);
 }});return{exports,calls,logs};
}
test('all six triggers and receipt worker are inert unless sending, tester UID and device-platform allowlists all exist',async()=>{
 for(const env of [{},{INBOX_PUSH_ENABLED:'true'},{PUSH_TESTER_UIDS:'fixture'},{INBOX_PUSH_ENABLED:'true',PUSH_TESTER_UIDS:'fixture'}]){
  const f=fixture(env);for(const [name,fn]of Object.entries(f.exports))if(name.startsWith('notify')||name==='checkInboxPushReceipts')await fn({});assert.equal(f.calls.length,0);
 }
 const f=fixture({INBOX_PUSH_ENABLED:'true',PUSH_TESTER_UIDS:'fixture',PUSH_TESTER_PLATFORMS:'android'});await f.exports.notifyDiscussion({});assert.equal(f.calls.length,1);assert.equal(f.calls[0].recipientAllowed('fixture'),true);assert.equal(f.calls[0].recipientAllowed('resident'),false);assert.equal(f.calls[0].deviceAllowed({platform:'android'}),true);assert.equal(f.calls[0].deviceAllowed({platform:'ios'}),false);
});

test('temporary traces require explicit future expiry and remain bounded and identifier-free',async()=>{
 const env={INBOX_PUSH_ENABLED:'true',PUSH_TESTER_UIDS:'fixture',PUSH_TESTER_PLATFORMS:'android',PUSH_DIAGNOSTICS_ENABLED:'true',PUSH_DIAGNOSTICS_UNTIL:new Date(Date.now()+60000).toISOString()};
 const f=fixture(env);await f.exports.notifyDiscussion({});
 f.calls[0].trace({secret:'PRIVATE'});f.calls[0].trace('https://private/token');
 for(let i=0;i<25;i++)f.calls[0].trace('principal_missing');
 assert.equal(f.logs.length,10);assert(f.logs.every(x=>Object.keys(x).sort().join(',')==='component,stage'));
 for(const expiry of ['',new Date(0).toISOString()]){const off=fixture({...env,PUSH_DIAGNOSTICS_UNTIL:expiry});await off.exports.notifyDiscussion({});off.calls[0].trace('principal_missing');assert.equal(off.logs.length,0);}
});
