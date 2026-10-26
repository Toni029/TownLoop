import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
function configure(env:Record<string,string>,local=false,project='cc-livingcommunity-app',app='com.toni029.townloop'){
 const module={exports:(_:any)=>({})},source=fs.readFileSync(new URL('../plugins/with-inbox-push.cjs',import.meta.url),'utf8');
 vm.runInNewContext(source,{module,__dirname:'/native/plugins',process:{env},require:(id:string)=>{
  if(id==='node:path')return require('node:path');
  if(id==='node:fs')return {existsSync:()=>local,readFileSync:()=>JSON.stringify({project_info:{project_id:project},client:[{client_info:{android_client_info:{package_name:app}}}]})};
  if(id==='expo/config-plugins')return {withEntitlementsPlist:(config:any,apply:any)=>({...config,entitlements:apply({modResults:{}}).modResults})};
  throw Error('unexpected dependency');
 }});
 return module.exports({android:{package:'com.toni029.townloop'}}) as any;
}
test('Android requires matching Firebase configuration; local ignored file and EAS file both work',()=>{
 assert.throws(()=>configure({EAS_BUILD_PLATFORM:'android'}),/Supply/);
 assert.throws(()=>configure({GOOGLE_SERVICES_JSON:'/secret/file'},false,'wrong-project'),/does not match/);
 assert.throws(()=>configure({GOOGLE_SERVICES_JSON:'/secret/file'},false,'cc-livingcommunity-app','other.app'),/does not match/);
 assert.equal(configure({EAS_BUILD_PLATFORM:'android'},true).android.googleServicesFile,'/native/credentials/google-services.preview.json');
 assert.equal(configure({GOOGLE_SERVICES_JSON:'/eas/file',EAS_BUILD_PLATFORM:'android'}).android.googleServicesFile,'/eas/file');
});
test('physical iPhone Preview uses production APNs; development provisioning uses sandbox',()=>{
 assert.equal(configure({EAS_BUILD_PROFILE:'preview'}).entitlements['aps-environment'],'production');
 assert.equal(configure({EAS_BUILD_PROFILE:'development'}).entitlements['aps-environment'],'development');
 const eas=JSON.parse(fs.readFileSync(new URL('../eas.json',import.meta.url),'utf8'));
 assert.equal(eas.build.preview.ios.simulator,false);assert.equal(eas.build.preview.ios.credentialsSource,'remote');
 assert.equal(eas.build.preview.channel,'preview');assert.equal(eas.build.production.channel,'production');
 assert.equal(eas.build.preview.android.credentialsSource,'local');
});
