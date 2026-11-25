'use strict';
const {PINS,validatePolicy}=require('./databaseCleanupSafety.cjs');
const BASELINE=require('./deletionMediaProvenance.json').storageRulesSha256;
function mediaProvenanceMatches(receipt,mediaPolicy){
 return validatePolicy(receipt)&&mediaPolicy?.ownerApproved===true&&mediaPolicy.storageRulesSha256===BASELINE&&
  receipt.mediaProvenance.storageRulesSha256===BASELINE&&mediaPolicy.trustedUploadsAfter?.toMillis?.()===receipt.mediaProvenance.trustedUploadsAfterMillis;
}
function rulesCompatible({database,liveHash,expectedHash,releaseUpdatedAt,policy,mediaPolicy,receipt}){
 if(database==='storage'){
  if(liveHash===BASELINE)return mediaPolicy?.ownerApproved===true&&mediaPolicy.storageRulesSha256===BASELINE&&mediaPolicy.trustedUploadsAfter?.toMillis?.()===Date.parse(releaseUpdatedAt);
  return liveHash===PINS.storageRulesSha256&&mediaProvenanceMatches(receipt,mediaPolicy);
 }
 // The compatibility receipt NEVER grants processing approval or fixes an account
 // policy implicitly. The independently approved account policy must match live rules.
 if(policy?.scopeRuleHashes?.[database]!==liveHash)return false;
 if(database==='(default)')return liveHash===receipt?.defaultRulesSha256&&validatePolicy(receipt);
 if(liveHash===expectedHash)return true;
 const candidate=database===PINS.namedDatabase?PINS.namedRulesSha256:null;
 return !!candidate&&liveHash===candidate&&validatePolicy(receipt);
}
module.exports={rulesCompatible,mediaProvenanceMatches};
