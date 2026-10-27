const test=require('node:test'),assert=require('node:assert/strict'),{validateAndroidConfig}=require('../plugins/google-oauth.cjs');
const options={webClientId:'883715389126-web.apps.googleusercontent.com',previewCertificateSHA1:'a'.repeat(40)};
const fixture=()=>({project_info:{project_id:'cc-livingcommunity-app',project_number:'883715389126'},client:[{client_info:{mobilesdk_app_id:'1:883715389126:android:9be9bbe73fece14e27c9c7',android_client_info:{package_name:'com.toni029.townloop'}},oauth_client:[{client_type:1,client_id:'883715389126-android.apps.googleusercontent.com',android_info:{package_name:'com.toni029.townloop',certificate_hash:'a'.repeat(40)}},{client_type:3,client_id:options.webClientId}]}]});
test('accepts only matching TownLoop Android package, Firebase app, existing web client and verified signing identity',()=>{assert.equal(validateAndroidConfig(fixture(),options),true);});
test('unregistered, wrong project/package/certificate and replacement web client fail closed',()=>{
 for(const change of [d=>{d.project_info.project_id='wrong';},d=>{d.client[0].client_info.android_client_info.package_name='wrong';},d=>{d.client[0].oauth_client=[];},d=>{d.client[0].oauth_client[0].android_info.certificate_hash='b'.repeat(40);},d=>{d.client[0].oauth_client[1].client_id='replacement';}]){const d=fixture();change(d);assert.throws(()=>validateAndroidConfig(d,options));}
});
