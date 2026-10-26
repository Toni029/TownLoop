// Credentials are supplied through an EAS file environment variable, never committed.
const fs=require('node:fs');
module.exports=config=>{
 const file=process.env.GOOGLE_SERVICES_JSON;
 if(file){
  const data=JSON.parse(fs.readFileSync(file,'utf8'));
  if(data.project_info?.project_id!=='cc-livingcommunity-app'||!data.client?.some(c=>c.client_info?.android_client_info?.package_name===config.android?.package))throw Error('Inbox push Firebase configuration does not match TownLoop.');
  config.android={...config.android,googleServicesFile:file};
 }
 if(process.env.EAS_BUILD_PLATFORM==='android'&&!file)throw Error('Supply the TownLoop GOOGLE_SERVICES_JSON EAS file variable before building push notifications.');
 return config;
};
