// Isolated deployment: no unrelated cleanup, message triggers, review or Hosting exports.
const {initializeApp,getApp}=require('firebase-admin/app');
const {getFirestore}=require('firebase-admin/firestore');
const {getAuth}=require('firebase-admin/auth');
const {getStorage}=require('firebase-admin/storage');
const {onSchedule}=require('firebase-functions/v2/scheduler');
const {createHash}=require('node:crypto');
initializeApp();
exports.fulfillApprovedAccountDeletions=onSchedule({region:'us-central1',schedule:'every 5 minutes',timeZone:'Etc/UTC',timeoutSeconds:300,maxInstances:1,retryCount:0},async()=>{
 const project='cc-livingcommunity-app',manifest=require('./deletionScopeRules.json');
 const verifyRules=async(policy,mediaPolicy)=>{
  const token=await getApp().options.credential.getAccessToken();
  const get=async path=>{const r=await fetch(`https://firebaserules.googleapis.com/v1/${path}`,{headers:{Authorization:`Bearer ${token.access_token}`}});if(!r.ok)throw Error('rules_verification_unavailable');return r.json();};
  for(const scope of [...manifest.scopes,{database:'storage',candidateSHA256:require('./deletionMediaProvenance.json').storageRulesSha256}]){
   const release=await get(`projects/${project}/releases/${scope.database==='storage'?'firebase.storage/cc-livingcommunity-app.firebasestorage.app':`cloud.firestore${scope.database==='(default)'?'':'/'+scope.database}`}`),rules=await get(release.rulesetName);
   const hash=createHash('sha256').update(rules.source.files.map(f=>f.content).join('\n')).digest('hex');
   if(hash!==scope.candidateSHA256||(scope.database!=='storage'&&policy.scopeRuleHashes[scope.database]!==hash)||scope.database==='storage'&&(mediaPolicy?.storageRulesSha256!==hash||mediaPolicy.trustedUploadsAfter?.toMillis?.()!==Date.parse(release.updateTime)))throw Error('deployed_rules_changed');
  }
 };
 await require('./accountDeletionRunner.cjs').runApprovedDeletions({control:getFirestore('(default)'),dbFor:id=>getFirestore(id),auth:getAuth(),bucket:getStorage().bucket('cc-livingcommunity-app.firebasestorage.app'),verifyRules});
});
