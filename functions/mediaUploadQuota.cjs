'use strict';
const { createHash, randomUUID } = require('node:crypto');
const { budget } = require('./abuseLimits.cjs');
const { approved } = require('./inbox-policy.cjs');
const { assertReferenceWritesAllowed } = require('./referenceWriteBarrier.cjs');
const { ms } = require('./abusePolicy.cjs');
const TTL_MS = 60 * 60 * 1000;
const MAX_BYTES = 25 * 1024 * 1024;
const CORE_METADATA = ['uploadedBy', 'recordId', 'collection', 'securityVersion'];
const reservationId = (uid, path) => createHash('sha256').update(JSON.stringify([uid, path])).digest('hex');
const fail = code => { throw Error(code); };
function uploadInput(uid, data) {
  if (typeof uid !== 'string' || !uid || uid.includes('/') || uid.length > 128) fail('unauthenticated');
  const { path, bytes, contentType, metadata } = data || {};
  if (typeof path !== 'string' || path.length > 400 || !/^(work_orders|feed|marketplace)\/[^/\u0000-\u001f\\]{1,350}$/.test(path) || ['.', '..'].includes(path.split('/')[1]) ||
      !Number.isSafeInteger(bytes) || bytes <= 0 || bytes >= MAX_BYTES || typeof contentType !== 'string' || !metadata || typeof metadata !== 'object' || Array.isArray(metadata)) fail('invalid-argument');
  if (Object.keys(metadata).length !== CORE_METADATA.length || !CORE_METADATA.every(key => typeof metadata[key] === 'string') ||
      metadata.uploadedBy !== uid || metadata.securityVersion !== '1' || !/^[A-Za-z0-9_-]{1,128}$/.test(metadata.recordId)) fail('invalid-argument');
  const folder = path.split('/')[0];
  const collections = folder === 'work_orders' ? ['work_orders'] : folder === 'feed' ? ['discussion_feed', 'posts'] : ['marketplace_posts', 'marketItems'];
  const image = /^image\/(jpeg|png|webp|gif|heic|heif|avif|bmp|tiff)$/.test(contentType);
  if (!collections.includes(metadata.collection) || !(image || folder !== 'work_orders' && /^video\/(mp4|webm|quicktime|3gpp|3gpp2|x-m4v|mpeg|ogg)$/.test(contentType))) fail('invalid-argument');
  return { path, bytes, contentType, metadata: Object.fromEntries(CORE_METADATA.map(key => [key, metadata[key]])) };
}
function authorizeParent(uid, profile, parent, input, now) {
  if (!approved(profile) || !parent) fail('permission-denied');
  const owned = (parent.userId ?? parent.authorId ?? '') === uid;
  const published = parent.storageDraft === false;
  // Mirrors existing Storage draft semantics: only the draft owner can upload before publication.
  const live = published || parent.userId === uid && ms(parent.storageDraftExpiresAt) > now;
  if (!live) fail('permission-denied');
  if (input.metadata.collection === 'work_orders') {
    const staff = ['admin', 'vip', 'crew'].includes(profile.role);
    if (parent.status === 'Done' || !(parent.userId === uid || staff && published)) fail('permission-denied');
  } else if (!owned) fail('permission-denied');
}
function sameUpload(a, b) {
  return a.path === b.path && a.bytes === b.bytes && a.contentType === b.contentType && CORE_METADATA.every(key => a.metadata?.[key] === b.metadata?.[key]);
}
function sameTicket(a, b) {
  return sameUpload(a, b) && a.parentGeneration === b.parentGeneration && ms(a.issuedAt) === ms(b.issuedAt) && ms(a.expiresAt) === ms(b.expiresAt);
}
const liveTickets = (tickets, now) => Object.fromEntries(Object.entries(tickets || {}).filter(([, ticket]) => ms(ticket.expiresAt) > now));
/** Server-only durable quota tickets plus parent receipts, sharing Storage's existing parent lookup. */
async function issue(db, uid, data, { now = Date.now() } = {}) {
  const input = uploadInput(uid, data);
  if (!Number.isSafeInteger(now)) fail('invalid-argument');
  const id = reservationId(uid, input.path), quotaRef = db.doc(`safety_limits/${uid}`), parentRef = db.doc(`${input.metadata.collection}/${input.metadata.recordId}`), freshGeneration = randomUUID();
  return db.runTransaction(async tx => {
    await assertReferenceWritesAllowed(tx, db);
    const [user, parent, quota, revocation] = await Promise.all([
      tx.get(db.doc(`users/${uid}`)), tx.get(parentRef), tx.get(quotaRef), tx.get(db.doc(`account_access_revocations/${uid}`)),
    ]);
    if (revocation.exists) fail('permission-denied');
    authorizeParent(uid, user.data(), parent.data(), input, now);
    const old = quota.data() || {}, uploads = old.uploads || {}, existing = uploads[id];
    if (existing && ms(existing.expiresAt) > now && (existing.metadata.collection !== input.metadata.collection || existing.metadata.recordId !== input.metadata.recordId)) fail('failed-precondition');
    const generation = parent.data().mediaUploadGeneration;
    if (generation !== undefined && (typeof generation !== 'string' || !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(generation))) fail('failed-precondition');
    const parentGeneration = generation || freshGeneration;
    if (existing && typeof generation === 'string' && existing.parentGeneration === generation && ms(existing.expiresAt) > now) {
      if (!sameUpload(existing, input)) fail('failed-precondition');
      if (existing.status !== 'issued') fail('already-exists');
      const projection = parent.data().mediaUploadTickets?.[id];
      if (projection && (!sameTicket(projection, existing) || projection.status !== 'issued')) fail('failed-precondition');
      // Restore a missing projection only within the same server-owned parent generation.
      // A deleted/recreated parent must pay for a new reservation even for the same path.
      if (!projection) tx.update(parentRef, { mediaUploadTickets: { ...liveTickets(parent.data().mediaUploadTickets, now), [id]: existing } });
      return { reservationId: id, expiresAt: ms(existing.expiresAt) };
    }
    const apply = await budget(tx, db, uid, 'media', id, now, input.bytes);
    const retained = liveTickets(uploads, now);
    const expiresAt = now + TTL_MS;
    retained[id] = { ...input, parentGeneration, status: 'issued', issuedAt: new Date(now), expiresAt: new Date(expiresAt) };
    apply();
    // update replaces the map, actually removing expired entries instead of recursively merging them.
    tx.update(quotaRef, { uploads: retained });
    tx.update(parentRef, { mediaUploadGeneration: parentGeneration, mediaUploadTickets: { ...liveTickets(parent.data().mediaUploadTickets, now), [id]: retained[id] } });
    return { reservationId: id, expiresAt };
  });
}
/** Verify current Auth identity, including server revocation state, before authorizing the quota transaction. */
async function issueAuthenticated(db, identity, request, options) {
  const uid = request?.auth?.uid, claims = request?.auth?.token;
  if (typeof uid !== 'string' || !claims || claims.firebase?.sign_in_provider === 'anonymous' || !Number.isFinite(claims.auth_time) || claims.auth_time <= 0) fail('unauthenticated');
  const user = await identity(uid);
  const validAfter = Date.parse(user?.tokensValidAfterTime || '1970-01-01');
  if (!user || user.uid !== uid || user.disabled || !Number.isFinite(validAfter) || claims.auth_time * 1000 < validAfter) fail('unauthenticated');
  return issue(db, uid, request.data, options);
}
/** Trusted finalize events retire matching parent receipts; durable completion prevents replay. */
async function finalized(db, object, { bucket, now = Date.now() } = {}) {
  const metadata = object?.metadata, uid = metadata?.uploadedBy, id = metadata?.quotaReservation;
  if (typeof bucket !== 'string' || !bucket || object?.bucket !== bucket || typeof uid !== 'string' || !uid || uid.includes('/') ||
      typeof object.name !== 'string' || id !== reservationId(uid, object.name) || !/^\d+$/.test(String(object.generation || ''))) return false;
  const bytes = Number(object.size), createdAt = Date.parse(object.timeCreated || '');
  if (!Number.isSafeInteger(bytes) || !Number.isFinite(createdAt)) return false;
  const ref = db.doc(`safety_limits/${uid}`);
  return db.runTransaction(async tx => {
    const snapshot = await tx.get(ref), old = snapshot.data(), ticket = old?.uploads?.[id];
    if (!ticket || !sameUpload(ticket, {path: object.name, bytes, contentType: object.contentType, metadata}) ||
        createdAt < ms(ticket.issuedAt) || createdAt > ms(ticket.expiresAt)) return false;
    if (!['issued', 'complete'].includes(ticket.status) || ticket.status === 'complete' && ticket.generation !== String(object.generation)) return false;
    const parentRef = db.doc(`${ticket.metadata.collection}/${ticket.metadata.recordId}`);
    const parentSnapshot = await tx.get(parentRef), parent = parentSnapshot.data(), projection = parent?.mediaUploadTickets?.[id];
    const complete = ticket.status === 'complete' ? ticket : { ...ticket, status: 'complete', generation: String(object.generation), completedAt: new Date(now) };
    if (ticket.status === 'issued') tx.update(ref, { uploads: { ...old.uploads, [id]: complete } });
    if (parentSnapshot.exists && parent.mediaUploadGeneration === ticket.parentGeneration && projection?.status === 'issued' && sameTicket(projection, ticket)) {
      const remaining = { ...parent.mediaUploadTickets };
      delete remaining[id];
      tx.update(parentRef, { mediaUploadTickets: remaining });
    }
    return true;
  });
}
module.exports = { issue, issueAuthenticated, finalized, reservationId, TTL_MS };
