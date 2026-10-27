const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {applyStartupPatch} = require('../scripts/patch-startup-video.cjs');
const changes = require('../patches/startup-video.json');
test('pinned native opt-out is deterministic, startup-only, nullable-safe and fails on drift',()=>{
 for(const legacy of [false,true]){
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
  // Exercise upgrades from the exact patch already compiled into Preview too.
  const trackChange=changes.find(c=>c.previous);
  const trackFile=path.join(root,trackChange.file);
  if(legacy)fs.writeFileSync(trackFile,fs.readFileSync(trackFile,'utf8').replace(trackChange.before,trackChange.previous));
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
 }
});

// Regression: the installed Preview constructor throws on mqt_v_js because
// ExoPlayer is bound to the main looper. A marker alone cannot catch this.
test('startup audio-track access is dispatched to the player main queue',()=>{
 const change=changes.find(c=>c.file.endsWith('/VideoPlayer.kt')&&c.after.includes('setTrackTypeDisabled'));
 assert.ok(change);
 const block=change.after;
 const dispatch=block.indexOf('appContext.mainQueue.launch {');
 const access=block.indexOf('player.trackSelectionParameters');
 assert.ok(dispatch>=0&&dispatch<access,'main-queue dispatch must precede every startup track access');
 assert.equal(block.slice(0,dispatch).includes('player.trackSelectionParameters'),false);
 assert.match(block,/mainQueue\.launch \{[\s\S]*if \(disableAudioSession\) \{[\s\S]*setTrackTypeDisabled\(C\.TRACK_TYPE_AUDIO, true\)/);
});
