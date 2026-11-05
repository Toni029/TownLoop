// Local packaging validation only. Never reads credentials or calls Firebase.
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const baselinePath = path.join(root, 'security/account-deletion/rules-manifest.json');
const nativePath = path.join(root, 'security/native-only-firestore/deletion-rules-manifest.json');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function selectedRulesManifest(args = []) {
  if (args.length && (args.length !== 1 || args[0] !== '--native-only-rules')) throw Error('Unknown deletion packaging option.');
  const file = args.length ? nativePath : baselinePath;
  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (manifest.project !== 'cc-livingcommunity-app' || manifest.scopes.length !== 2 ||
      JSON.stringify(manifest.scopes.map(s => s.database)) !== JSON.stringify(baseline.scopes.map(s => s.database))) throw Error('Deletion database scope changed.');
  if (manifest.scopes[0].candidateSHA256 !== baseline.scopes[0].candidateSHA256) throw Error('Native default rules must remain unchanged.');
  for (const scope of manifest.scopes) {
    const source = path.resolve(path.dirname(file), scope.file);
    if (hash(fs.readFileSync(source)) !== scope.candidateSHA256) throw Error('Reviewed rule source hash changed.');
  }
  if (args.length) {
    const scope = manifest.scopes[1];
    if (path.resolve(path.dirname(file), scope.file) !== path.join(root, 'security/native-only-firestore/firestore.named.rules')) throw Error('Named containment source changed.');
  }
  return file;
}
module.exports = {selectedRulesManifest};
