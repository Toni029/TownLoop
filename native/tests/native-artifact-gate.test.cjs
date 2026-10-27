const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {verifyArtifact}=require('../scripts/verify-native-build.cjs');
test('build artifact gate rejects missing compiled native option instead of trusting JavaScript',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'townloop-artifact-gate-'));
 try{
  for(const [name,text]of [['broken','seekForwardIncrement'],['fixed','disableAudioSession']]){const dir=path.join(root,name);fs.mkdirSync(dir);fs.writeFileSync(path.join(dir,'classes.dex'),text);execFileSync('zip',['-q',path.join(root,name+'.apk'),'classes.dex'],{cwd:dir});}
  assert.throws(()=>verifyArtifact(path.join(root,'broken.apk')),/compiled startup/);verifyArtifact(path.join(root,'fixed.apk'));
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('patched video module is explicitly compiled from source, without disabling other prebuilt modules',()=>{
 const config=require('../package.json').expo.autolinking;
 assert.deepEqual(config.android.buildFromSource,['expo-video']);
});
