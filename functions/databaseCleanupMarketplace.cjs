'use strict';
const {createHash}=require('node:crypto');
const uid=value=>typeof value==='string'&&value.length>0&&value.length<=128&&!value.includes('/');
const clean=value=>value.trim().toLowerCase().replace(/[^a-zA-Z0-9_-]/g,'_');
const hash=value=>createHash('sha256').update(value).digest('hex');
// Establish category membership from immutable IDs and server-owned source/cleanup
// receipts. Names and message text never establish ownership.
async function marketplaceBinding(db,id,data,jobId){
 const itemId=data?.itemId,seller=data?.sellerId,buyer=data?.buyerId;
 if(![itemId,seller,buyer].every(uid)||seller===buyer||!Array.isArray(data.participantIds)||data.participantIds.length!==2||new Set(data.participantIds).size!==2||!data.participantIds.includes(seller)||!data.participantIds.includes(buyer)||id!==`mkt_${clean(itemId)}_${clean(buyer)}`)return {reason:'marketplace_conversation_unverified'};
 const candidates=[];
 for(const collection of ['marketplace_posts','marketItems']){
  const source=await db.doc(collection+'/'+itemId).get();
  if(source.exists){const d=source.data(),owner=d.userId??d.authorId;if(!uid(owner)||d.userId&&d.authorId&&d.userId!==d.authorId)return {reason:'marketplace_conversation_unverified'};candidates.push({collection,owner});}
  else if(jobId){const planned=(await db.doc(`database_cleanup_jobs/${jobId}/items/${hash(collection+'/'+itemId)}`).get()).data();if(planned?.listingOwnerUid)candidates.push({collection,owner:planned.listingOwnerUid});}
 }
 if(!candidates.length){
  const receipts=await db.collection('media_cleanup_jobs').where('recordId','==',itemId).limit(11).get();
  if(receipts.size>10)return {reason:'marketplace_conversation_unverified'};
  for(const row of receipts.docs){const d=row.data();if(d.kind==='post_delete_v1'&&d.databaseId==='(default)'&&['marketplace_posts','marketItems'].includes(d.collection)&&uid(d.uid)&&!candidates.some(c=>c.collection===d.collection&&c.owner===d.uid))candidates.push({collection:d.collection,owner:d.uid});}
 }
 if(candidates.length!==1||candidates[0].owner!==seller)return {reason:'marketplace_conversation_unverified'};
 return {listingId:itemId,listingCollection:candidates[0].collection,listingOwnerUid:seller};
}
function mixedMarketplaceData(data,chatId,itemId,participants){
 let nodes=0,mixed=false;
 function walk(v,depth=0){
  if(++nodes>20000||depth>20)throw Error('marketplace_inventory_bound');
  if(Array.isArray(v)){for(const child of v)walk(child,depth+1);return;}
  if(!v||typeof v!=='object'||typeof v.toMillis==='function')return;
  if(v.unrelatedContent===true||v.groupConversationId||v.conversationType&&!['marketplace','buyer-seller'].includes(v.conversationType))mixed=true;
  for(const key of ['itemId','listingId'])if(v[key]!=null&&v[key]!==itemId)mixed=true;
  for(const key of ['chatId','conversationId'])if(v[key]!=null&&v[key]!==chatId)mixed=true;
  for(const key of ['listingIds','relatedListingIds'])if(v[key]!=null&&(!Array.isArray(v[key])||v[key].some(id=>id!==itemId)))mixed=true;
  for(const key of ['senderId','authorId'])if(v[key]!=null&&!participants.includes(v[key])&&!(key==='senderId'&&v[key]==='system'&&v.isSystem===true))mixed=true;
  for(const child of Object.values(v))walk(child,depth+1);
 }
 walk(data);return mixed;
}
module.exports={marketplaceBinding,mixedMarketplaceData};
