import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=ts.transpileModule(readFileSync(new URL('../src/lib/registration.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
function fixture(response:unknown,failure?:unknown){
 const calls:any[]=[],exports:any={},auth={currentUser:{uid:'signed-in-user'}};
 vm.runInNewContext(source,{exports,require:(name:string)=>{
  if(name==='firebase/functions')return{getFunctions:(_app:any,region:string)=>{assert.equal(region,'us-central1');return{};},httpsCallable:(_f:any,name:string)=>async(input:any)=>{calls.push({name,input});if(failure)throw failure;return{data:typeof response==='function'?await response():response};}};
  if(name==='../../../src/data/legal')return{TERMS_VERSION:'2026-10-draft1'};
  if(name==='./profile')return{friendlyError:()=> 'Friendly auth error'};
  if(name==='./firebase')return{app:{},auth};
  throw Error(`Unexpected module: ${name}`);
 }});return{api:exports,calls,auth};
}
const input={name:'Resident',address:'1 Main',phone:'',emergencyContactName:'',emergencyContactPhone:'',emergencyContactAddress:'',termsAccepted:true};
test('registration sends current terms to the server with no client identity or approval fields',async()=>{
 const f=fixture({status:'pending',created:true,submittedAt:1,expiresAt:2});
 await f.api.submitResidentRegistration(input);
 assert.equal(f.calls[0].name,'submitResidentRegistration');assert.equal(f.calls[0].input.termsVersion,'2026-10-draft1');
 assert.equal(f.calls[0].input.expectedUid,'signed-in-user');assert.equal(f.calls[0].input.uid,undefined);assert.equal(f.calls[0].input.email,undefined);assert.equal(f.calls[0].input.approved,undefined);
});
test('missing backend and malformed responses fail visibly without a write fallback',async()=>{
 const missing={code:'functions/not-found'};const f=fixture(null,missing);
 await assert.rejects(f.api.submitResidentRegistration(input),e=>e===missing);
 assert.match(f.api.registrationError(missing),/service is unavailable/);assert.equal(f.calls.length,1);
 await assert.rejects(fixture({}).api.submitResidentRegistration(input),/unexpected response/);
 await assert.rejects(fixture({items:[],serverNow:null}).api.manageRegistrationLifecycle({action:'listPending'}),/unexpected response/);
});
test('confirmed denial and lift requests preserve explicit operator intent',async()=>{
 const f=fixture({});
 await f.api.manageRegistrationLifecycle({action:'deny',uid:'target',category:'abuse',reason:'fraud',confirmed:true});
 await f.api.manageRegistrationLifecycle({action:'liftRestriction',restrictionId:'opaque',reason:'Reviewed in error',confirmed:true});
 assert.equal(f.calls[0].input.confirmed,true);assert.equal(f.calls[0].input.category,'abuse');assert.equal(f.calls[1].input.restrictionId,'opaque');
});

test('account switching rejects an in-flight registration response and carries the session guard',async()=>{
 const f=fixture(()=>{f.auth.currentUser.uid='different-user';return{status:'pending',created:true,submittedAt:1,expiresAt:2};});
 await assert.rejects(f.api.submitResidentRegistration(input),/account changed/);assert.equal(f.calls[0].input.expectedUid,'signed-in-user');
});
