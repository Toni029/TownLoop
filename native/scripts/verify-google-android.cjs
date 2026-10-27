// Read-only validation: never enables sign-in, changes Firebase, or prints client keys.
const fs=require('node:fs'),path=require('node:path');
const oauth=require('../google-auth.json');
const file=process.argv[2]||process.env.GOOGLE_SERVICES_JSON||path.resolve(__dirname,'../credentials/google-services.preview.json');
try{
 require('../plugins/google-oauth.cjs').validateAndroidConfig(JSON.parse(fs.readFileSync(file,'utf8')),oauth,require('../app.json').expo.android.package);
 console.log(`Android OAuth package/certificate/project/client checks passed. Sign-in readiness flag: ${oauth.androidOAuthRegistered}. Verify refreshed live registration before enabling it.`);
}catch(error){console.error(error.message);process.exitCode=1;}
