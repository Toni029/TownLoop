// Firebase JS Auth uses an explicit web client ID; Android SDK autolinking needs no RNFirebase migration.
module.exports=config=>{
 const oauth=require('../google-auth.json');
 if(oauth.androidOAuthRegistered&&process.env.EAS_BUILD_PLATFORM!=='ios'){
  const fs=require('node:fs'),path=require('node:path');
  const file=process.env.GOOGLE_SERVICES_JSON||path.resolve(__dirname,'../credentials/google-services.preview.json');
  if(!fs.existsSync(file))throw Error('Supply the verified Google Android configuration before enabling sign-in.');
  require('./google-oauth.cjs').validateAndroidConfig(JSON.parse(fs.readFileSync(file,'utf8')),oauth,config.android?.package);
 }
 if(!oauth.iosOAuthRegistered||!oauth.iosClientId)return config;
 const plugin=require('@react-native-google-signin/google-signin/app.plugin.js');
 return (plugin.default||plugin)(config,{iosUrlScheme:require('./google-oauth.cjs').reversedClientId(oauth.iosClientId)});
};
