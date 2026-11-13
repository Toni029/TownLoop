'use strict';
const {createHash}=require('node:crypto');
const {DATABASES}=require('./accountDeletionScope.cjs');
const {mediaDeletionDisabled}=require('./databaseCleanupSafety.cjs');
const PINS=Object.freeze(require('./socialMediaLifecyclePins.json'));
const sha=value=>createHash('sha256').update(value).digest('hex');
function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));return value;}
const canonicalDigest=value=>sha(JSON.stringify(canonical(value)));
const timestamp=value=>typeof value?.toMillis==='function'?value.toMillis():value;
function validateManifest(policy,now=Date.now(),pins=PINS){
 const hashes=['functionInventorySha256','projectIamSha256','bucketIamSha256'];
 const reviewed=timestamp(policy?.reviewedAt),expires=timestamp(policy?.expiresAt),evidence=policy?.writerEvidence;
 return policy?.version===1&&policy.ownerApproved===true&&typeof policy.approvalReference==='string'&&!!policy.approvalReference.trim()&&Object.entries(pins).every(([key,value])=>policy[key]===value)&&
  hashes.every(key=>/^[a-f0-9]{64}$/.test(policy[key]||''))&&Number.isFinite(reviewed)&&reviewed<=now&&reviewed>=now-86400000&&Number.isFinite(expires)&&expires>now&&expires<=reviewed+86400000&&
  ['externalWritersDisabledAndDrained','namedBackendWritersDisabledAndDrained','defaultWritersTransactionGuarded','privilegedObjectWritersGuardedOrDisabled','defaultOnlyMutationScopeReviewed','immutableNativeSocialUploadsVerified','storageFirestoreDocumentBudgetVerified'].every(key=>evidence?.[key]===true)&&
  ['sourceReviewReference','iamReviewReference'].every(key=>typeof evidence?.[key]==='string'&&!!evidence[key].trim())&&
  policy.writers&&typeof policy.writers==='object'&&Object.keys(policy.writers).length>0&&Object.values(policy.writers).every(writer=>
   /^[a-f0-9]{64}$/.test(writer?.configurationSha256||'')&&/^[a-f0-9]{64}$/.test(writer.sourceSha256||'')&&['guarded_default_only','non_reference','disabled'].includes(writer.mode)&&writer.namedWrites==='none');
}
/** Authoritative read-only verifier. No approved manifest is created by this module. */
function createSocialMediaReadiness({db,request,now=Date.now,pins=PINS}){
 if(db.databaseId!=='(default)')throw Error('Readiness requires default database');
 async function rulesHash(release){
  const current=await request(`https://firebaserules.googleapis.com/v1/projects/${pins.project}/releases/${release}`);
  if(!current.rulesetName?.startsWith(`projects/${pins.project}/rulesets/`))throw Error('Unrecognized rules release');
  const rules=await request(`https://firebaserules.googleapis.com/v1/${current.rulesetName}`),files=rules.source?.files;
  if(files?.length!==1||typeof files[0].content!=='string')throw Error('Unrecognized rules source');return sha(files[0].content);
 }
 return async function deploymentReady(){
  try{
   const policy=(await db.doc('social_media_control/deployment').get()).data();if(!validateManifest(policy,now(),pins))return false;
   const [defaultRules,storageRules,namedRules,v1,v2,projectIam,bucketIam,accounts]=await Promise.all([
    rulesHash('cloud.firestore'),rulesHash(`firebase.storage/${pins.bucket}`),rulesHash(`cloud.firestore/${DATABASES[1]}`),
    request(`https://cloudfunctions.googleapis.com/v1/projects/${pins.project}/locations/-/functions?pageSize=1000`),
    request(`https://cloudfunctions.googleapis.com/v2/projects/${pins.project}/locations/-/functions?pageSize=1000`),
    request(`https://cloudresourcemanager.googleapis.com/v1/projects/${pins.project}:getIamPolicy`,'POST',{options:{requestedPolicyVersion:3}}),
    request(`https://storage.googleapis.com/storage/v1/b/${pins.bucket}/iam?optionsRequestedPolicyVersion=3`),
    db.collection('account_deletion_jobs').where('status','==','processing').limit(1).get()
   ]);
   if(defaultRules!==pins.defaultRulesSha256||storageRules!==pins.storageRulesSha256||namedRules!==pins.namedRulesSha256||!accounts.empty||[v1,v2].some(response=>response.nextPageToken||response.unreachable?.length||!Array.isArray(response.functions??[])))return false;
   const functions=[...new Map([...(v1.functions||[]),...(v2.functions||[])].map(fn=>[fn.name,fn])).values()].sort((a,b)=>a.name.localeCompare(b.name));
   if(!functions.length||canonicalDigest(functions)!==policy.functionInventorySha256||canonicalDigest(projectIam)!==policy.projectIamSha256||canonicalDigest(bucketIam)!==policy.bucketIamSha256||!mediaDeletionDisabled({functions}))return false;
   if(Object.keys(policy.writers).length!==functions.length)return false;
   return functions.every(fn=>{
    const proof=policy.writers[fn.name],entry=fn.buildConfig?.entryPoint||fn.entryPoint||'',env=fn.serviceConfig?.environmentVariables||fn.environmentVariables||{},revision=fn.serviceConfig?.revision||fn.updateTime;
    if(!proof||!revision||proof.configurationSha256!==canonicalDigest(fn)||!fn.name?.startsWith(`projects/${pins.project}/locations/`))return false;
    if(/^(runDatabaseCleanup|manageDatabaseCleanup)$/.test(entry)&&env.TOWNLOOP_DATABASE_CLEANUP_ENABLED!=='false')return false;
    if(/^(queueSocialMedia_|resumeSocialMediaCleanup$|inventorySocialMediaOrphans$)/.test(entry)&&fn.serviceConfig?.serviceAccountEmail!==pins.workerServiceAccount)return false;
    // Disabled claims require an exact reviewed flag enforced by the reviewed source revision.
    if(proof.mode==='disabled')return typeof proof.disabledFlag==='string'&&proof.disabledFlag.startsWith('TOWNLOOP_')&&env[proof.disabledFlag]==='false';
    return true;
   });
  }catch{return false;}
 };
}
module.exports={PINS,canonicalDigest,validateManifest,createSocialMediaReadiness};
