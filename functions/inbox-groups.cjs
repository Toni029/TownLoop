// Native Inbox v3, default database only. All mutations are trusted-server operations.
const { createHash } = require('node:crypto');
const { approved } = require('./inbox-policy.cjs');
const hash = value => createHash('sha256').update(value).digest('hex');
const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const fail = code => { throw Error(code); };
const MAX_MEMBERS = 50;
const memberPath = (cid, uid) => `inbox_memberships/${hash(`${cid}/${uid}`)}`;
const visibilityKey = member => `${member.uid}:${member.epoch}`;
function memberAllowed(conversation, member, profile) {
  return !!conversation && approved(profile) && member?.status === 'active' &&
    (conversation.type === 'private' || member.uid === conversation.residentId ||
      (conversation.type === 'office' ? ['admin', 'vip'].includes(profile.role) : profile.role === 'crew'));
}
function canSee(conversation, member, profile, message) {
  return memberAllowed(conversation, member, profile) && message?.visibility?.includes(visibilityKey(member));
}
const ref = (db, id) => db.doc(`inbox_conversations/${id}`);
async function load(tx, db, cid) {
  const snapshot = await tx.get(ref(db, cid));
  if (!snapshot.exists) fail('not-found');
  const conversation = snapshot.data();
  if (!Array.isArray(conversation.memberIds) || conversation.memberIds.length > MAX_MEMBERS) fail('failed-precondition');
  const members = await Promise.all(conversation.memberIds.map(uid => tx.get(db.doc(memberPath(cid, uid)))));
  const profiles = await Promise.all(conversation.memberIds.map(uid => tx.get(db.doc(`users/${uid}`))));
  return { conversation, members: members.map(s => s.data()), profiles: profiles.map((s, i) => ({ ...s.data(), id: conversation.memberIds[i] })) };
}
const active = state => state.members.filter((m, i) => memberAllowed(state.conversation, m, state.profiles[i]));
function authorize(state, uid) {
  const i = state.conversation.memberIds.indexOf(uid);
  if (i < 0 || !memberAllowed(state.conversation, state.members[i], state.profiles[i])) fail('permission-denied');
  return state.members[i];
}
const display = p => ({ uid: p.id, name: String(p.name || 'Resident').slice(0, 100), role: p.role,
  // Do not project email/address/phone or arbitrary external URLs into group rosters.
  avatar: typeof (p.avatar_url || p.avatarUrl) === 'string' && (p.avatar_url || p.avatarUrl).startsWith('data:image/') ? (p.avatar_url || p.avatarUrl) : '' });
