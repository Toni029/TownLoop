'use strict';
const PINS=Object.freeze({project:'cc-livingcommunity-app',database:'(default)',namedDatabase:'ai-studio-cclivingv27-5fc1a0f6-cd75-4964-8c9e-e219a265f7bb',bucket:'cc-livingcommunity-app.firebasestorage.app',defaultRulesSha256:'8d105d51885783e5b98993ca185d0ac968abf4d1eb423f53d78710e78dcc9047',namedRulesSha256:'8493ef2624b905208328f9ac7116dfe59e8349b1d24a8c3aa0883ceabd0da02d',storageRulesSha256:'b844e570c4e44c8abb8961d934bf3d8393ae97b3ae2408d5cf7828dcb80f80b5'});
function validatePolicy(policy){return policy?.ownerApproved===true&&policy.version===3&&policy.accountCoordinationVersion===1&&policy.mediaProvenance?.storageRulesSha256===require('./deletionMediaProvenance.json').storageRulesSha256&&Number.isSafeInteger(policy.mediaProvenance?.trustedUploadsAfterMillis)&&policy.mediaProvenance.trustedUploadsAfterMillis>0&&Object.entries(PINS).every(([key,value])=>policy[key]===value)&&policy.storageMode==='exclusive-generation-fenced-v2'&&policy.genericMediaCleanupDisabledAcknowledged===true;}
/** Fail closed on incomplete inventory or a live generic reaper that could be triggered indirectly. */
function mediaDeletionDisabled(inventory){
 if(!Array.isArray(inventory?.functions)||inventory.nextPageToken||inventory.unreachable?.length)return false;
 return inventory.functions.every(fn=>{
  const entry=fn.buildConfig?.entryPoint||fn.entryPoint||'';
  const id=(fn.name?.split('/').at(-1)||'').replace(/[^a-zA-Z]/g,'');
  const generic=/^(cleanupDeleted_|cleanupLateOrphanMedia$|resumeMediaCleanup$|expireMediaDrafts$)/i.test(entry)||/^(cleanupdeleted|cleanuplateorphanmedia$|resumemediacleanup$|expiremediadrafts$)/i.test(id);
  const account=/^(fulfillApprovedAccountDeletions|resumeAccountDeletions|processAccountDeletionJob|reconcileAccountDeletionUpload)$/.test(entry)||/^(fulfillapprovedaccountdeletions|resumeaccountdeletions|processaccountdeletionjob|reconcileaccountdeletionupload)$/i.test(id);
  if(account){const env=fn.serviceConfig?.environmentVariables||fn.environmentVariables||{};if(env.TOWNLOOP_ACCOUNT_DELETION_ENABLED!=='false'&&env.TOWNLOOP_DELETION_COORDINATION_VERSION!=='1')return false;}
  return !generic||((fn.serviceConfig?.environmentVariables||fn.environmentVariables)?.TOWNLOOP_MEDIA_CLEANUP_ENABLED==='false'&&(fn.serviceConfig?.environmentVariables||fn.environmentVariables)?.TOWNLOOP_POST_DELETE_MEDIA_ENABLED!=='true');
 });
}
const REQUIRED_WRITERS=['manageInboxConversation','revokeInboxGroupMemberships','syncResidentDirectory','submitSafetyReport','reviewSafetyReport','newsletterApi','runNewsletterAnalysis','fulfillApprovedAccountDeletions'];
const OPTIONAL_WRITERS=['monitorInboxRetention','resumeAccountDeletions','processAccountDeletionJob','reconcileAccountDeletionUpload'];
const revision=fn=>fn.serviceConfig?.revision||fn.updateTime;
function inventoryDigest(inventory){return require('node:crypto').createHash('sha256').update(JSON.stringify(inventory.functions.map(fn=>[fn.name,fn.buildConfig?.entryPoint||fn.entryPoint||'',revision(fn)||'',(fn.serviceConfig?.environmentVariables||fn.environmentVariables)?.TOWNLOOP_MEDIA_CLEANUP_ENABLED||'']).sort((a,b)=>a[0].localeCompare(b[0])))).digest('hex');}
function referenceWritersVerified(inventory,policy){
 if(!Array.isArray(inventory?.functions)||inventory.nextPageToken||inventory.unreachable?.length||!policy?.referenceWriterRevisions||policy.functionInventorySha256!==inventoryDigest(inventory))return false;
 for(const name of REQUIRED_WRITERS)if(!inventory.functions.some(fn=>(fn.buildConfig?.entryPoint||fn.entryPoint)===name))return false;
 return inventory.functions.filter(fn=>[...REQUIRED_WRITERS,...OPTIONAL_WRITERS].includes(fn.buildConfig?.entryPoint||fn.entryPoint)).every(fn=>!!revision(fn)&&policy.referenceWriterRevisions[fn.name]===revision(fn));
}
module.exports={PINS,validatePolicy,mediaDeletionDisabled,referenceWritersVerified,inventoryDigest,REQUIRED_WRITERS};
