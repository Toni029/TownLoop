// Pinned expo-video 57.0.5: opt out before native player construction, for startup only.
// Fail closed on upstream source drift; do not apply a best-effort native patch.
const fs = require('node:fs');
const path = require('node:path');
function applyStartupPatch(root = path.dirname(require.resolve('expo-video/package.json'))) {
if (require(path.join(root, 'package.json')).version !== '57.0.5') throw Error('Review startup opt-out before changing expo-video version.');
const changes = require('../patches/startup-video.json');
const pending = [];
for (const {file, before, after} of changes) {
 const location = path.join(root, file);
 const source = pending.find(entry => entry.location === location)?.source ?? fs.readFileSync(location, 'utf8');
 if (source.includes(after)) continue;
 if (!source.includes(before) || source.split(before).length !== 2) throw Error(`Startup patch source drift: ${file}`);
 const updated = {location, source:source.replace(before,after)};
 const i = pending.findIndex(entry => entry.location === location);
 if(i < 0) pending.push(updated); else pending[i] = updated;
}
for (const {location,source} of pending) fs.writeFileSync(location,source);

}
module.exports = { applyStartupPatch };
if (require.main === module) applyStartupPatch();
