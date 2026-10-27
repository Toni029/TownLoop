// masked-view 0.3.2's Gradle script removes this attribute in-place on AGP >= 7.
// Do it deterministically at install time so clean EAS builds and a workstation
// that has already run Gradle produce the same native runtime fingerprint.
const fs = require('node:fs');
const path = require('node:path');
const packageFile = require.resolve('@react-native-masked-view/masked-view/package.json');
const manifest = path.join(path.dirname(packageFile), 'android/src/main/AndroidManifest.xml');
const source = fs.readFileSync(manifest, 'utf8');
const normalized = source.replace('package="org.reactnative.maskedview"', '');
if (normalized !== source) fs.writeFileSync(manifest, normalized);
