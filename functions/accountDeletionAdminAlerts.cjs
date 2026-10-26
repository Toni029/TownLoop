// Server-only, content-free daily digest. No role is inferred from email or claims.
const { createHash } = require('node:crypto');
const isAdmin = profile => profile?.approved === true && profile.role === 'admin' && profile.deletionPending !== true;
const validToken = token => typeof token === 'string' && token.length < 256 && /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/.test(token);
async function notifyAdmins(db, { now = Date.now(), send = sendPush, identity = uid => require('firebase-admin/auth').getAuth().getUser(uid) } = {}) {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone:'America/New_York', year:'numeric', month:'2-digit', day:'2-digit' }).format(now);
  // Bounded recipient traversal, resumed independently from the request scan.
  const cursor = db.doc('deletion_policies/admin_alert_cursor');
  const state = (await cursor.get()).data();
  let query = db.collection('users').where('role','==','admin').orderBy('__name__').limit(50);
  if(state?.lastId)query=query.startAfter(state.lastId);
  const admins = await query.get();
  let accepted=0;
  for(const admin of admins.docs) {
    if(!isAdmin(admin.data()))continue;
    const devices = await db.collection('notification_devices').where('uid','==',admin.id).limit(20).get();
    for(const device of devices.docs) {
      const id = createHash('sha256').update(`${day}/${admin.id}/${device.id}`).digest('hex');
      const claim = db.doc(`deletion_review_deliveries/${id}`);
      const token = await db.runTransaction(async tx => {
        const [existing, profile, current] = await Promise.all([tx.get(claim),tx.get(admin.ref),tx.get(device.ref)]);
        if(existing.exists || !isAdmin(profile.data()) || current.data()?.uid!==admin.id || !validToken(current.data()?.token))return null;
        tx.create(claim,{state:'sending',createdAt:new Date(now),expiresAt:new Date(now+60*86400000)});
        return current.data().token;
      });
      if(!token)continue;
      // Recheck role/token ownership immediately before the external side effect.
      const [profile,current] = await Promise.all([admin.ref.get(),device.ref.get()]);
      if(!isAdmin(profile.data()) || current.data()?.uid!==admin.id || current.data()?.token!==token || !(await identity(admin.id).then(user=>user.disabled!==true,()=>false))) {
        await claim.update({state:'suppressed'});continue;
      }
      try {
        const ok = await send(token);
        await claim.update({state:ok?'accepted':'rejected'});
        if(ok)accepted++;
      } catch {
        // A timed-out transport might have delivered. Never blindly resend it.
        // A later daily digest can still remind staff; the office queue is canonical.
        await claim.update({state:'unknown'});
      }
    }
  }
  await db.runTransaction(async tx=>tx.set(cursor,{lastId:admins.size===50?admins.docs.at(-1).id:''}));
  return {accepted};
}
async function sendPush(token) {
  const response=await fetch('https://exp.host/--/api/v2/push/send',{
    method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(15000),
    body:JSON.stringify({to:token,title:'TownLoop',body:'A deletion request needs Admin review. Open Admin Reports.',
      ttl:3600,data:{type:'deletion_review'},channelId:'inbox'}),
  });
  if(!response.ok)throw Error('alert_transport_failed');
  return (await response.json()).data?.status==='ok';
}
module.exports={isAdmin,notifyAdmins};
