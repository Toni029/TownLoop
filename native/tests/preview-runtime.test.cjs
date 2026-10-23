const test = require('node:test');
const assert = require('node:assert/strict');
const {assertPreviewRuntime} = require('../scripts/preview-runtime-guard.cjs');
const config = {expo:{android:{package:'com.toni029.townloop'}}};
const build = {status:'FINISHED',platform:'ANDROID',buildProfile:'preview',appIdentifier:'com.toni029.townloop',fingerprint:{hash:'native-v1'}};
test('Preview publication requires exact intended APK runtime',()=>{
 assert.equal(assertPreviewRuntime(build,{hash:'native-v1'},config),'native-v1');
 assert.throws(()=>assertPreviewRuntime(build,{hash:'native-v2'},config),/Native runtime mismatch/);
 assert.throws(()=>assertPreviewRuntime({...build,fingerprint:null},{hash:'native-v1'},config),/Native runtime mismatch/);
 assert.throws(()=>assertPreviewRuntime({...build,buildProfile:'production'},{hash:'native-v1'},config),/Preview APK/);
});
