// Public client identifiers only. Never accept a client secret in app configuration.
function reversedClientId(clientId){
 const match=/^([0-9]+-[a-zA-Z0-9_-]+)\.apps\.googleusercontent\.com$/.exec(clientId||'');
 if(!match)throw Error('Supply the actual iOS OAuth client ID before enabling Google sign-in.');
 return `com.googleusercontent.apps.${match[1]}`;
}
function validateAndroidConfig(data,{webClientId,previewCertificateSHA1},packageName='com.toni029.townloop'){
 if(data?.project_info?.project_id!=='cc-livingcommunity-app'||String(data.project_info.project_number)!=='883715389126')throw Error('Google Android configuration must use the existing TownLoop Firebase project.');
 const client=data.client?.find(c=>c.client_info?.android_client_info?.package_name===packageName);
 if(!client||client.client_info.mobilesdk_app_id!=='1:883715389126:android:9be9bbe73fece14e27c9c7')throw Error('Google Android app ID or package does not match the verified Preview app.');
 const normalize=value=>String(value||'').replaceAll(':','').toUpperCase();
 const expected=normalize(previewCertificateSHA1);
 if(!/^[A-F0-9]{40}$/.test(expected))throw Error('The verified Preview signing certificate is required.');
 if(!client.oauth_client?.some(c=>c.client_type===1&&typeof c.client_id==='string'&&c.client_id.startsWith('883715389126-')&&c.client_id.endsWith('.apps.googleusercontent.com')&&c.android_info?.package_name===packageName&&normalize(c.android_info.certificate_hash)===expected))throw Error('Register the verified Preview SHA-1 in Firebase and download the refreshed Android configuration.');
 if(!client.oauth_client.some(c=>c.client_type===3&&c.client_id===webClientId))throw Error('Keep the existing Firebase Google web OAuth client.');
 return true;
}
module.exports={reversedClientId,validateAndroidConfig};
