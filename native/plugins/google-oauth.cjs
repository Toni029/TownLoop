// Public client identifiers only. Never accept a client secret in app configuration.
function reversedClientId(clientId){
 const match=/^([0-9]+-[a-zA-Z0-9_-]+)\.apps\.googleusercontent\.com$/.exec(clientId||'');
 if(!match)throw Error('Supply the actual iOS OAuth client ID before enabling Google sign-in.');
 return `com.googleusercontent.apps.${match[1]}`;
}
module.exports={reversedClientId};
