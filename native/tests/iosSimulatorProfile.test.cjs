const test=require('node:test'),assert=require('node:assert/strict');
const eas=require('../eas.json');
test('unsigned simulator profile is isolated from Android, signed iPhone and Production releases',()=>{
 const profile=eas.build['ios-simulator'];
 assert.equal(profile.ios.simulator,true);
 assert.equal(profile.ios.buildConfiguration,'Release');
 assert.equal(profile.environment,'preview');
 assert.equal(profile.channel,'preview-simulator');
 assert.equal(profile.env.EXPO_PUBLIC_TOWNLOOP_IOS_SIMULATOR,'1');
 assert.equal(profile.ios.credentialsSource,undefined);
 assert.equal(profile.android,undefined);
 assert.equal(eas.build.preview.ios.simulator,false);
 assert.equal(eas.build.preview.channel,'preview');
 assert.equal(eas.build.production.channel,'production');
});
test('build helper accepts simulator only for iOS and retains submit-once workflow',()=>{
 const {assertBuildTarget}=require('../scripts/submit-build.cjs');
 assert.doesNotThrow(()=>assertBuildTarget('ios','ios-simulator'));
 assert.throws(()=>assertBuildTarget('android','ios-simulator'),/iOS-only/);
 assert.throws(()=>assertBuildTarget('all','ios-simulator'),/iOS-only/);
 assert.doesNotThrow(()=>assertBuildTarget('android','preview'));
});
test('EAS resolves the simulator profile and skips Apple signing without a credential context',async()=>{
 const path=require('node:path');
 const {EasJsonAccessor}=require('@expo/eas-json/build/accessor');
 const {EasJsonUtils}=require('@expo/eas-json/build/utils');
 const resolved=await EasJsonUtils.getBuildProfileAsync(EasJsonAccessor.fromProjectPath(path.resolve(__dirname,'..')),'ios','ios-simulator');
 assert.equal(resolved.simulator,true);
 const {ensureIosCredentialsAsync}=require('eas-cli/build/build/ios/credentials');
 const result=await ensureIosCredentialsAsync({buildProfile:resolved,get credentialsCtx(){throw Error('Simulator must not access Apple credentials');}},[]);
 assert.equal(result,undefined);
});
