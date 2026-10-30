const {SHARED,referencesUid}=require('./accountDeletionPolicy.cjs');
// Increment whenever coverage or evidence handling changes. Old receipts are not erasure proof.
const INVENTORY_VERSION=3;
const TARGETS=Object.freeze([
 ...SHARED.map(collection=>({collection})),
 ...['inbox_conversations','inbox_memberships','inbox_legacy_authorizations','inbox_media_references','inbox_retention_holds','notification_events','notification_reads'].map(collection=>({collection})),
 {collection:'inbox_messages',group:'messages'},
]);
function legacyPathReferencesUid(path,uid){
 const [collection,id,...rest]=path.split('/');
 return !rest.length&&['resident_chats','office_chats','maintenance_chats','marketplace_chats'].includes(collection)&&
   (id===uid||id.split('_vs_').includes(uid));
}
function inventoryReferencesUid(path,data,uid){return referencesUid(data,uid)||legacyPathReferencesUid(path,uid);}
module.exports={INVENTORY_VERSION,TARGETS,legacyPathReferencesUid,inventoryReferencesUid};
