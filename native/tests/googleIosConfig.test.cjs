const test=require('node:test'),assert=require('node:assert/strict');
const {validateIosConfig,reversedClientId}=require('../plugins/google-oauth.cjs');
const options={iosClientId:'883715389126-ios.apps.googleusercontent.com'};
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const fixture=()=>({PROJECT_ID:'cc-livingcommunity-app',GCM_SENDER_ID:'883715389126',GOOGLE_APP_ID:'1:883715389126:ios:abc123',BUNDLE_ID:'com.toni029.townloop',CLIENT_ID:options.iosClientId,REVERSED_CLIENT_ID:reversedClientId(options.iosClientId)});
test('validates Firebase iOS project, app, bundle, OAuth client and exact callback',()=>{
 assert.equal(validateIosConfig(fixture(),options),true);
});
function configure({enabled=true,exists=true,data=fixture(),platform='ios'}={}){
 const module={exports:null};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../plugins/with-google-auth.cjs'),'utf8'),{
  module,__dirname:'/native/plugins',process:{env:{EAS_BUILD_PLATFORM:platform}},require:id=>{
   if(id==='../google-auth.json')return {...options,iosOAuthRegistered:enabled,androidOAuthRegistered:false};
   if(id==='node:fs')return {existsSync:()=>exists,readFileSync:()=>JSON.stringify(data)};
   if(id==='node:path')return path;
   if(id==='@expo/plist')return {parse:JSON.parse};
   if(id==='./google-oauth.cjs')return require('../plugins/google-oauth.cjs');
   if(id==='@react-native-google-signin/google-signin/app.plugin.js')return (config,settings)=>({...config,callback:settings.iosUrlScheme});
   throw Error('unexpected dependency');
  }
 });
 return module.exports({ios:{bundleIdentifier:'com.toni029.townloop'}});
}
test('iOS native plugin gates callback registration on actual validated configuration',()=>{
 assert.equal(configure().callback,fixture().REVERSED_CLIENT_ID);
 assert.throws(()=>configure({exists:false}),/Supply/);
 assert.throws(()=>configure({data:{...fixture(),BUNDLE_ID:'wrong'}}),/bundle/);
 assert.equal(configure({enabled:false,exists:false}).callback,undefined);
 assert.equal(configure({platform:'android',exists:false}).callback,undefined);
});
test('fails closed on missing or mismatched iOS configuration',()=>{
 for(const key of Object.keys(fixture())){const data=fixture();delete data[key];assert.throws(()=>validateIosConfig(data,options));}
 for(const key of Object.keys(fixture())){const data=fixture();data[key]='wrong';assert.throws(()=>validateIosConfig(data,options));}
 assert.throws(()=>validateIosConfig(fixture(),{iosClientId:'999-ios.apps.googleusercontent.com'}));
});
