// Credentials are supplied through an EAS file environment variable, never committed.
const fs=require('node:fs'),path=require('node:path');
const {withEntitlementsPlist}=require('expo/config-plugins');
module.exports=config=>{
 const local=path.resolve(__dirname,'../credentials/google-services.preview.json');
 const file=process.env.GOOGLE_SERVICES_JSON||(fs.existsSync(local)?local:undefined);
 if(file&&process.env.EAS_BUILD_PLATFORM!=='ios'){
  const data=JSON.parse(fs.readFileSync(file,'utf8'));
  if(data.project_info?.project_id!=='cc-livingcommunity-app'||!data.client?.some(c=>c.client_info?.android_client_info?.package_name===config.android?.package))throw Error('Inbox push Firebase configuration does not match TownLoop.');
  config.android={...config.android,googleServicesFile:file};
 }
 if(process.env.EAS_BUILD_PLATFORM==='android'&&!file)throw Error('Supply the TownLoop GOOGLE_SERVICES_JSON EAS file variable before building push notifications.');
 // Ad-hoc Preview and future App Store distribution use production APNs.
 // Development-client provisioning remains on Apple's sandbox environment.
 return withEntitlementsPlist(config,c=>{c.modResults['aps-environment']=process.env.EAS_BUILD_PROFILE==='development'?'development':'production';return c;});
};
