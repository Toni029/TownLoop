'use strict';
const {CATEGORIES}=require('./databaseCleanupReadOnly.cjs');
const PROJECT='cc-livingcommunity-app';
const GATEWAY_SERVICE_ACCOUNT=`townloop-request-controls@${PROJECT}.iam.gserviceaccount.com`;
const fail=(code,message,details)=>{throw Object.assign(Error(message),{code,...(details?{details}:{})});};
const unavailable=()=>fail('unavailable','The read-only preview is temporarily unavailable. No cleanup job was created and no data was deleted.');
function inventoryServiceUrl(value){
 let url;try{url=new URL(value);}catch{unavailable();}
 // The deployment operator must verify the hashed legacy service URI's project.
 // New deterministic service names also pin the known project number and region.
 if(url.protocol!=='https:'||url.username||url.password||url.port||url.search||url.hash||url.pathname!=='/'||
  !/^readonlydatabasecleanupinventory-(?:883715389126\.us-central1|[a-z0-9]+-uc\.a)\.run\.app$/.test(url.hostname))unavailable();
 return url.origin;
}
function createPrivateInventoryInvoker({googleAuth,fetcher=fetch,serviceUrl=()=>process.env.CLEANUP_INVENTORY_SERVICE_URL}){
 const ready=()=>inventoryServiceUrl(serviceUrl());
 const invoke=async({idToken,input})=>{
  const url=ready(),client=await googleAuth.getIdTokenClient(url),headers=await client.getRequestHeaders(url),oidc=headers.get('authorization');
  if(typeof oidc!=='string'||!/^Bearer \S+$/.test(oidc))unavailable();
  const response=await fetcher(url,{method:'POST',redirect:'error',signal:AbortSignal.timeout(110000),headers:{'Content-Type':'application/json',Authorization:`Bearer ${idToken}`,'X-Serverless-Authorization':oidc},body:JSON.stringify({data:input})});
  if(!response.ok)unavailable();
  const body=await response.json();if(!body.result||body.error)unavailable();return body.result;
 };
 invoke.ready=ready;return invoke;
}
function previewInput(input){
 if(input?.action!=='preview')fail('failed-precondition','This service is read-only. Cleanup jobs and deletion are disabled.');
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!['action','categories','cursor','requestId'].includes(key)))fail('invalid-argument','Send only a read-only preview request.');
 if(!Array.isArray(input.categories)||!input.categories.length||input.categories.length>4||input.categories.some(v=>typeof v!=='string'||!Object.hasOwn(CATEGORIES,v))||new Set(input.categories).size!==input.categories.length)fail('invalid-argument','Select valid categories.');
 const cursor=input.cursor??0;if(!Number.isInteger(cursor)||cursor<0||cursor>1000)fail('invalid-argument','Invalid file preview page.');
 if(input.requestId!==undefined&&(typeof input.requestId!=='string'||input.requestId.length>200))fail('invalid-argument','Invalid preview request.');
 return {action:'preview',categories:Object.keys(CATEGORIES).filter(k=>input.categories.includes(k)),cursor};
}
function createCleanupQuotaGateway({verifyIdentity,read,charge,invoke}){
 return async request=>{
  const bearer=request.rawRequest?.headers?.authorization;
  const idToken=typeof bearer==='string'?bearer.match(/^Bearer (\S+)$/i)?.[1]:null;
  if(!request.auth?.uid||!idToken)fail('unauthenticated','Sign in with an approved Admin account.');
  let identity;try{identity=await verifyIdentity(idToken);}catch{fail('unauthenticated','Refresh your session and sign in again.');}
  if(identity?.uid!==request.auth.uid)fail('unauthenticated','Refresh your session and sign in again.');
  let profile,revoked;
  try{[profile,revoked]=await Promise.all([read(`users/${identity.uid}`,['role','approved','deletionPending']),read(`account_access_revocations/${identity.uid}`,['createdAt'])]);}catch{unavailable();}
  if(identity.disabled||!profile?.exists||profile.data?.role!=='admin'||profile.data.approved!==true||profile.data.deletionPending===true||revoked?.exists)fail('permission-denied','A currently approved Admin account is required.');
  const input=previewInput(request.data);
  try{invoke.ready?.();}catch{unavailable();}
  try{await charge(identity.uid,'adminRead','databaseCleanup:preview');}
  catch(error){if(error?.code==='resource-exhausted')fail('resource-exhausted','Preview limit reached. Please wait before requesting another inventory.',{retryAfterSeconds:Math.max(1,Math.ceil((error.retryAfterMs||1000)/1000))});unavailable();}
  try{const result=await invoke({idToken,input});if(result?.readOnly!==true||result.enabled!==false)unavailable();return result;}catch{unavailable();}
 };
}
// Reuse the exact original implementation. Only export name and IAM invoker change.
function protectedReadOnlySource(source){
 const anchor='exports.previewDatabaseCleanup=onCall({';
 if(source.split(anchor).length!==2)throw Error('Read-only inventory entry changed; review private adapter before packaging.');
 return source.replace(anchor,`exports.readOnlyDatabaseCleanupInventory=onCall({invoker:['${GATEWAY_SERVICE_ACCOUNT}'],`);
}
module.exports={createCleanupQuotaGateway,createPrivateInventoryInvoker,protectedReadOnlySource,inventoryServiceUrl,PROJECT,GATEWAY_SERVICE_ACCOUNT};
