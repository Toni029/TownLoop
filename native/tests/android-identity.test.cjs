const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),app=require('../app.json').expo,eas=require('../eas.json');
test('Android identity changes while iOS, EAS project, channels and native features remain intact',()=>{
 assert.equal(app.android.package,'com.townloop.app');assert.equal(app.ios.bundleIdentifier,'com.toni029.townloop');assert.equal(app.scheme,'townloop');assert.equal(app.extra.eas.projectId,'9f970d26-beed-44d6-a590-9dcdc00e85de');assert.equal(app.runtimeVersion.policy,'fingerprint');
 assert.equal(eas.build.production.android.buildType,'app-bundle');assert.equal(eas.build.preview.android.buildType,'apk');assert.equal(eas.build.preview.android.credentialsSource,'local');assert.equal(eas.build.preview.channel,'preview');assert.equal(eas.build.production.channel,'production');
 assert.ok(app.plugins.some(p=>p==='./plugins/with-inbox-push.cjs'));assert.ok(app.plugins.some(p=>p==='expo-video'));assert.ok(app.plugins.some(p=>Array.isArray(p)&&p[0]==='expo-notifications'));
});
test('old-package APK is rejected even when a proposed fingerprint matches',()=>{
 const {assertPreviewRuntime}=require('../scripts/preview-runtime-guard.cjs');assert.throws(()=>assertPreviewRuntime({status:'FINISHED',platform:'ANDROID',buildProfile:'preview',appIdentifier:'com.toni029.townloop',runtimeVersion:'same'}, {hash:'same'},{expo:app}),/application ID mismatch/);
});
test('generated local Android settings match Expo when present; no native project is committed',()=>{
 const {execFileSync}=require('node:child_process');assert.equal(execFileSync('git',['ls-files','android'],{cwd:root,encoding:'utf8'}).trim(),'');
 const gradle=path.join(root,'android/app/build.gradle');if(fs.existsSync(gradle)){const source=fs.readFileSync(gradle,'utf8');assert.match(source,/namespace 'com\.townloop\.app'/);assert.match(source,/applicationId 'com\.townloop\.app'/);}
});
