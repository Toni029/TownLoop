/** Offline only: input is reviewed Admin-exported JSON. No live SDK or credentials. */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

function objectPath(value, bucket) {
  if (typeof value !== 'string') return null;
  const prefix = `gs://${bucket}/`;
  if (value.startsWith(prefix)) return value.slice(prefix.length);
  try {
    const url = new URL(value);
    const head = `/v0/b/${bucket}/o/`;
    if (url.protocol === 'https:' && url.hostname === 'firebasestorage.googleapis.com' && url.pathname.startsWith(head))
      return decodeURIComponent(url.pathname.slice(head.length));
  } catch { /* Non-storage strings are ignored. */ }
  return null;
}
function references(record) {
  const urls = [...(Array.isArray(record.photos) ? record.photos : []), record.photoUrl, record.latestResolutionPhoto];
  for (const comment of Array.isArray(record.comments) ? record.comments : []) {
    urls.push(comment.photoUrl, comment.latestResolutionPhoto);
    for (const revision of Array.isArray(comment.revisions) ? comment.revisions : []) urls.push(revision.photoUrl);
  }
  return urls;
}
/** Each object must match exactly one existing authorized parent. Never derive an owner from a filename. */
export function planWorkOrderStorageMigration({bucket, records, objects}) {
  if (typeof bucket !== 'string' || !Array.isArray(records) || !Array.isArray(objects)) throw new Error('Expected bucket, records and objects snapshot.');
  const links = new Map();
  for (const {id, data} of records) {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(id) || !data || typeof data.userId !== 'string' || !data.userId || data.storageDraft === true)
      throw new Error(`Unverified published parent: ${id}`);
    for (const value of references(data)) {
      const path = objectPath(value, bucket);
      if (!path?.startsWith('work_orders/') || path.split('/').length !== 2) continue;
      const parents = links.get(path) || new Map();
      parents.set(id, data.userId); links.set(path, parents);
    }
  }
  const plan = [], blocked = [];
  const seen = new Set();
  for (const object of objects) {
    if (typeof object.name !== 'string' || !object.name.startsWith('work_orders/')) continue;
    if (seen.has(object.name)) throw new Error(`Duplicate inventory object: ${object.name}`);
    seen.add(object.name);
    const parents = links.get(object.name);
    if (!parents || parents.size !== 1) { blocked.push({path: object.name, reason: parents ? 'Ambiguous parent records' : 'No verified parent reference'}); continue; }
    if (typeof object.metadata?.uploadedBy !== 'string' || !object.metadata.uploadedBy) {
      blocked.push({path: object.name, reason: 'Missing historical uploadedBy; requires manual reviewed metadata decision'}); continue;
    }
    const [recordId, ownerUid] = [...parents.entries()][0];
    // Historical uploader identity cannot be inferred: staff may have attached proof.
    // Storage read/delete authorization uses the linked parent, not uploadedBy.
    plan.push({path: object.name, linkedOwnerUid: ownerUid,
      mergeCustomMetadata: {securityVersion: '1', collection: 'work_orders', recordId},
      preserveHistoricalUploadedByAsUntrusted: true,
      revokeDownloadTokens: 'REQUIRES_EXPLICIT_APPROVAL_AFTER_AUTHENTICATED_READER_VALIDATION'});
  }
  for (const path of links.keys()) if (!seen.has(path)) blocked.push({path, reason: 'Referenced object missing from inventory'});
  return {mode: 'OFFLINE_PLAN_ONLY', readyForReview: blocked.length === 0, plan, blocked};
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3) throw new Error('Usage: node security/plan-workorder-storage-migration.mjs reviewed-snapshot.json');
  process.stdout.write(JSON.stringify(planWorkOrderStorageMigration(JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))), null, 2) + '\n');
}
