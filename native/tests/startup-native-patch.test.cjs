const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {applyStartupPatch} = require('../scripts/patch-startup-video.cjs');
const changes = require('../patches/startup-video.json');
test('pinned native opt-out is deterministic, startup-only, nullable-safe and fails on drift',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'townloop-video-patch-'));
 try {
  fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({version:'57.0.5'}));
  const files=[...new Set(changes.map(c=>c.file))];
  const installed=path.dirname(require.resolve('expo-video/package.json'));
  for(const file of files){
   let source=fs.readFileSync(path.join(installed,file),'utf8');
   for(const c of [...changes].reverse().filter(c=>c.file===file)) source=source.replace(c.after,c.before);
   fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});fs.writeFileSync(path.join(root,file),source);
  }
  applyStartupPatch(root);
  const first=files.map(file=>fs.readFileSync(path.join(root,file),'utf8'));
  applyStartupPatch(root);
  assert.deepEqual(files.map(file=>fs.readFileSync(path.join(root,file),'utf8')),first);
  const player=first[files.indexOf('android/src/main/java/expo/modules/video/player/VideoPlayer.kt')];
  assert.ok(player.includes('if (disableAudioSession) null else buildBasicMediaSession(context, player)'));
  assert.ok(player.includes('.setTrackTypeDisabled(C.TRACK_TYPE_AUDIO, true)'));
  assert.ok(player.includes('mediaSession?.release()'));
  assert.ok(first.some(source=>source.includes('if (!videoPlayer.disableAudioSession) audioFocusManager.registerPlayer(videoPlayer)')));
  assert.ok(first.some(source=>source.includes('if (videoPlayer.disableAudioSession) return')));
  assert.ok(first.some(source=>source.includes('disableAudioSession: Boolean = false')));
  fs.writeFileSync(path.join(root,changes[0].file),'upstream drift');
  assert.throws(()=>applyStartupPatch(root),/source drift/);
 } finally {fs.rmSync(root,{recursive:true,force:true});}
});
