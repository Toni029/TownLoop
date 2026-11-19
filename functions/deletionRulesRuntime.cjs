'use strict';
// Eager dependency: a missing manifest fails artifact discovery, not the first job.
const manifest=require('./deletionScopeRules.json'),{createHash}=require('node:crypto');
function createRulesVerifier({control,credential,fetchJSON=async(url,token)=>{const r=await fetch(url,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(15000)});if(!r.ok)throw Object.assign(Error('rules_verification_unavailable'),{code:r.status});return r.json();}}){
 return async(policy,mediaPolicy)=>{
  const receipt=(await control.doc('database_cleanup_policies/current').get()).data(),token=(await credential.getAccessToken()).access_token;
  for(const scope of [...manifest.scopes,{database:'storage',candidateSHA256:require('./deletionMediaProvenance.json').storageRulesSha256}]){
   const release=await fetchJSON(`https://firebaserules.googleapis.com/v1/projects/cc-livingcommunity-app/releases/${scope.database==='storage'?'firebase.storage/cc-livingcommunity-app.firebasestorage.app':`cloud.firestore${scope.database==='(default)'?'':'/'+scope.database}`}`,token),rules=await fetchJSON('https://firebaserules.googleapis.com/v1/'+release.rulesetName,token);
   const hash=createHash('sha256').update(rules.source.files.map(f=>f.content).join('\n')).digest('hex');
   if(!require('./deletionRulesCompatibility.cjs').rulesCompatible({database:scope.database,liveHash:hash,expectedHash:scope.candidateSHA256,releaseUpdatedAt:release.updateTime,policy,mediaPolicy,receipt}))throw Error('deployed_rules_changed');
  }
 };
}
module.exports={createRulesVerifier};
