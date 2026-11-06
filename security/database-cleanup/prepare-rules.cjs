const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');

const BASELINE_SHA256 = '4d1c449fc847c8273efdee3b813d16a1e996dd0fdfc766e3cfb09c4ace8eb6d0';
const STORAGE_BASELINE_SHA256 = '9aac5f82b7e31fef034b92340714136ec943232de88b1a0076c001331958c3e9';
const ROOTS = ['work_orders', 'discussion_feed', 'posts', 'marketplace_posts', 'marketItems',
  'newsletters', 'community_events', 'community_highlights', 'newsletter_analysis_jobs'];
const sha256 = source => createHash('sha256').update(source).digest('hex');
const HELPER = `
    // Local, undeployed cleanup candidate. These records are written only by server code.
    // Confirmed Storage cleanup temporarily blocks every client reference write globally.
    // A per-root fence survives completion so stale clients cannot recreate erased records.
    // Derived newsletter records share an edition fence, preserving atomic publish batches.
    function databaseCleanupEditionWriteAllowed(data) {
      let editionId = data.get('newsletterId', '');
      return data.get('isAiExtracted', false) != true || !(editionId is string) ||
        editionId == '' || !editionId.matches('^[^/]+$') ||
        !exists(/databases/$(database)/documents/database_cleanup_fences/newsletters/records/$(editionId));
    }
    function databaseCleanupDerivedWriteAllowed() {
      return (request.method == 'create' || databaseCleanupEditionWriteAllowed(resource.data)) &&
        (request.method == 'delete' || databaseCleanupEditionWriteAllowed(request.resource.data));
    }
    function databaseCleanupWriteAllowed() {
      let rootCollection = request.path[3];
      let rootId = request.path[4];
      return (!exists(/databases/$(database)/documents/database_cleanup_control/active) ||
        get(/databases/$(database)/documents/database_cleanup_control/active).data.get('referenceWritesBlocked', false) != true) &&
        (!(rootCollection in ['work_orders', 'discussion_feed', 'posts', 'marketplace_posts',
          'marketItems', 'newsletters', 'community_events', 'community_highlights', 'newsletter_analysis_jobs']) ||
        ((!exists(/databases/$(database)/documents/database_cleanup_control/active) ||
          !(rootCollection in get(/databases/$(database)/documents/database_cleanup_control/active).data.get('collections', []))) &&
         (rootCollection in ['community_events', 'community_highlights'] ? databaseCleanupDerivedWriteAllowed() :
          (!exists(/databases/$(database)/documents/database_cleanup_fences/$(rootCollection)/records/$(rootId)) ||
          (request.path == /databases/$(database)/documents/newsletters/current &&
           get(/databases/$(database)/documents/database_cleanup_fences/$(rootCollection)/records/$(rootId)).data.get('descendantsOnly', false) == true)))));
    }

    match /database_cleanup_control/{document=**} { allow read: if false; allow write: if databaseCleanupWriteAllowed() && (false); }
    match /database_cleanup_fences/{document=**} { allow read: if false; allow write: if databaseCleanupWriteAllowed() && (false); }
    match /database_cleanup_jobs/{document=**} { allow read: if false; allow write: if databaseCleanupWriteAllowed() && (false); }
`;

// Every existing predicate is retained verbatim. Split mixed declarations so reads
// never acquire a cleanup guard. Reject drift rather than editing a new baseline.
function prepare(source) {
  if (sha256(source) !== BASELINE_SHA256) throw Error('Default rules baseline drift: stop and coordinate the deletion worker/hash/receipt.');
  const guarded = source.replace(/allow\s+([a-z,\s]+):\s*if\s+([^;]+);/g, (all, names, predicate, offset) => {
    const ops = names.split(',').map(v => v.trim());
    const reads = ops.filter(v => ['read', 'get', 'list'].includes(v));
    const writes = ops.filter(v => ['write', 'create', 'update', 'delete'].includes(v));
    if (reads.length + writes.length !== ops.length) throw Error('Unknown allow operation');
    if (!writes.length) return all;
    const write = `allow ${writes.join(', ')}: if databaseCleanupWriteAllowed() && (${predicate});`;
    if (!reads.length) return write;
    const indent = source.slice(source.lastIndexOf('\n', offset) + 1, offset).match(/^\s*/)[0];
    return `allow ${reads.join(', ')}: if ${predicate};\n${indent}${write}`;
  });
  const anchor = '  match /databases/{database}/documents {';
  if (!guarded.includes(anchor)) throw Error('Missing database anchor');
  return guarded.replace(anchor, () => anchor + '\n' + HELPER);
}
function prepareStorage(source) {
  if (sha256(source) !== STORAGE_BASELINE_SHA256) throw Error('Storage rules baseline drift: stop and coordinate the deletion worker/hash/receipt.');
  const guarded = source.replace(/allow\s+([a-z,\s]+):\s*if\s+([^;]+);/g, (all, names, predicate, offset) => {
    const ops = names.split(',').map(v => v.trim());
    const reads = ops.filter(v => ['read', 'get', 'list'].includes(v));
    const writes = ops.filter(v => ['write', 'create', 'update', 'delete'].includes(v));
    if (reads.length + writes.length !== ops.length) throw Error('Unknown Storage allow operation');
    if (!writes.length) return all;
    const write = `allow ${writes.join(', ')}: if databaseCleanupReferenceWriteAllowed() && (${predicate});`;
    if (!reads.length) return write;
    const indent = source.slice(source.lastIndexOf('\n', offset) + 1, offset).match(/^\s*/)[0];
    return `allow ${reads.join(', ')}: if ${predicate};\n${indent}${write}`;
  });
  const anchor = '  match /b/{bucket}/o {';
  if (!guarded.includes(anchor)) throw Error('Missing Storage anchor');
  return guarded.replace(anchor, () => anchor + `
    // Local undeployed candidate. Only server code may write this default-database control.
    function databaseCleanupReferenceWriteAllowed() {
      return !firestore.exists(/databases/(default)/documents/database_cleanup_control/active) ||
        firestore.get(/databases/(default)/documents/database_cleanup_control/active).data.get('referenceWritesBlocked', false) != true;
    }
`);
}
module.exports = {BASELINE_SHA256, STORAGE_BASELINE_SHA256, ROOTS, sha256, prepare, prepareStorage};
if (require.main === module) {
  const baseline = fs.readFileSync(path.join(__dirname, '../account-deletion/firestore.default.candidate.rules'), 'utf8');
  const candidate = prepare(baseline);
  fs.writeFileSync(path.join(__dirname, 'firestore.rules'), candidate);
  console.log('Local undeployed Firestore candidate SHA256: ' + sha256(candidate));
  const storage = prepareStorage(fs.readFileSync(path.join(__dirname, '../c2/storage.compatible.rules'), 'utf8'));
  fs.writeFileSync(path.join(__dirname, 'storage.rules'), storage);
  console.log('Local undeployed Storage candidate SHA256: ' + sha256(storage));
}
