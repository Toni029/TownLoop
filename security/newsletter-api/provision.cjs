/** Explicitly approved setup only. Never deploys code; never prints or persists secret values. */
const PROJECT='cc-livingcommunity-app',SECRET='GEMINI_API_KEY',ACCOUNT='townloop-newsletter-api';
const secret=`projects/${PROJECT}/secrets/${SECRET}`;
const email=`${ACCOUNT}@${PROJECT}.iam.gserviceaccount.com`;
const sm='https://secretmanager.googleapis.com/v1/',iam='https://iam.googleapis.com/v1/';
async function provision(api,readKey){
 let secretCreated=false,secretVersionAdded=false,serviceAccountCreated=false,secretAccessGranted=false;
 let current=await api(sm+secret,undefined,true);
 // Check before mutation: the existing private key is the source, not a placeholder/new credential.
 let value;
 const existingValue=async()=>{if(!value)value=(await readKey())?.trim();if(!value)throw Error('Existing backend key unavailable. Setup stopped.');return value;};
 if(!current){await existingValue();current=await api(`${sm}projects/${PROJECT}/secrets?secretId=${SECRET}`,{replication:{automatic:{}}});secretCreated=true;}
 const versions=await api(sm+secret+'/versions?pageSize=100');
 if(versions.nextPageToken)throw Error('Secret version history needs review before adding a version.');
 if(!(versions.versions||[]).some(v=>v.state==='ENABLED')){
  await api(sm+secret+':addVersion',{payload:{data:Buffer.from(await existingValue(),'utf8').toString('base64')}});secretVersionAdded=true;
 }
 const accountPath=`projects/${PROJECT}/serviceAccounts/${encodeURIComponent(email)}`;
 if(!await api(iam+accountPath,undefined,true)){await api(`${iam}projects/${PROJECT}/serviceAccounts`,{accountId:ACCOUNT,serviceAccount:{displayName:'TownLoop newsletter analysis only'}});serviceAccountCreated=true;}
 const policy=await api(sm+secret+':getIamPolicy?options.requestedPolicyVersion=3');
 const bindings=(policy.bindings||[]).map(b=>({...b,members:[...(b.members||[])]}));
 const member='serviceAccount:'+email;
 let binding=bindings.find(b=>b.role==='roles/secretmanager.secretAccessor'&&!b.condition);
 if(!binding){binding={role:'roles/secretmanager.secretAccessor',members:[]};bindings.push(binding);}
 if(!binding.members.includes(member)){binding.members.push(member);await api(sm+secret+':setIamPolicy',{policy:{...policy,bindings}});secretAccessGranted=true;}
 return {project:PROJECT,secret:SECRET,serviceAccount:email,secretCreated,secretVersionAdded,serviceAccountCreated,secretAccessGranted,deployed:false};
}
module.exports={provision};
if(require.main===module){
 if(!process.argv.includes('--approve-provision')){console.log('Prepared only. Approval required to import the existing private backend key, create a dedicated runtime identity, and grant that identity access to this one secret. Nothing changed.');}
 else (async()=>{
  const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
  const root=path.resolve(__dirname,'../..'),file=path.join(root,'.env');
  const readKey=()=>{
   if(!fs.existsSync(file)||(fs.statSync(file).mode&0o077)!==0)throw Error('Backend key file must be private to its owner.');
   if(spawnSync('git',['check-ignore','--quiet','.env'],{cwd:root}).status!==0||spawnSync('git',['ls-files','--error-unmatch','.env'],{cwd:root,stdio:'ignore'}).status===0)throw Error('Backend key file must be ignored and untracked.');
   return require('dotenv').parse(fs.readFileSync(file)).GEMINI_API_KEY;
  };
  const auth=require(process.env.TOWNLOOP_FIREBASE_AUTH_MODULE||'firebase-tools/lib/auth');
  const account=auth.getGlobalDefaultAccount();if(!account)throw Error('Firebase operator login required.');
  const token=(await auth.getAccessToken(account.tokens.refresh_token,['https://www.googleapis.com/auth/cloud-platform','https://www.googleapis.com/auth/firebase'])).access_token;
  const api=async(url,body,allowMissing=false)=>{
   const response=await fetch(url,{headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{method:'POST',body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
   if(allowMissing&&response.status===404)return null;
   if(!response.ok)throw Error('Cloud setup HTTP '+response.status);
   return response.json();
  };
  console.log(JSON.stringify(await provision(api,readKey)));
 })().catch(()=>{console.error('Secure setup stopped. No credential values were displayed. Check operator permissions and the private backend key source before retrying.');process.exitCode=1;});
}
