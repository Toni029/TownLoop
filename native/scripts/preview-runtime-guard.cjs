// A successful Preview APK is the compatibility authority, never a manually pinned runtime.
function assertPreviewRuntime(build, fingerprint, config) {
 const expected = build.runtimeVersion || build.fingerprint?.hash;
 if (build.status !== 'FINISHED' || build.platform !== 'ANDROID' || build.buildProfile !== 'preview') throw Error('Select a finished Android Preview APK.');
 if (build.appIdentifier !== config.expo.android.package) throw Error('APK application ID mismatch.');
 if (!expected || !fingerprint.hash || expected !== fingerprint.hash) throw Error(`Native runtime mismatch: APK ${expected || 'unknown'}, source ${fingerprint.hash || 'unknown'}. Build an approved compatible APK; do not override runtime safety.`);
 return expected;
}
module.exports = { assertPreviewRuntime };
