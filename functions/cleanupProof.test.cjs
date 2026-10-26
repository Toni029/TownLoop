const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {memoryFirestore}=require('./testSupport/memoryFirestore.cjs');
function fixture(enabled=true){
 const {db,records}=memoryFirestore({'users/alice':{approved:true},'users/bob':{approved:true}}),users=new Map(['alice','bob'].map(uid=>[uid,{uid,disabled:false,tokensValidAfterTime:'1970-01-01T00:00:00Z'}]));
 const auth={verifyIdToken:async(token,revoked)=>{assert.equal(revoked,true);if(!users.has(token))throw Error('invalid');return {uid:token};},getUser:async uid=>{if(!users.has(uid))throw Object.assign(Error('missing'),{code:'auth/user-not-found'});return users.get(uid);}};
 const module={exports:{}};vm.runInNewContext(fs.readFileSync(require.resolve('./cleanupProof.cjs'),'utf8'),{module,exports:module.exports,Date,Buffer,process:{env:{TOWNLOOP_CLEANUP_PROOF_ENABLED:enabled?'true':'false'}},require:name=>{if(name==='firebase-functions/v2/https')return {onCall:(_o,fn)=>fn,HttpsError:class extends Error{constructor(code,message){super(message);this.code=code;}}};if(name==='firebase-admin/firestore')return {getFirestore:()=>db};if(name==='firebase-admin/auth')return {getAuth:()=>auth};return require(name);}});
 const input=(uid='alice',data={})=>({auth:{uid},rawRequest:{headers:{authorization:`Bearer ${uid}`}},data});
 return {...module.exports,db,records,users,input};
}
test('cleanup-only proof survives Auth deletion, binds exact account, stores no raw secret or resident content',async()=>{
 const h=fixture(),proof=await h.registerAccountCleanupDevice(h.input());assert.equal(proof.uid,'alice');assert.notEqual(h.records.get(`account_cleanup_devices/${proof.deviceId}`).secretHash,proof.secret);
 assert.equal((await h.checkAccountCleanupProof({data:{...proof,uid:'bob'}})).confirmed,false);h.users.delete('alice');
 const result=await h.checkAccountCleanupProof({data:{...proof,uid:'bob'}});assert.equal(result.confirmed,true);assert.equal(result.uid,'alice');assert.deepEqual(Object.keys(result).sort(),['confirmed','uid']);assert.ok(h.records.has('users/bob'));
 const invalid=await h.checkAccountCleanupProof({data:{deviceId:proof.deviceId,secret:'0'.repeat(64)}});assert.equal(invalid.confirmed,false);
});
test('revocation and disable are authoritative; expiry and network failure are not deletion proof',async()=>{
 const h=fixture(),proof=await h.registerAccountCleanupDevice(h.input());h.users.get('alice').tokensValidAfterTime=new Date(Date.now()).toISOString();assert.equal((await h.checkAccountCleanupProof({data:proof})).confirmed,true);
 h.records.get(`account_cleanup_devices/${proof.deviceId}`).expiresAt=new Date(1);assert.equal((await h.checkAccountCleanupProof({data:proof})).confirmed,false);await h.expireCleanupDevices(h.db);assert.equal(h.records.has(`account_cleanup_devices/${proof.deviceId}`),false);assert.ok(h.records.has('users/alice'));
});
test('registration cannot renew another account capability and default-off protocol changes nothing',async()=>{
 const h=fixture(),proof=await h.registerAccountCleanupDevice(h.input());await assert.rejects(h.registerAccountCleanupDevice(h.input('bob',proof)),e=>e.code==='failed-precondition');
 const off=fixture(false);await assert.rejects(off.registerAccountCleanupDevice(off.input()),e=>e.code==='failed-precondition');assert.equal((await off.checkAccountCleanupProof({data:proof})).confirmed,false);assert.equal(off.records.size,2);
});
test('processing authorization closes registration before disable or proof-expiry races',async()=>{
 const h=fixture(),proof=await h.registerAccountCleanupDevice(h.input());h.records.set(`account_deletion_jobs/${require('./accountDeletionPolicy.cjs').jobIdFor('alice')}`,{review:{processingAuthorized:true}});
 await assert.rejects(h.registerAccountCleanupDevice(h.input('alice',proof)),e=>e.code==='failed-precondition');await assert.rejects(h.registerAccountCleanupDevice(h.input()),e=>e.code==='failed-precondition');
 assert.equal([...h.records.keys()].filter(k=>k.startsWith('account_cleanup_devices/')).length,1);
});
