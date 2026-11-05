const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('../node_modules/typescript');
function fixture(profile){
 const auth={currentUser:{uid:'manager',getIdToken:async force=>{assert.equal(force,true);}}},calls=[];
 const m={exports:{}};
 const code=ts.transpileModule(fs.readFileSync('native/src/news/actions.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const snapshot={exists:()=>true,data:()=>profile};
 const firestore={doc:(_db,...p)=>p.join('/'),getDoc:async()=>{calls.push('cache');return {exists:()=>true,data:()=>({role:'admin',approved:true})};},getDocFromServer:async()=>{calls.push('server');return snapshot;}};
 const modules={'firebase/firestore':firestore,'../../../src/utils/permissions':{canManageNewsletter:p=>p.approved===true&&['admin','vip'].includes(p.role)&&p.deletionPending!==true},'../lib/firebase':{auth,db:{}},'./model':{singleFlight:()=>{}},'./Editors':{}};
 new Function('require','module','exports',code)(id=>modules[id],m,m.exports);
 return {api:m.exports,auth,calls,firestore};
}
test('newsletter manager check uses refreshed identity and server profile, not cached Admin privileges',async()=>{
 for(const role of ['admin','vip']){const f=fixture({role,approved:true});assert.equal((await f.api.approvedUser(true,true)).role,role);assert.deepEqual(f.calls,['server']);}
 for(const profile of [{role:'resident',approved:true},{role:'admin',approved:false},{role:'vip',approved:true,deletionPending:true},{role:'staff',approved:true}]){
  const f=fixture(profile);await assert.rejects(f.api.approvedUser(true,true),/Only administrators|must be approved/);assert.deepEqual(f.calls,['server']);
 }
});
test('switching accounts during server profile verification cannot return the previous account’s manager identity',async()=>{
 const f=fixture({role:'admin',approved:true}),read=f.firestore.getDocFromServer;
 f.firestore.getDocFromServer=async()=>{const value=await read();f.auth.currentUser={uid:'another-account'};return value;};
 await assert.rejects(f.api.approvedUser(true,true),/account changed/);
});
