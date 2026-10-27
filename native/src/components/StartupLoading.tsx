import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, AppState, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { createVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';

const cream = '#f3ebdc';
const sourceWidth = 1080;
const sourceHeight = 1920;
// Preserve launch state across authentication and navigation remounts.
let launchFinished = false;
let launchPlaybackFinished = false;
let launchPlaybackClaimed = false;
// Fabric can apply queued view props after React effects unmount. Keep this one
// startup object valid for the process; unload its source, not its shared-object ID.
let startupPlayer: VideoPlayer | undefined;
function getStartupPlayer() {
  if (startupPlayer) return startupPlayer;
  const video = createVideoPlayer(null, Platform.OS === 'android' ? { disableAudioSession: true } : undefined);
  try {
    video.muted = true;
    video.volume = 0;
    video.audioMixingMode = 'mixWithOthers';
    video.showNowPlayingNotification = false;
    video.staysActiveInBackground = false;
    video.loop = false;
    if (Platform.OS === 'ios') video.allowsExternalPlayback = false;
  } catch (error) {
    // No view has received this failed construction, so releasing here is safe.
    try { video.release(); } catch {}
    throw error;
  }
  startupPlayer = video;
  return video;
}
void SplashScreen.preventAutoHideAsync().catch(() => undefined);
async function hideSplash() {
  try { await SplashScreen.hideAsync(); } catch { /* A missing splash must not block navigation. */ }
}

// Unlike the shared motion hook, distinguish an unknown preference from enabled.
// A failed/slow accessibility lookup skips animation safely, without a logo poster.
function useStartupMotionPreference() {
  const [reduced, setReduced] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true, resolved = false;
    const update = (value: boolean) => {
      if (active) { resolved = true; setReduced(value); }
    };
    const timer = setTimeout(() => { if (!resolved) update(true); }, 1000);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', update);
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (!resolved) update(value);
    }).catch(() => { if (!resolved) update(true); });
    return () => { active = false; clearTimeout(timer); sub.remove(); };
  }, []);
  return reduced;
}

// Optional startup decoration must never replace the app with its global error UI.
class StartupAnimationBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? null : this.props.children; }
}

function LaunchVideo({ onComplete }: { onComplete: (playedToEnd?: boolean) => void }) {
  const [frameReady, setFrameReady] = useState(false);
  const [player] = useState(getStartupPlayer);
  const firstFrame = useRef<() => void>(() => undefined);
  useEffect(() => {
    let active = true;
    let loading: Promise<void> | undefined;
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    let visible = false;
    const unload = () => {
      try {
        player.pause();
        void player.replaceAsync(null).catch(() => undefined);
      } catch { /* Decoder failure must not block navigation or cleanup. */ }
    };
    const stop = (playedToEnd = false) => {
      if (!active) return;
      active = false;
      clearTimeout(watchdog);
      try { player.pause(); } catch { /* The native player may already be unavailable. */ }
      onComplete(playedToEnd);
    };
    // Preparation cannot consume the playback allowance. Give every visible frame
    // its original 3.208-second timeline, with bounded recovery for decoder stalls.
    watchdog = setTimeout(stop, 8000);
    firstFrame.current = () => {
      if (!active || visible) return;
      visible = true;
      setFrameReady(true);
      clearTimeout(watchdog);
      watchdog = setTimeout(stop, 5208);
    };
    const state = AppState.addEventListener('change', next => {
      if (next !== 'active') stop();
    });
    const ended = player.addListener('playToEnd', () => stop(true));
    const status = player.addListener('statusChange', event => {
      if (event.status === 'error') stop();
    });
    if (AppState.currentState !== 'background') {
      try { loading = player.replaceAsync(require('../../assets/startup/startup-portrait.mp4')); }
      catch { stop(); }
      void loading?.then(() => {
        if (active && AppState.currentState === 'active') player.play();
        else stop();
      }).catch(() => stop());
    } else stop();
    return () => {
      active = false;
      clearTimeout(watchdog);
      firstFrame.current = () => undefined;
      state.remove();
      for (const listener of [ended, status]) {
        try { listener.remove(); } catch { /* A native decoder failure must not prevent listener cleanup. */ }
      }
      unload();
      // A slow prepare can finish after unmount; clear that source again if it does.
      void loading?.then(unload, unload);
      // Never invalidate the ID while Fabric may still be attaching/detaching a view.
    };
  }, [player, onComplete]);
  return <>
    <VideoView player={player} style={[styles.media, { opacity: frameReady ? 1 : 0 }]} contentFit="contain" surfaceType="textureView" nativeControls={false}
      allowsPictureInPicture={false} fullscreenOptions={{ enable: false }} useExoShutter={false}
      onFirstFrameRender={() => firstFrame.current()} />
  </>;
}

/** Initialization runs concurrently; only successful cold-launch playback waits for its end. */
export function StartupLoading({ ready, children }: { ready: boolean; children: ReactNode }) {
  const reduced = useStartupMotionPreference();
  const [finished, setFinished] = useState(launchFinished);
  const [playbackFinished, setPlaybackFinished] = useState(launchPlaybackFinished);
  const [playVideo, setPlayVideo] = useState(false);
  const readyRef = useRef(ready);
  readyRef.current = ready;
  const [splashHidden, setSplashHidden] = useState(false);
  const reveal = useCallback(() => { void hideSplash().then(() => setSplashHidden(true)); }, []);
  const { width, height } = useWindowDimensions();
  const mediaWidth = Math.min(width, height * sourceWidth / sourceHeight);
  const finishPlayback = useCallback((playedToEnd = false) => {
    launchPlaybackFinished = true;
    setPlaybackFinished(true);
    // Hold the final frame only when exiting directly into ready navigation.
    setPlayVideo(playedToEnd && readyRef.current);
  }, []);
  useEffect(() => {
    try { SplashScreen.setOptions({ fade: false, duration: 0 }); } catch { /* Optional native fade. */ }
    const timeout = setTimeout(() => { reveal(); setSplashHidden(true); }, 1200);
    reveal();
    return () => clearTimeout(timeout);
  }, [reveal]);
  useEffect(() => {
    if (reduced === null) return;
    if (reduced || launchPlaybackFinished || launchPlaybackClaimed) {
      finishPlayback();
      return;
    }
    // Claim before mounting a player: authentication/remounts cannot create a second one.
    launchPlaybackClaimed = true;
    setPlayVideo(true);
    return () => { launchPlaybackFinished = true; };
  }, [reduced, finishPlayback]);
  useEffect(() => {
    if (!ready || !playbackFinished) return;
    launchFinished = true;
    setFinished(true);
    void hideSplash();
  }, [ready, playbackFinished]);
  return <View style={styles.page} onLayout={reveal}>
    {ready && finished && <View style={{ flex: 1 }}>{children}</View>}
    {(!finished || !ready) && <View testID="startup-overlay" style={styles.overlay} accessibilityLabel="Starting TownLoop" accessibilityRole="progressbar">
      <View style={{ width: mediaWidth, aspectRatio: sourceWidth / sourceHeight }}>
        {splashHidden && playVideo && (!playbackFinished || ready) && reduced === false &&
          <StartupAnimationBoundary onFailure={finishPlayback}><LaunchVideo onComplete={finishPlayback} /></StartupAnimationBoundary>}
      </View>
    </View>}
  </View>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: cream },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: cream, alignItems: 'center', justifyContent: 'center' },
  media: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
});
