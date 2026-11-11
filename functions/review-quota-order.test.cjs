const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(exhausted=false){
 const id='a'.repeat(64),profile={approved:true,role:'admin'},records=new Map([['users/admin',profile],[`account_deletion_jobs/${id}`,{uid:'resident',status:'requested',phase:'requested',createdAt:new Date()}],['deletion_policies/account',{}]]),writes=[];
 if(exhausted)records.set('safety_limits/admin',{activity:{adminMutation:{windowAt:new Date(),dayAt:new Date(),windowCount:30,dayCount:30}}});
 const snap=path=>({exists:records.has(path),data:()=>records.get(path)}),ref=path=>({path,get:async()=>snap(path),collection:name=>({doc:id=>ref(`${path}/${name}/${id}`)})});
 const db={doc:ref,async runTransaction(action){let wrote=false;const pending=[];const tx={async get(r){assert.equal(wrote,false,'Firestore transactions must finish reads before writes');return snap(r.path);},create(r,value){wrote=true;pending.push(()=>records.set(r.path,value));writes.push(r.path);},set(r,value){wrote=true;pending.push(()=>records.set(r.path,value));writes.push(r.path);},update(r,value){wrote=true;pending.push(()=>records.set(r.path,{...records.get(r.path),...value}));writes.push(r.path);}};const result=await action(tx);pending.forEach(fn=>fn());return result;}};
 class HttpsError extends Error{constructor(code,message){super(message);this.code=code;}}
 const deps={'firebase-functions/v2/https':{onCall:(_,fn)=>fn,HttpsError},'firebase-admin/firestore':{getFirestore:()=>db,FieldValue:{serverTimestamp:()=>new Date()}},'firebase-admin/auth':{getAuth:()=>({verifyIdToken:async()=>({uid:'admin'})})}};
 const m={exports:{}};vm.runInNewContext(fs.readFileSync(__dirname+'/accountDeletionReview.cjs','utf8'),{exports:m.exports,module:m,require:name=>deps[name]||require(name),process:{env:{}},Date});
 return {records,writes,run:()=>m.exports.reviewAccountDeletionRequest({auth:{uid:'admin'},rawRequest:{headers:{authorization:'Bearer fixture'}},data:{jobId:id,decision:'approved',confirmation:'approved',reason:'Verified request'}})};
}
test('authorized review reads its quota before writes and duplicate review spends no second allowance',async()=>{
 const h=fixture();assert.equal((await h.run()).status,'approved_held');assert.equal(h.records.get('safety_limits/admin').activity.adminMutation.dayCount,1);const count=h.writes.length;await h.run();assert.equal(h.writes.length,count);
});
test('exhausted review allowance applies no decision or audit writes',async()=>{const h=fixture(true);await assert.rejects(h.run(),e=>e.code==='resource-exhausted');assert.equal(h.writes.length,0);});
