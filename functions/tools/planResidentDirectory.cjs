#!/usr/bin/env node
// Offline only. Never imports Firebase, initializes credentials, or connects to a service.
const fs = require('node:fs');
const { directoryProjection } = require('../profilePrivacyPolicy.cjs');
function planDirectoryMigration(input) {
  if (!input || !Array.isArray(input.users)) throw Error('Expected {users:[{id,data}], directoryIds?:string[]} from an explicit authorized export.');
  const validId = id => typeof id === 'string' && id.length > 0 && id.length <= 128 && !id.includes('/') && id !== '.' && id !== '..';
  const seen = new Set();
  const operations = [], review = [];
  for (const row of input.users) {
    if (!row || !validId(row.id) || seen.has(row.id) || !row.data || typeof row.data !== 'object' || Array.isArray(row.data)) throw Error('Invalid or duplicate exported user record.');
    seen.add(row.id);
    const data = directoryProjection(row.id, row.data);
    operations.push(data ? { operation: 'replace', path: `resident_directory/${row.id}`, data } : { operation: 'delete', path: `resident_directory/${row.id}` });
    if (!['resident', 'crew', 'vip', 'admin'].includes(row.data.role)) review.push({ uid: row.id, reason: 'noncanonical-role' });
    if (typeof row.data.approved !== 'boolean') review.push({ uid: row.id, reason: 'nonboolean-approval' });
  }
  if (input.directoryIds !== undefined && !Array.isArray(input.directoryIds)) throw Error('directoryIds must be an explicit complete directory ID export.');
  for (const id of input.directoryIds || []) {
    if (!validId(id)) throw Error('Invalid directory document ID.');
    if (!seen.has(id)) { operations.push({ operation: 'delete', path: `resident_directory/${id}` }); seen.add(id); }
  }
  return { version: 1, offlineOnly: true, operations, review };
}
if (require.main === module) {
  try {
    const args = process.argv.slice(2), options = {};
    while (args.length) {
      const key = args.shift();
      if (!['--input', '--output'].includes(key) || !args.length || options[key]) throw Error('Usage: node tools/planResidentDirectory.cjs --input authorized-export.json [--output reviewed-plan.json]');
      options[key] = args.shift();
    }
    if (!options['--input']) throw Error('An explicit local --input export is required; no database is queried.');
    const plan = planDirectoryMigration(JSON.parse(fs.readFileSync(options['--input'], 'utf8')));
    if (options['--output']) fs.writeFileSync(options['--output'], JSON.stringify(plan, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    console.log(JSON.stringify({ dryRun: true, network: false, replacements: plan.operations.filter(o => o.operation === 'replace').length, deletions: plan.operations.filter(o => o.operation === 'delete').length, manualReview: plan.review.length, planWritten: !!options['--output'] }));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { planDirectoryMigration };
