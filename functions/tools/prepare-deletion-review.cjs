// Deterministic local packaging only; never invokes Firebase or reads live data.
const fs = require('node:fs');
const path = require('node:path');
const source = path.resolve(__dirname, '..');
const target = path.resolve(source, '../.release/deletion-review');
const files = ['accountDeletionReview.cjs', 'accountDeletionStatus.cjs', 'accountDeletionPolicy.cjs', 'accountDeletionRetention.cjs', 'accountDeletionScope.cjs', 'accountDeletionInventory.cjs', 'package.json', 'package-lock.json'];
fs.mkdirSync(target, {recursive: true});
// Reject stale/unreviewed source additions, rather than ship anything extra.
const allowed = new Set([...files, 'index.cjs', 'node_modules']);
for (const file of fs.readdirSync(target)) if (!allowed.has(file)) throw Error('Unexpected staged release file');
for (const file of files) fs.copyFileSync(path.join(source, file), path.join(target, file));
fs.copyFileSync(path.join(source, 'deletionReviewEntry.cjs'), path.join(target, 'index.cjs'));
// Reuse installed dependencies for local discovery; deployment excludes this link.
if (!fs.existsSync(path.join(target, 'node_modules'))) fs.symlinkSync(path.join(source, 'node_modules'), path.join(target, 'node_modules'), 'dir');
console.log('Prepared review-only source; no deployment performed.');
