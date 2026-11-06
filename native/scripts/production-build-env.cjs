// Local submission must fingerprint the SAME Firebase client file as EAS Production.
// The remote secret file is unavailable during local CLI config evaluation.
const fs=require('node:fs'),path=require('node:path');
function productionBuildEnv(projectRoot=path.resolve(__dirname,'..'),environment=process.env){
 const app=JSON.parse(fs.readFileSync(path.join(projectRoot,'app.json'))).expo,eas=JSON.parse(fs.readFileSync(path.join(projectRoot,'eas.json'))),oauth=JSON.parse(fs.readFileSync(path.join(projectRoot,'google-auth.json')));
 if(app.android.package!=='com.townloop.app'||eas.build.production.android.credentialsSource!=='remote'||eas.build.production.android.buildType!=='app-bundle')throw Error('Unexpected production identity or signing profile.');
 const file=path.join(projectRoot,'credentials/google-services.townloop-app.production.json');
 require('../plugins/google-oauth.cjs').validateAndroidConfig(JSON.parse(fs.readFileSync(file)),{...oauth,previewCertificateSHA1:oauth.productionCertificateSHA1},app.android.package);
 return {...environment,EAS_BUILD_PLATFORM:'android',EAS_BUILD_PROFILE:'production',GOOGLE_SERVICES_JSON:file};
}
module.exports={productionBuildEnv};
