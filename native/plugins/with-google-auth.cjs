// Firebase JS Auth uses an explicit web client ID; Android SDK autolinking needs no RNFirebase migration.
module.exports=config=>{
 const oauth=require('../google-auth.json');
 if(!oauth.iosOAuthRegistered||!oauth.iosClientId)return config;
 const plugin=require('@react-native-google-signin/google-signin/app.plugin.js');
 return (plugin.default||plugin)(config,{iosUrlScheme:require('./google-oauth.cjs').reversedClientId(oauth.iosClientId)});
};
