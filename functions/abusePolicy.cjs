'use strict';
// Rolling windows; intentionally generous to preserve normal conversations and staff work.
const POLICIES={posts:[10,100],listings:[10,50],comments:[60,1000],messages:[120,5000],inquiries:[20,200],workorders:[10,100],drafts:[40,500],edits:[60,2000],engagement:[120,5000],orderUpdates:[60,2000],media:[40,500],pdf:[4,20],analysis:[12,60],translation:[30,1000],expensiveRead:[60,5000],adminMutation:[30,1000],adminRead:[12,1000]};
const ms=value=>typeof value?.toMillis==='function'?value.toMillis():value instanceof Date?value.getTime():Number(value||0);
function exhausted(wait){return Object.assign(Error('Please wait before trying again. Your changes have not been submitted.'),{code:'resource-exhausted',status:429,safeReason:'request-limit',safeMessage:'Please wait before trying again. Your changes have not been submitted.',retryAfterMs:Math.max(1000,wait)});}
function advance(previous,scope,target,now,bytes=0){
 const limits=POLICIES[scope];if(!limits||!Number.isSafeInteger(now)||typeof target!=='string'||!target||target.length>400||!Number.isSafeInteger(bytes)||bytes<0)throw Error('invalid-argument');
 const period=scope==='analysis'?600000:60000,old=previous||{},windowAt=ms(old.windowAt),dayAt=ms(old.dayAt),windowReset=!windowAt||now-windowAt>=period,dayReset=!dayAt||now-dayAt>=86400000;
 const windowCount=windowReset?0:old.windowCount||0,dayCount=dayReset?0:old.dayCount||0,bytesDay=(dayReset?0:old.bytesDay||0)+bytes;
 if(windowCount>=limits[0])throw exhausted(windowAt+period-now);
 if(dayCount>=limits[1]||bytesDay>1073741824)throw exhausted(dayAt+86400000-now);
 return {windowAt:windowReset?now:windowAt,dayAt:dayReset?now:dayAt,windowCount:windowCount+1,dayCount:dayCount+1,bytesDay,lastAt:now,target,windowReset,dayReset};
}
function classify(path,before,patch){
 const parts=path.split('/');if(parts.length!==2)return null;const [collection]=parts,after={...before,...patch};
 if(['posts','discussion_feed','marketItems','marketplace_posts','work_orders'].includes(collection)){
  if(!before&&after.storageDraft===true)return 'drafts';
  if((!before||before.storageDraft===true)&&after.storageDraft===false)return collection==='work_orders'?'workorders':['marketItems','marketplace_posts'].includes(collection)?'listings':'posts';
  if(Array.isArray(patch.comments)&&patch.comments.length>(before?.comments?.length||0))return 'comments';
  if(patch.likedBy)return 'engagement';
  if(collection==='work_orders'&&patch.status)return 'orderUpdates';
  return 'edits';
 }
 if(['resident_chats','office_chats','maintenance_chats','marketplace_chats'].includes(collection)&&Array.isArray(patch.messages)&&patch.messages.length>(before?.messages?.length||0))return collection==='marketplace_chats'&&!before?'inquiries':'messages';
 return null;
}
module.exports={POLICIES,advance,classify,ms};
