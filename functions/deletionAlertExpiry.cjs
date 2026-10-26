// Bounded expiry of server-owned alert delivery claims ONLY, never resident records.
const {millis}=require('./accountDeletionRetention.cjs');
async function expireAlertClaims(db,now=Date.now()) {
  const cursor=db.doc('deletion_policies/admin_alert_expiry_cursor'),state=(await cursor.get()).data();
  let query=db.collection('deletion_review_deliveries').where('expiresAt','<=',new Date(now)).orderBy('expiresAt').orderBy('__name__');
  if(state?.lastExpiry && state?.lastId)query=query.startAfter(state.lastExpiry,state.lastId);
  const page=await query.limit(50).get();
  let expired=0,needsReview=0;
  for(const item of page.docs){const result=await db.runTransaction(async tx=>{
    const live=await tx.get(item.ref);if(!live.exists)return;
    const data=live.data(),created=millis(data.createdAt),expiry=millis(data.expiresAt);
    if(!/^[a-f0-9]{64}$/.test(item.id)||!Object.keys(data).every(key=>['createdAt','expiresAt','state'].includes(key))||
      !['sending','suppressed','accepted','rejected','unknown'].includes(data.state)||!Number.isFinite(created)||
      !Number.isFinite(expiry)||expiry<created||expiry-created>60*86400000){return 'review';}
    if(expiry>now)return;
    tx.delete(item.ref);return 'expired';
  });if(result==='expired')expired++;else if(result==='review')needsReview++;}
  // Advance past malformed claims so they cannot starve valid expired records.
  const last=page.docs.at(-1);
  await db.runTransaction(async tx=>tx.set(cursor,page.size===50?{lastExpiry:last.data().expiresAt,lastId:last.id}:{lastExpiry:null,lastId:''}));
  return {expired,needsReview,pageFull:page.size===50};
}
module.exports={expireAlertClaims};
