// Build-time gate only. Never invoked by app startup or OTA publication.
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {applyStartupPatch}=require('./patch-startup-video.cjs');
function prepare() {
  applyStartupPatch();
  const root=path.dirname(require.resolve('expo-video/package.json'));
  for(const change of require('../patches/startup-video.json'))if(!fs.readFileSync(path.join(root,change.file),'utf8').includes(change.after))throw Error('Native startup opt-out missing before compilation');
}
function verifyArtifact(file) {
  const entries=execFileSync('unzip',['-Z1',file],{encoding:'utf8'}).split('\n').filter(n=>/^(?:base\/dex\/)?classes\d*\.dex$/.test(n));
  if(!entries.length)throw Error('Android artifact has no DEX code');
  const compiled=entries.some(n=>execFileSync('unzip',['-p',file,n],{maxBuffer:128*1024*1024}).includes(Buffer.from('disableAudioSession')));
  if(!compiled)throw Error('STOP: compiled startup audio-session opt-out missing; do not distribute this binary');
}
function verifyOutputs(root=path.resolve(__dirname,'../android/app/build/outputs')) {
  const walk=dir=>fs.existsSync(dir)?fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]):[];
  const artifacts=walk(root).filter(p=>/\.(apk|aab)$/.test(p));
  if(!artifacts.length)throw Error('No compiled Android artifact found for verification');
  for(const artifact of artifacts)verifyArtifact(artifact);
}
module.exports={prepare,verifyArtifact,verifyOutputs};
if(require.main===module){if(process.argv[2]==='prepare')prepare();else if(process.argv[2]==='artifact')verifyArtifact(process.argv[3]);else if(process.env.EAS_BUILD_PLATFORM==='android')verifyOutputs();}