async function isBlocked(tx, db, a, b) {
  const snapshots = await Promise.all([tx.get(db.doc(`user_blocks/${a}/targets/${b}`)), tx.get(db.doc(`user_blocks/${b}/targets/${a}`))]);
  return snapshots.some(s => s.exists);
}
function writeProjection(tx, db, cid, c, members, profiles, now, changed = {}) {
  for (const [i, m] of members.entries()) {
    tx.set(db.doc(memberPath(cid, m.uid)), { ...m, conversationId: cid, type: c.type,
      residentId: c.residentId || '', subject: c.subject, updatedAt: now, conversationStatus: c.status, sequence: m.lastVisibleSequence || 0,
      // Roster is loaded separately after membership authorization; no message preview here.
      activeCount: active({conversation:c,members,profiles}).length,
      peerId: c.type === 'private' ? profiles.find(p => p.id !== m.uid)?.id || '' : '',
      name: c.type === 'private' ? profiles.find(p => p.id !== m.uid)?.name || 'Resident' : c.type === 'office' ? 'Community Office' : 'Maintenance Crew',
      ...changed[m.uid] });
  }
}
function event(tx, db, cid, c, members, now, id, type, actor, visibility = members.filter(m => m.status === 'active').map(visibilityKey)) {
  const message = { id, type, isSystem: type !== 'message', senderId: type === 'message' ? actor.id : 'system', actorId: actor.id,
    senderName: type === 'message' ? display(actor).name : 'System', senderRole: type === 'message' ? actor.role : 'system',
    senderAvatar: '', body: `${display(actor).name} ${type === 'join' ? 'joined' : 'left'} the conversation.`,
    createdAt: now, sequence: c.sequence + 1, visibility, notify: false };
  tx.create(db.doc(`inbox_conversations/${cid}/messages/${id}`), message);
  c.sequence++;
  for (const m of members) if (visibility.includes(visibilityKey(m))) m.lastVisibleSequence = c.sequence;
  return message;
}
async function createConversation(db, uid, data, now) {
  const type = data.type;
  if (!['private', 'office', 'maintenance'].includes(type)) fail('invalid-argument');
  if (data.recipientIds !== undefined && !Array.isArray(data.recipientIds)) fail('invalid-argument');
  const recipientIds = [...new Set(data.recipientIds || [])];
  if (recipientIds.some(v => !validId(v)) || recipientIds.length > MAX_MEMBERS - 1) fail('invalid-argument');
  const residentId = data.residentId || uid;
  if (!validId(residentId) || (type === 'private' && (recipientIds.length !== 1 || recipientIds[0] === uid))) fail('invalid-argument');
  const cid = `v3_${hash(type === 'private' ? `private/${[uid, ...recipientIds].sort().join('/')}` : `${type}/${residentId}`)}`;
  await db.runTransaction(async tx => {
    const actor = { ...(await tx.get(db.doc(`users/${uid}`))).data(), id: uid };
    if (!approved(actor)) fail('permission-denied');
    if (type !== 'private' && residentId !== uid && !(type === 'office' ? ['admin', 'vip'].includes(actor.role) : actor.role === 'crew')) fail('permission-denied');
    const old = await tx.get(ref(db, cid));
    if (old.exists) { authorize(await load(tx, db, cid), uid); return; }
    let ids = type === 'private' ? [uid, ...recipientIds] : [residentId, ...recipientIds, uid];
    if (type === 'office' && !recipientIds.length) fail('invalid-argument');
    if (type === 'maintenance') {
      const crew = await tx.get(db.collection('users').where('role', '==', 'crew').where('approved', '==', true));
      ids = [residentId, ...crew.docs.filter(s => approved(s.data())).map(s => s.id), uid];
    }
    ids = [...new Set(ids)];
    if (ids.length < 2 || ids.length > MAX_MEMBERS) fail('failed-precondition');
    const profiles = await Promise.all(ids.map(async id => ({ ...(await tx.get(db.doc(`users/${id}`))).data(), id })));
    for (const p of profiles) {
      if (!approved(p) || p.id !== uid && await isBlocked(tx, db, uid, p.id)) fail('permission-denied');
      if (type !== 'private' && p.id !== residentId && !(type === 'office' ? ['admin', 'vip'].includes(p.role) : p.role === 'crew')) fail('permission-denied');
    }
    const c = { id: cid, memberRefs: Object.fromEntries(ids.map(id => [id, memberPath(cid, id).split('/')[1]])), schemaVersion: 3, type, residentId: type === 'private' ? '' : residentId, memberIds: ids, status: 'open',
      subject: type === 'private' ? String(data.subject || 'Conversation').trim().slice(0, 160) : type === 'office' ? 'Community Office' : 'Maintenance Crew', sequence: 0, createdAt: now, updatedAt: now };
    const members = profiles.map(p => ({ uid: p.id, epoch: 1, status: 'active', joinedAt: now, leftAt: null, reason: '', readSequence: 0 }));
    tx.create(ref(db, cid), c);
    writeProjection(tx, db, cid, c, members, profiles, now);
    // Initial membership is not a fabricated historical join event.
  });
  return { conversationId: cid };
}
async function updateMembership(db, uid, cid, data, now) {
  return db.runTransaction(async tx => {
    const state = await load(tx, db, cid), { conversation: c, members, profiles } = state;
    authorize(state, uid);
    if (c.status !== 'open') fail('failed-precondition');
    if (data.op === 'add' && c.type !== 'office' || data.op === 'sync' && c.type !== 'maintenance') fail('invalid-argument');
    if (data.recipientIds !== undefined && !Array.isArray(data.recipientIds)) fail('invalid-argument');
    let requested = [...new Set(data.recipientIds || [])];
    if (data.op === 'sync') {
      const crew = await tx.get(db.collection('users').where('role', '==', 'crew').where('approved', '==', true));
      requested = crew.docs.filter(s => approved(s.data())).map(s => s.id);
    }
    if (!requested.length && data.op === 'add' || requested.some(v => !validId(v)) || requested.length > MAX_MEMBERS) fail('invalid-argument');
    const newIds = requested.filter(id => !c.memberIds.includes(id));
    if (c.memberIds.length + newIds.length > MAX_MEMBERS) fail('resource-exhausted');
    const newProfiles = await Promise.all(newIds.map(async id => ({ ...(await tx.get(db.doc(`users/${id}`))).data(), id })));
    const joined = [];
    for (const p of [...profiles, ...newProfiles].filter(p => requested.includes(p.id))) {
      if (!approved(p) || !(c.type === 'office' ? ['admin', 'vip'].includes(p.role) : p.role === 'crew')) fail('permission-denied');
      if (p.id !== uid && await isBlocked(tx, db, uid, p.id)) {
        if (data.op === 'sync') continue;
        fail('permission-denied');
      }
      const old = members.find(m => m.uid === p.id);
      // Explicit leave is durable. Neither automatic sync nor an add call can undo it.
      if (old?.reason === 'left' || old?.status === 'active') continue;
      if (!old) { c.memberRefs[p.id] = memberPath(cid, p.id).split('/')[1]; c.memberIds.push(p.id); profiles.push(p); members.push({ uid: p.id, epoch: 1, status: 'active', joinedAt: now, leftAt: null, reason: '', readSequence: c.sequence }); }
      else Object.assign(old, { epoch: old.epoch + 1, status: 'active', joinedAt: now, leftAt: null, reason: '', readSequence: c.sequence });
      joined.push(members.find(m => m.uid === p.id));
    }
    // All reads finish before writes. Role loss revokes access immediately via rules too.
    for (const [i, m] of members.entries()) if (m.status === 'active' && !memberAllowed(c, m, profiles[i])) {
      Object.assign(m, { status: 'left', reason: 'role_revoked', leftAt: now });
    }
    // This transaction's joins share one authorized boundary; older events keep their immutable audience.
    for (const m of joined) event(tx, db, cid, c, members, now, `join_${hash(`${m.uid}/${m.epoch}`)}`, 'join', profiles.find(p => p.id === m.uid), active({conversation:c,members,profiles}).map(visibilityKey));
    c.updatedAt = now;
    tx.set(ref(db, cid), c);
    writeProjection(tx, db, cid, c, members, profiles, now);
    return { conversationId: cid };
  });
}
async function sendMessage(db, uid, cid, data, now) {
  if (!validId(data.messageId) || /^(join|leave|revoke)_/.test(data.messageId) || typeof data.body !== 'string' || !data.body.trim() || data.body.length > 10000 || data.attachments) fail('invalid-argument');
  return db.runTransaction(async tx => {
    const state = await load(tx, db, cid), { conversation: c, members, profiles } = state;
    const sender = authorize(state, uid), actor = profiles.find(p => p.id === uid);
    const previous = await tx.get(db.doc(`inbox_conversations/${cid}/messages/${data.messageId}`));
    if (previous.exists) {
      const m = previous.data();
      if (m.senderId !== uid || m.body !== data.body.trim() || !m.visibility.includes(visibilityKey(sender))) fail('already-exists');
      return { messageId: m.id };
    }
    if (c.status !== 'open') fail('failed-precondition');
    const recipients = [];
    for (const m of active(state)) if (m.uid !== uid && !await isBlocked(tx, db, uid, m.uid)) recipients.push(m);
    if (!recipients.length || c.type === 'private' && active(state).length !== 2) fail('failed-precondition');
    const message = { id: data.messageId, type: 'message', isSystem: false, senderId: uid, senderName: display(actor).name,
      senderRole: actor.role, senderAvatar: display(actor).avatar, body: data.body.trim(), createdAt: now,
      sequence: c.sequence + 1, visibility: [sender, ...recipients].map(visibilityKey), notify: true };
    c.sequence++; c.updatedAt = now;
    for (const m of [sender, ...recipients]) m.lastVisibleSequence = c.sequence;
    tx.create(db.doc(`inbox_conversations/${cid}/messages/${data.messageId}`), message);
    tx.set(ref(db, cid), c);
    const changed = { [uid]: { readSequence: c.sequence } };
    writeProjection(tx, db, cid, c, members, profiles, now, changed);
    return { messageId: message.id };
  });
}
// Reused by ordinary leaves and an atomic legacy cutover+leave. No client UID
// or confirmation flag can select another participant, and cleanup is only queued.
function stageLeave(tx,db,uid,cid,state,now) {
  const {conversation:c,members,profiles}=state;
  const index=c.memberIds.indexOf(uid),member=members[index];
  if(!member||!approved(profiles[index]))fail('permission-denied');
  if(member.status==='left')return{left:true,cleanupPending:c.status==='cleanup_pending',unchanged:true};
  authorize(state,uid);
  const remaining=active(state).filter(m=>m.uid!==uid);
  Object.assign(member,{status:'left',reason:'left',leftAt:now});
  event(tx,db,cid,c,members,now,`leave_${hash(`${uid}/${member.epoch}`)}`,'leave',profiles[index],remaining.map(visibilityKey));
  c.status=!remaining.length?'cleanup_pending':c.type==='private'?'read_only':'open';
  c.updatedAt=now;
  if(!remaining.length)tx.set(db.doc(`inbox_cleanup_requests/${cid}`),{conversationId:cid,status:'awaiting_separate_approval',requestedAt:now,schemaVersion:1});
  return{left:true,cleanupPending:!remaining.length};
}
async function leave(db,uid,cid,_data,now) {
  return db.runTransaction(async tx=>{
    const state=await load(tx,db,cid),result=stageLeave(tx,db,uid,cid,state,now);
    if(!result.unchanged){
      tx.set(ref(db,cid),state.conversation);
      writeProjection(tx,db,cid,state.conversation,state.members,state.profiles,now);
    }
    return result;
  });
}
async function operate(db, uid, data, { now = Date.now(), enabled = false } = {}) {
  if (!validId(uid)) fail('unauthenticated');
  if (!approved((await db.doc(`users/${uid}`).get()).data())) fail('permission-denied');
  if (data.op === 'capabilities') return { protocolVersion: 3, enabled, permanentCleanup: false };
  if (!enabled) fail('failed-precondition');
  if (data.op === 'listLegacy') return require('./inbox-group-legacy.cjs').legacyList(db, uid);
  if (data.op === 'leaveLegacy') return require('./inbox-legacy-leave.cjs').leaveLegacy(db, uid, data, now);
  if (data.op === 'upgradeLegacy') return require('./inbox-group-legacy.cjs').upgradeLegacy(db, uid, data, now);
  if (data.op === 'create') {
    const { legacyList, upgradeLegacy } = require('./inbox-group-legacy.cjs');
    const legacy = await legacyList(db, uid, {includeLeft:true});
    const source = { private: 'resident_chats', office: 'office_chats', maintenance: 'maintenance_chats' }[data.type];
    const matches = legacy.rows.filter(row => (row.collection === source || data.type === 'office' && row.collection === 'resident_chats' && row.data.officeDirect === true && row.data.participantIds?.includes(data.residentId || uid)) && (data.type === 'private'
      ? data.recipientIds?.length === 1 && row.data.participantIds?.includes(data.recipientIds[0])
      : row.collection === 'resident_chats' || row.data.residentId === (data.residentId || uid)));
    if (matches.length > 1) fail('failed-precondition');
    if (matches[0]) {
      const result = await upgradeLegacy(db, uid, { source: matches[0].collection, legacyId: matches[0].id }, now);
      if (data.type === 'office' && data.recipientIds?.length) await updateMembership(db, uid, result.conversationId, { op: 'add', recipientIds: data.recipientIds }, now);
      return result;
    }
    const result = await createConversation(db, uid, data, now);
    if (data.type === 'office') await updateMembership(db, uid, result.conversationId, {op:'add',recipientIds:data.recipientIds}, now);
    if (data.type === 'maintenance') await updateMembership(db, uid, result.conversationId, {op:'sync'}, now);
    return result;
  }
  if (!validId(data.conversationId)) fail('invalid-argument');
  const cid = data.conversationId;
  if (data.op === 'add' || data.op === 'sync') return updateMembership(db, uid, cid, data, now);
  if (data.op === 'send') {
    const c = (await ref(db, cid).get()).data();
    if (c?.type === 'maintenance' && c.status === 'open') await updateMembership(db, uid, cid, { op: 'sync' }, now);
    return sendMessage(db, uid, cid, data, now);
  }
  if (data.op === 'leave') return leave(db, uid, cid, data, now);
  if (data.op === 'read') return db.runTransaction(async tx => {
    const state = await load(tx, db, cid), member = authorize(state, uid);
    if (data.sequence !== undefined && (!Number.isSafeInteger(data.sequence) || data.sequence < 0)) fail('invalid-argument');
    const through = Math.max(member.readSequence || 0, Math.min(data.sequence ?? state.conversation.sequence, state.conversation.sequence));
    const visible = await tx.get(db.collection(`inbox_conversations/${cid}/messages`).where('visibility','array-contains',visibilityKey(member)).where('sequence','<=',through).orderBy('sequence','desc').limit(1));
    const readAt = Math.max(member.readAt || 0, visible.docs[0]?.data().createdAt || 0);
    tx.update(db.doc(memberPath(cid, uid)), { readSequence: through, readAt });
    return { readSequence: through };
  });
  if (data.op === 'roster') return db.runTransaction(async tx => {
    const state = await load(tx, db, cid); authorize(state, uid);
    const candidates = [];
    if (state.conversation.type === 'office' && state.conversation.status === 'open') {
      const staff = await tx.get(db.collection('users').where('role','in',['admin','vip']).where('approved','==',true));
      for (const s of staff.docs) {
        const m = state.members.find(m=>m.uid===s.id);
        if (s.id === uid || m?.reason === 'left' || m?.status === 'active' || !approved(s.data()) || await isBlocked(tx,db,uid,s.id)) continue;
        candidates.push(display({...s.data(),id:s.id}));
      }
    }
    return { members: state.members.filter((m,i)=>memberAllowed(state.conversation,m,state.profiles[i])).map(m=>({ ...display(state.profiles.find(p=>p.id===m.uid)), status:'active' })), candidates };
  });
  fail('invalid-argument');
}
module.exports = { operate, memberAllowed, canSee, memberPath, visibilityKey, MAX_MEMBERS, hash, load, stageLeave, writeProjection };
