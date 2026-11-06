// Read-only validation: never enables sign-in, changes Firebase, or prints client keys.
const fs=require('node:fs'),path=require('node:path');
const oauth=require('../google-auth.json');
const file=process.argv[2]||process.env.GOOGLE_SERVICES_JSON||path.resolve(__dirname,'../credentials/google-services.townloop-app.preview.json');
try{
 require('../plugins/google-oauth.cjs').validateAndroidConfig(JSON.parse(fs.readFileSync(file,'utf8')),{...oauth,previewCertificateSHA1:process.env.EAS_BUILD_PROFILE==='production'?oauth.productionCertificateSHA1:oauth.previewCertificateSHA1},require('../app.json').expo.android.package);
 console.log(`Android OAuth package/certificate/project/client checks passed for ${process.env.EAS_BUILD_PROFILE||'preview'}. Physical-device Google Sign-In still requires testing.`);
}catch(error){console.error(error.message);process.exitCode=1;}
