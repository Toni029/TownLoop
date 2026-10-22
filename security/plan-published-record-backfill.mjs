/** Offline review artifact only. This file contains no network or Firebase SDK operations. */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const collections = new Set(['work_orders', 'discussion_feed', 'marketplace_posts', 'posts', 'marketItems']);
/** Inputs must be separately exported and human-reviewed as published, with snapshot updateTime. */
export function planPublishedRecordBackfill({records}) {
  if (!Array.isArray(records)) throw new Error('Expected a reviewed records snapshot.');
  const plan = [], blocked = [], skipped = [];
  const seen = new Set();
  for (const record of records) {
    const {collection, id, data, reviewedPublished, updateTime} = record;
    const path = `${collection}/${id}`;
    if (!collections.has(collection) || typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) {
      blocked.push({path, reason: 'Unsupported collection or invalid document ID'}); continue;
    }
    if (seen.has(path)) throw new Error(`Duplicate snapshot record: ${path}`);
    seen.add(path);
    if (!data || typeof data !== 'object' || Array.isArray(data)) { blocked.push({path, reason: 'Missing record data'}); continue; }
    if (data.storageDraft === true) { skipped.push({path, reason: 'Draft: never publish via backfill'}); continue; }
    if (data.storageDraft === false) { skipped.push({path, reason: 'Already marked published'}); continue; }
    if (Object.hasOwn(data, 'storageDraft')) { blocked.push({path, reason: 'Unexpected existing publication marker'}); continue; }
    const owner = collection === 'posts' || collection === 'marketItems' ? data.authorId : data.userId;
    if (typeof owner !== 'string' || !owner.trim()) { blocked.push({path, reason: 'Missing verified owner field'}); continue; }
    if (reviewedPublished !== true || typeof updateTime !== 'string' || !Number.isFinite(Date.parse(updateTime))) {
      blocked.push({path, reason: 'Published status and snapshot updateTime require explicit review'}); continue;
    }
    plan.push({path, precondition: {updateTime}, update: {storageDraft: false}});
  }
  return {mode: 'OFFLINE_PLAN_ONLY', readyForReview: blocked.length === 0, plan, blocked, skipped,
    deploymentGate: 'Apply reviewed marker backfill with updateTime preconditions before deploying marker-filtered queries or draft rules.'};
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3) throw new Error('Usage: node security/plan-published-record-backfill.mjs reviewed-records.json');
  process.stdout.write(JSON.stringify(planPublishedRecordBackfill(JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))), null, 2) + '\n');
}
