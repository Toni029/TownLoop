import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';import ts from 'typescript';
const source=(file:string)=>ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
function profileFixture(existing:boolean,accepted:boolean){
 const writes:any[]=[],signedOut:string[]=[];const user={uid:'fixture',email:'fixture@example.invalid',displayName:'Fixture',photoURL:''};const auth:any={currentUser:user};const exports:any={};
 vm.runInNewContext(source('../src/lib/googleProfile.ts'),{exports,require:(name:string)=>name==='firebase/auth'?{signOut:async()=>{signedOut.push(auth.currentUser.uid);auth.currentUser=null;}}:name==='firebase/firestore'?{doc:()=>({}),serverTimestamp:()=> 'server-time',runTransaction:async(_db:any,fn:any)=>fn({get:async()=>({exists:()=>existing}),set:(_ref:any,data:any)=>writes.push(data)})}:name==='../../../src/data/legal'?{TERMS_VERSION:'fixture-terms',requireTermsAcceptance:(value:boolean)=>{if(!value)throw Error('Terms required');}}:{auth,db:{}}});
 return {finish:()=>exports.finishGoogleSignIn(user,accepted),writes,signedOut,auth};
}
test('existing Google profiles retain approval and roles without requiring registration consent again',async()=>{const f=profileFixture(true,false);await f.finish();assert.equal(f.writes.length,0);assert.equal(f.signedOut.length,0);});
test('new Google profiles require explicit consent and always begin as unapproved residents',async()=>{let f=profileFixture(false,false);await assert.rejects(f.finish(),/Terms required/);assert.equal(f.writes.length,0);assert.equal(f.signedOut.length,1);f=profileFixture(false,true);await f.finish();assert.equal(f.writes[0].role,'resident');assert.equal(f.writes[0].approved,false);assert.equal(f.writes[0].termsAcceptedAt,'server-time');});
function nativeFixture(configured:boolean,present:boolean,canceled=false){
 let loads=0,authCalls=0,finished=0;const exports:any={};const config:any={webClientId:'fixture.apps.googleusercontent.com',androidOAuthRegistered:configured,iosOAuthRegistered:false,iosClientId:''};
 const sdk={GoogleSignin:{configure:(o:any)=>{assert.equal(o.offlineAccess,false);assert.equal(o.scopes,undefined);},hasPlayServices:async()=>true,signIn:async()=>canceled?{type:'cancelled'}:{type:'success',data:{idToken:'fixture-token'}}},isSuccessResponse:(r:any)=>r.type==='success',statusCodes:{SIGN_IN_CANCELLED:'cancelled'}};
 vm.runInNewContext(source('../src/lib/googleSignIn.ts'),{exports,require:(name:string)=>{
  if(name==='react-native')return{Platform:{OS:'android'},TurboModuleRegistry:{get:()=>present?{}:null}};
  if(name==='../../google-auth.json')return config;
  if(name==='firebase/auth')return{GoogleAuthProvider:{credential:()=>({providerId:'google.com'})},signInWithCredential:async()=>{authCalls++;return{user:{uid:'fixture'}};}};
  if(name==='./firebase')return{auth:{}};
  if(name==='./googleProfile')return{finishGoogleSignIn:async()=>{finished++;}};
  if(name==='@react-native-google-signin/google-signin'){loads++;return sdk;}throw Error(name);
 }});return{api:exports,counts:()=>({loads,authCalls,finished})};
}
test('older APKs and unregistered OAuth cannot load the native SDK or advertise Google sign-in',async()=>{for(const [configured,present]of [[true,false],[false,true]]){const f=nativeFixture(configured,present);assert.equal(f.api.googleSignInAvailable,false);await assert.rejects(f.api.googleSignIn(),/configured Google-enabled/);assert.equal(f.counts().loads,0);}});
test('native Google credentials sign into the existing Firebase Auth instance; cancellation creates no session',async()=>{let f=nativeFixture(true,true);await f.api.googleSignIn(true);assert.deepEqual(f.counts(),{loads:1,authCalls:1,finished:1});f=nativeFixture(true,true,true);await f.api.googleSignIn(true);assert.equal(f.counts().authCalls,0);assert.equal(f.counts().finished,0);});
test('web Google login uses Firebase popup and the same consent/profile completion',async()=>{
 const exports:any={};let popup=0,consent:any;
 vm.runInNewContext(source('../src/lib/googleSignIn.web.ts'),{exports,require:(name:string)=>name==='firebase/auth'?{GoogleAuthProvider:class{},signInWithPopup:async()=>{popup++;return{user:{uid:'fixture'}};}}:name==='./firebase'?{auth:{}}:{finishGoogleSignIn:async(_user:any,accepted:boolean)=>{consent=accepted;}}});
 assert.equal(exports.googleSignInAvailable,true);await exports.googleSignIn(true);assert.equal(popup,1);assert.equal(consent,true);
});
