'use strict';
const PINS=Object.freeze({project:'cc-livingcommunity-app',database:'(default)',namedDatabase:'ai-studio-cclivingv27-5fc1a0f6-cd75-4964-8c9e-e219a265f7bb',bucket:'cc-livingcommunity-app.firebasestorage.app',defaultRulesSha256:'3f4a221d543783499b0b0cd53369f2177f6137fb5d3f8446137309f6ac941360',namedRulesSha256:'8493ef2624b905208328f9ac7116dfe59e8349b1d24a8c3aa0883ceabd0da02d',storageRulesSha256:'06d24519f84deb79f2cd6d24248f1ac45242e841cdd69d2ac56a5b3ee4fcbdae'});
function validatePolicy(policy){return policy?.ownerApproved===true&&policy.version===2&&Object.entries(PINS).every(([key,value])=>policy[key]===value)&&policy.storageMode==='exclusive-generation-fenced-v2'&&policy.genericMediaCleanupDisabledAcknowledged===true;}
/** Fail closed on incomplete inventory or a live generic reaper that could be triggered indirectly. */
function mediaDeletionDisabled(inventory){
 if(!Array.isArray(inventory?.functions)||inventory.nextPageToken||inventory.unreachable?.length)return false;
 return inventory.functions.every(fn=>{
  const entry=fn.buildConfig?.entryPoint||fn.entryPoint||'';
  const id=(fn.name?.split('/').at(-1)||'').replace(/[^a-zA-Z]/g,'');
  const generic=/^(cleanupDeleted_|cleanupLateOrphanMedia$|resumeMediaCleanup$|expireMediaDrafts$)/i.test(entry)||/^(cleanupdeleted|cleanuplateorphanmedia$|resumemediacleanup$|expiremediadrafts$)/i.test(id);
  const account=/^(fulfillApprovedAccountDeletions|resumeAccountDeletions)$/.test(entry)||/^(fulfillapprovedaccountdeletions|resumeaccountdeletions)$/i.test(id);
  if(account&&(fn.serviceConfig?.environmentVariables||fn.environmentVariables)?.TOWNLOOP_ACCOUNT_DELETION_ENABLED!=='false')return false;
  return !generic||(fn.serviceConfig?.environmentVariables||fn.environmentVariables)?.TOWNLOOP_MEDIA_CLEANUP_ENABLED==='false';
 });
}
const REQUIRED_WRITERS=['manageInboxConversation','revokeInboxGroupMemberships','syncResidentDirectory','submitSafetyReport','reviewSafetyReport','newsletterApi','runNewsletterAnalysis'];
const OPTIONAL_WRITERS=['monitorInboxRetention'];
const revision=fn=>fn.serviceConfig?.revision||fn.updateTime;
function inventoryDigest(inventory){return require('node:crypto').createHash('sha256').update(JSON.stringify(inventory.functions.map(fn=>[fn.name,fn.buildConfig?.entryPoint||fn.entryPoint||'',revision(fn)||'',(fn.serviceConfig?.environmentVariables||fn.environmentVariables)?.TOWNLOOP_MEDIA_CLEANUP_ENABLED||'']).sort((a,b)=>a[0].localeCompare(b[0])))).digest('hex');}
function referenceWritersVerified(inventory,policy){
 if(!Array.isArray(inventory?.functions)||inventory.nextPageToken||inventory.unreachable?.length||!policy?.referenceWriterRevisions||policy.functionInventorySha256!==inventoryDigest(inventory))return false;
 for(const name of REQUIRED_WRITERS)if(!inventory.functions.some(fn=>(fn.buildConfig?.entryPoint||fn.entryPoint)===name))return false;
 return inventory.functions.filter(fn=>[...REQUIRED_WRITERS,...OPTIONAL_WRITERS].includes(fn.buildConfig?.entryPoint||fn.entryPoint)).every(fn=>!!revision(fn)&&policy.referenceWriterRevisions[fn.name]===revision(fn));
}
module.exports={PINS,validatePolicy,mediaDeletionDisabled,referenceWritersVerified,inventoryDigest,REQUIRED_WRITERS};
