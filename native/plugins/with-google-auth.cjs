// Firebase JS Auth uses an explicit web client ID; Android SDK autolinking needs no RNFirebase migration.
module.exports=config=>{
 const oauth=require('../google-auth.json');
 if(process.env.EAS_BUILD_PLATFORM==='android'&&config.android?.package==='com.townloop.app'&&!oauth.androidOAuthRegistered)throw Error('Android package registration and Google OAuth for com.townloop.app are pending. Configure and verify the new Firebase Android app before building.');
 if(oauth.androidOAuthRegistered&&process.env.EAS_BUILD_PLATFORM!=='ios'){
  if(process.env.EAS_BUILD_PROFILE==='production'&&!process.env.GOOGLE_SERVICES_JSON?.trim())throw Error('Production requires an explicit GOOGLE_SERVICES_JSON file; the Preview fallback is not a release configuration.');
  if(process.env.EAS_BUILD_PROFILE==='production'&&oauth.productionCertificateSHA1&&oauth.productionCertificateSHA1.replaceAll(':','').toUpperCase()===oauth.previewCertificateSHA1.replaceAll(':','').toUpperCase())throw Error('Production cannot use the verified Android Debug Preview certificate. Configure a genuine release signing certificate.');
  const fs=require('node:fs'),path=require('node:path');
  const file=process.env.GOOGLE_SERVICES_JSON||path.resolve(__dirname,'../credentials/google-services.townloop-app.preview.json');
  if(!fs.existsSync(file))throw Error('Supply the verified Google Android configuration before enabling sign-in.');
  require('./google-oauth.cjs').validateAndroidConfig(JSON.parse(fs.readFileSync(file,'utf8')),{...oauth,previewCertificateSHA1:process.env.EAS_BUILD_PROFILE==='production'?oauth.productionCertificateSHA1:oauth.previewCertificateSHA1},config.android?.package);
 }
 if(!oauth.iosOAuthRegistered)return config;
 // Keep plugin discovery stable locally and on EAS. Its Info.plist mod only
 // runs on iOS; Android must not need the iOS credentials file to register it.
 if(process.env.EAS_BUILD_PLATFORM!=='android'){
 const fs=require('node:fs'),path=require('node:path');
 const file=process.env.GOOGLE_SERVICES_PLIST||path.resolve(__dirname,'../credentials/GoogleService-Info.preview.plist');
 if(!fs.existsSync(file))throw Error('Supply the verified Google iOS configuration before enabling sign-in.');
 require('./google-oauth.cjs').validateIosConfig((require('@expo/plist').default||require('@expo/plist')).parse(fs.readFileSync(file,'utf8')),oauth,config.ios?.bundleIdentifier);
 }
 const plugin=require('@react-native-google-signin/google-signin/app.plugin.js');
 return (plugin.default||plugin)(config,{iosUrlScheme:require('./google-oauth.cjs').reversedClientId(oauth.iosClientId)});
};
