// Explicit, non-destructive cutover. The legacy document remains byte-for-byte except
// for a server-owned routing marker; no source message/media is removed.
const { approved, member } = require('./inbox-policy.cjs');
const { memberPath, visibilityKey, hash, load, stageLeave, writeProjection } = require('./inbox-groups.cjs');
const sources = { resident_chats: 'private', office_chats: 'office', maintenance_chats: 'maintenance' };
const fail = code => { const error=Error(code);if(code==='failed-precondition')error.safeReason='legacy-review';throw error; };
const exact = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
async function legacyList(db, uid) {
  const actor = { ...(await db.doc(`users/${uid}`).get()).data(), id: uid };
  if (!approved(actor)) fail('permission-denied');
  const rows = [];
  for (const collection of Object.keys(sources)) {
    let query = db.collection(collection);
    if (collection === 'resident_chats') query = query.where('identityVersion', '==', 2).where('participantIds', 'array-contains', uid);
    else if (!(collection === 'office_chats' ? ['admin','vip'].includes(actor.role) : actor.role === 'crew')) query = query.where('residentId', '==', uid);
    const found = await query.limit(100).get();
    // Bounded legacy listing. Never silently imply complete history for a larger inbox.
    if (found.docs.length === 100) fail('resource-exhausted');
    for (const s of found.docs) if (!s.data().groupConversationId && member(collection, s.data(), actor) &&
      (collection === 'resident_chats' ? s.data().leftBy?.[uid] !== true : s.data().sideLeft?.[s.data().residentId === uid ? 'resident' : 'team'] !== true)) rows.push({ collection, id: s.id, data: s.data() });
  }
  return { rows };
}
async function upgradeLegacy(db, uid, data, now, {leave=false}={}) {
  if (!sources[data.source] || !exact(data.legacyId)) fail('invalid-argument');
  return db.runTransaction(async tx => {
    const sourceRef = db.doc(`${data.source}/${data.legacyId}`), snapshot = await tx.get(sourceRef), old = snapshot.data();
    const actor = { ...(await tx.get(db.doc(`users/${uid}`))).data(), id: uid };
    if (!old || !member(data.source, old, actor)) fail('permission-denied');
    if (old.groupConversationId) {
      const state=await load(tx,db,old.groupConversationId);
      if(leave){
        const result=stageLeave(tx,db,uid,old.groupConversationId,state,now);
        if(!result.unchanged){
          tx.set(db.doc(`inbox_conversations/${old.groupConversationId}`),state.conversation);
          writeProjection(tx,db,old.groupConversationId,state.conversation,state.members,state.profiles,now);
        }
        return{...result,conversationId:old.groupConversationId,type:state.conversation.type};
      }
      if (state.members.find(m=>m.uid===uid)?.status !== 'active') fail('permission-denied');
      return { conversationId: old.groupConversationId, type:state.conversation.type };
    }
    let ids;
    if (data.source === 'resident_chats') {
      if (old.identityVersion !== 2 || old.participantIds?.length !== 2 || old.participantIds.some(id => !exact(id))) fail('failed-precondition');
      ids = [...new Set(old.participantIds)];
    } else {
      if (!exact(old.residentId)) fail('failed-precondition');
      // Legacy role-wide access does not prove an individual's historical membership.
      // Only a separately reviewed, exact-source authorization manifest can cut it over.
      const proof = (await tx.get(db.doc(`inbox_legacy_authorizations/${hash(`${data.source}/${data.legacyId}`)}`))).data();
      if (!proof || proof.sourceHash !== hash(JSON.stringify(old)) || !Number.isFinite(proof.expiresAt) || proof.expiresAt <= now ||
          !exact(proof.reviewedBy) || !proof.evidenceReference || !Array.isArray(proof.participantIds)) fail('failed-precondition');
      const reviewer = (await tx.get(db.doc(`users/${proof.reviewedBy}`))).data();
      if (!approved(reviewer) || reviewer.role !== 'admin') fail('failed-precondition');
      ids = [...new Set(proof.participantIds)];
      if (!ids.includes(old.residentId) || ids.some(id=>!exact(id))) fail('failed-precondition');
    }
    if (ids.length < 2 || ids.length > 50 || !ids.includes(uid)) fail('failed-precondition');
    const profiles = await Promise.all(ids.map(async id => ({ ...(await tx.get(db.doc(`users/${id}`))).data(), id })));
    if (profiles.some(p => !approved(p) || data.source !== 'resident_chats' && p.id !== old.residentId && !(data.source === 'office_chats' ? ['admin','vip'].includes(p.role) : p.role === 'crew'))) fail('failed-precondition');
    // Unsupported ownership, oversized histories or embedded attachments are preserved
    // and require an explicit migration review. Never guess or strip them.
    const fields = new Set(['id','senderId','senderName','senderRole','body','createdAt','time','senderAvatar','readBy','type','isSystem','actorId']);
    const messages = old.messages;
    if (!Array.isArray(messages) || messages.length > 150 || messages.some(m =>
      Object.keys(m).some(key=>!fields.has(key)) || !exact(m.id) || /^(join|leave|revoke)_/.test(m.id) ||
      m.isSystem === true && !(m.type === 'leave' && m.senderId === 'system' && ids.includes(m.actorId) && (old.leftBy?.[m.actorId] === true || old.sideLeft?.[m.actorId === old.residentId ? 'resident' : 'team'] === true)) ||
      typeof m.body !== 'string' || !Number.isFinite(m.createdAt) ||
      m.attachments?.length || m.media?.length || m.photoUrl || m.url ||
      !ids.includes(m.senderId) && !(m.type === 'leave' && m.isSystem === true && ids.includes(m.actorId) && (old.leftBy?.[m.actorId] === true || old.sideLeft?.[m.actorId === old.residentId ? 'resident' : 'team'] === true)))) fail('failed-precondition');
    if (new Set(messages.map(m => m.id)).size !== messages.length) fail('failed-precondition');
    const members = profiles.map(p => {
      const left = old.leftBy?.[p.id] === true || (data.source !== 'resident_chats' && old.sideLeft?.[p.id === old.residentId ? 'resident' : 'team'] === true);
      return { uid: p.id, epoch: 1, status: left ? 'left' : 'active', reason: left ? 'left' : '', joinedAt: now, leftAt: left ? now : null,
        legacyAuthorized: true, readSequence: 0, lastVisibleSequence: messages.length };
    });
    if (members.find(m => m.uid === uid)?.status !== 'active') fail('permission-denied');
    let type = sources[data.source], residentId = type === 'private' ? '' : old.residentId;
    if (data.source === 'resident_chats' && old.officeDirect === true) {
      const residents=profiles.filter(p=>p.role==='resident'),staff=profiles.filter(p=>['admin','vip'].includes(p.role));
      if(residents.length!==1||staff.length!==1)fail('failed-precondition');
      type='office';residentId=residents[0].id;
    }
    const cid = `v3_${hash(type === 'private' ? `private/${ids.slice().sort().join('/')}` : `${type}/${residentId}`)}`;
    if ((await tx.get(db.doc(`inbox_conversations/${cid}`))).exists) fail('failed-precondition');
    const visibility = members.filter(m => m.status === 'active').map(visibilityKey);
    const c = { id: cid, schemaVersion: 3, type, residentId,
      memberIds: ids, memberRefs: Object.fromEntries(ids.map(id => [id, memberPath(cid,id).split('/')[1]])),
      status: type === 'private' && visibility.length < 2 ? 'read_only' : 'open', subject: type === 'private' ? String(old.subject || 'Conversation').slice(0,160) : type === 'office' ? 'Community Office' : 'Maintenance Crew',
      sequence: messages.length, createdAt: now, updatedAt: now, legacySource: `${data.source}/${data.legacyId}`, legacyVerified: true, legacyVisibility: visibility };
    const result=leave?stageLeave(tx,db,uid,cid,{conversation:c,members,profiles},now):{};
    tx.create(db.doc(`inbox_conversations/${cid}`), c);
    for (const [i, m] of messages.entries()) tx.create(db.doc(`inbox_conversations/${cid}/messages/${m.id}`), {
      ...m, type: m.isSystem === true ? 'legacy_event' : 'message', visibility, sequence: i + 1, notify: false, legacy: true,
    });
    for (const m of members) tx.create(db.doc(memberPath(cid,m.uid)), { ...m, conversationId: cid, type, residentId: c.residentId,
      subject: c.subject, name: type === 'private' ? profiles.find(p => p.id !== m.uid)?.name || 'Resident' : type === 'office' ? 'Community Office' : 'Maintenance Crew',
      activeCount: members.filter(member => member.status === 'active').length, peerId: type === 'private' ? ids.find(id=>id!==m.uid) : '', sequence: m.lastVisibleSequence || 0, updatedAt: now, conversationStatus: c.status });
    tx.update(sourceRef, { groupConversationId: cid });
    return { ...result, conversationId: cid, type };
  });
}
module.exports = { legacyList, upgradeLegacy };
