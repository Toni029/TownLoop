const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {productionBuildEnv}=require('../scripts/production-build-env.cjs');
test('submission pins the Production Firebase file instead of the Preview fallback and validates its signing client',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'townloop-production-env-'));
 try{fs.mkdirSync(path.join(root,'credentials'));const app={expo:{android:{package:'com.townloop.app'}}},oauth={webClientId:'883715389126-web.apps.googleusercontent.com',productionCertificateSHA1:'a'.repeat(40),previewCertificateSHA1:'b'.repeat(40),androidFirebaseAppId:'1:883715389126:android:abcdef'};
 fs.writeFileSync(path.join(root,'app.json'),JSON.stringify(app));fs.writeFileSync(path.join(root,'eas.json'),JSON.stringify({build:{production:{android:{credentialsSource:'remote',buildType:'app-bundle'}}}}));fs.writeFileSync(path.join(root,'google-auth.json'),JSON.stringify(oauth));
 const data={project_info:{project_id:'cc-livingcommunity-app',project_number:'883715389126'},client:[{client_info:{mobilesdk_app_id:oauth.androidFirebaseAppId,android_client_info:{package_name:'com.townloop.app'}},oauth_client:[{client_type:1,client_id:'883715389126-prod.apps.googleusercontent.com',android_info:{package_name:'com.townloop.app',certificate_hash:'a'.repeat(40)}},{client_type:3,client_id:oauth.webClientId}]}]};
 const file=path.join(root,'credentials/google-services.townloop-app.production.json');fs.writeFileSync(file,JSON.stringify(data));
 const env=productionBuildEnv(root,{GOOGLE_SERVICES_JSON:'preview.json',EAS_BUILD_PROFILE:'preview',OTHER:'preserved'});assert.equal(env.GOOGLE_SERVICES_JSON,file);assert.equal(env.EAS_BUILD_PROFILE,'production');assert.equal(env.EAS_BUILD_PLATFORM,'android');assert.equal(env.OTHER,'preserved');
 data.client[0].oauth_client[0].android_info.certificate_hash='b'.repeat(40);fs.writeFileSync(file,JSON.stringify(data));assert.throws(()=>productionBuildEnv(root,{}),/SHA-1/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
