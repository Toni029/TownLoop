'use strict';
const PINS=Object.freeze({project:'cc-livingcommunity-app',database:'(default)',bucket:'cc-livingcommunity-app.firebasestorage.app',defaultRulesSha256:'f8b5557e491b852a2ee2f755ac8020b3cbcb76817a4f8598c7f28c58c361d5d0',storageRulesSha256:'9aac5f82b7e31fef034b92340714136ec943232de88b1a0076c001331958c3e9'});
function validatePolicy(policy){return policy?.ownerApproved===true&&policy.version===1&&Object.entries(PINS).every(([key,value])=>policy[key]===value)&&policy.storageMode==='hold-unproven-media'&&policy.genericMediaCleanupDisabledAcknowledged===true;}
/** Fail closed on incomplete inventory or a live generic reaper that could be triggered indirectly. */
function mediaDeletionDisabled(inventory){
 if(!Array.isArray(inventory?.functions)||inventory.nextPageToken||inventory.unreachable?.length)return false;
 return inventory.functions.every(fn=>{
  const entry=fn.buildConfig?.entryPoint||'';
  const id=(fn.name?.split('/').at(-1)||'').replace(/[^a-zA-Z]/g,'');
  const generic=/^(cleanupDeleted_|cleanupLateOrphanMedia$|resumeMediaCleanup$|expireMediaDrafts$)/i.test(entry)||/^(cleanupdeleted|cleanuplateorphanmedia$|resumemediacleanup$|expiremediadrafts$)/i.test(id);
  return !generic||fn.serviceConfig?.environmentVariables?.TOWNLOOP_MEDIA_CLEANUP_ENABLED==='false';
 });
}
module.exports={PINS,validatePolicy,mediaDeletionDisabled};
