const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../plugins/with-google-auth.cjs'),'utf8');
function load(env,androidOAuthRegistered=true,certificates={}){const reads=[],module={exports:{}};vm.runInNewContext(source,{module,exports:module.exports,__dirname:'/native/plugins',process:{env},require:name=>{
 if(name==='../google-auth.json')return{androidOAuthRegistered,iosOAuthRegistered:false,...certificates};
 if(['fs','node:fs'].includes(name))return{existsSync:()=>true,readFileSync:file=>{reads.push(file);return'{}';}};
 if(['path','node:path'].includes(name))return require('node:path');
 if(name==='./google-oauth.cjs')return{validateAndroidConfig:()=>true};
 throw Error('Unexpected dependency');
 }});return{plugin:module.exports,reads};}
test('Android Production refuses to silently use the ignored Preview Firebase file',()=>{
 const {plugin,reads}=load({EAS_BUILD_PROFILE:'production',EAS_BUILD_PLATFORM:'android'});
 assert.throws(()=>plugin({android:{package:'com.townloop.app'}}),/Production.*GOOGLE_SERVICES_JSON/);assert.deepEqual(reads,[]);
});
test('explicit Production file is selected; Preview fallback and iOS stay unchanged',()=>{
 const production=load({EAS_BUILD_PROFILE:'production',EAS_BUILD_PLATFORM:'android',GOOGLE_SERVICES_JSON:'/eas/production.json'});
 production.plugin({android:{package:'com.townloop.app'}});assert.deepEqual(production.reads,['/eas/production.json']);
 const preview=load({EAS_BUILD_PROFILE:'preview',EAS_BUILD_PLATFORM:'android'});preview.plugin({android:{}});assert.deepEqual(preview.reads,['/native/credentials/google-services.townloop-app.preview.json']);
 const ios=load({EAS_BUILD_PROFILE:'production',EAS_BUILD_PLATFORM:'ios'});ios.plugin({ios:{}});assert.deepEqual(ios.reads,[]);
});

test('renamed Android builds are blocked until the new app registration and OAuth are verified',()=>{
 const {plugin,reads}=load({EAS_BUILD_PLATFORM:'android',EAS_BUILD_PROFILE:'preview'},false);
 assert.throws(()=>plugin({android:{package:'com.townloop.app'}}),/registration.*pending/);assert.deepEqual(reads,[]);
});

test('Production refuses the known Android Debug Preview fingerprint as its release certificate',()=>{
 const {plugin}=load({EAS_BUILD_PLATFORM:'android',EAS_BUILD_PROFILE:'production',GOOGLE_SERVICES_JSON:'/eas/production.json'},true,{previewCertificateSHA1:'a'.repeat(40),productionCertificateSHA1:'a'.repeat(40)});
 assert.throws(()=>plugin({android:{package:'com.townloop.app'}}),/cannot use.*Android Debug/);
});
