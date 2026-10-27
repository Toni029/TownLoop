// Read-only configuration check. Never enables sign-in or prints credential contents.
const fs=require('node:fs'),path=require('node:path');
const oauth=require('../google-auth.json');
const file=process.argv[2]||process.env.GOOGLE_SERVICES_PLIST||path.resolve(__dirname,'../credentials/GoogleService-Info.preview.plist');
try{
 if(!fs.existsSync(file))throw Error('Supply the actual Firebase iOS configuration file before enabling Google Sign-In.');
 require('../plugins/google-oauth.cjs').validateIosConfig(require('@expo/plist').parse(fs.readFileSync(file,'utf8')),oauth,require('../app.json').expo.ios.bundleIdentifier);
 console.log(`iOS OAuth project/app/bundle/callback checks passed. Sign-in readiness flag: ${oauth.iosOAuthRegistered}. Verify live registration before enabling it.`);
}catch(error){console.error(error.message);process.exitCode=1;}
