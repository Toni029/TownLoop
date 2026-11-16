// Listing previews are disposable; private chat messages and attachments are not.
const {FieldValue}=require('firebase-admin/firestore');
async function retireListingPreviews(db,recordId,{allowExisting=false}={}){
 let cursor;
 for(let page=0;page<20;page++){
  let query=db.collection('marketplace_chats').where('itemId','==',recordId).orderBy('__name__').limit(100);
  if(cursor)query=query.startAfter(cursor);
  const rows=await query.get();
  for(const row of rows.docs)await db.runTransaction(async tx=>{
   const [listing,current,control]=await Promise.all([tx.get(db.doc('marketplace_posts/'+recordId)),tx.get(row.ref),allowExisting?tx.get(db.doc('database_cleanup_control/active')):Promise.resolve(null)]);
   const bulk=allowExisting&&control.data()?.referenceWritesBlocked===true&&control.data()?.collections?.includes('marketplace_posts');
   if(listing.exists&&!bulk)throw Error('listing_restored_requires_review');
   if(!current.exists||current.data().itemId!==recordId)return;
   if(current.data().listingDeleted===true&&current.data().itemMediaUrl==='')return;
   tx.update(row.ref,{listingDeleted:true,itemMediaUrl:'',previewCopyKey:FieldValue.delete(),previewCopySource:FieldValue.delete()});
  });
  if(rows.size<100)return;
  cursor=rows.docs.at(-1);
 }
 throw Error('listing_preview_retirement_retry_required');
}
module.exports={retireListingPreviews};
