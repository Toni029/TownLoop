import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, AppState, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useVideoPlayer, VideoView } from 'expo-video';
import Animated, { FadeOut } from 'react-native-reanimated';

const cream = '#f3ebdc';
const sourceWidth = 1280;
const sourceHeight = 720;
// Preserve launch state across authentication and navigation remounts.
let launchFinished = false;
let launchPlaybackFinished = false;
let launchPlaybackClaimed = false;
void SplashScreen.preventAutoHideAsync().catch(() => undefined);
const hideSplash = () => {
  try { void SplashScreen.hideAsync().catch(() => undefined); } catch { /* Splash failure must not crash navigation. */ }
};

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
  // Configure before loading any source; muting after construction is too late
  // to control all native playback initialization.
  const player = useVideoPlayer(null, video => {
    video.muted = true;
    video.volume = 0;
    video.audioMixingMode = 'mixWithOthers';
    video.showNowPlayingNotification = false;
    video.staysActiveInBackground = false;
    video.loop = false;
  }, Platform.OS === 'android' ? { disableAudioSession: true } : undefined);
  useEffect(() => {
    let active = true;
    const stop = (playedToEnd = false) => {
      if (!active) return;
      active = false;
      try { player.pause(); } catch { /* The native player may already be unavailable. */ }
      onComplete(playedToEnd);
    };
    // Covers an unresolved prepare promise or a decoder that never emits a frame/end.
    const watchdog = setTimeout(stop, 4500);
    const state = AppState.addEventListener('change', next => {
      if (next !== 'active') stop();
    });
    const ended = player.addListener('playToEnd', () => stop(true));
    const status = player.addListener('statusChange', event => {
      if (event.status === 'error') stop();
    });
    if (AppState.currentState !== 'background') {
      void player.replaceAsync(require('../../assets/startup/startup.mp4')).then(() => {
        if (active && AppState.currentState === 'active') player.play();
        else stop();
      }).catch(() => stop());
    } else stop();
    return () => {
      active = false;
      clearTimeout(watchdog);
      state.remove();
      for (const listener of [ended, status]) {
        try { listener.remove(); } catch { /* Expo may have released the SharedObject first. */ }
      }
      // useVideoPlayer owns release. Its cleanup runs first; never call pause here.
    };
  }, [player, onComplete]);
  return <>
    <VideoView player={player} style={[styles.media, { opacity: frameReady ? 1 : 0 }]} contentFit="contain" surfaceType="textureView" nativeControls={false}
      allowsPictureInPicture={false} fullscreenOptions={{ enable: false }} useExoShutter={false}
      onFirstFrameRender={() => setFrameReady(true)} />
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
  const { width, height, scale } = useWindowDimensions();
  // Preserve the complete landscape composition, with no upscaling beyond source pixels.
  const mediaWidth = Math.min(width, height * sourceWidth / sourceHeight, sourceWidth / Math.max(1, scale));
  const finishPlayback = useCallback((playedToEnd = false) => {
    launchPlaybackFinished = true;
    setPlaybackFinished(true);
    // Hold the final frame only when exiting directly into ready navigation.
    setPlayVideo(playedToEnd && readyRef.current);
  }, []);
  useEffect(() => {
    try { SplashScreen.setOptions({ fade: false, duration: 0 }); } catch { /* Optional native fade. */ }
    const timeout = setTimeout(hideSplash, 1200);
    return () => clearTimeout(timeout);
  }, []);
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
    hideSplash();
  }, [ready, playbackFinished]);
  return <View style={styles.page} onLayout={hideSplash}>
    {ready && <View style={{ flex: 1 }}>{children}</View>}
    {(!finished || !ready) && <Animated.View exiting={reduced === false ? FadeOut.duration(200) : undefined}
      style={styles.overlay} accessibilityLabel="Starting TownLoop" accessibilityRole="progressbar">
      <View style={{ width: mediaWidth, aspectRatio: sourceWidth / sourceHeight }}>
        {playVideo && (!playbackFinished || ready) && reduced === false &&
          <StartupAnimationBoundary onFailure={finishPlayback}><LaunchVideo onComplete={finishPlayback} /></StartupAnimationBoundary>}
      </View>
    </Animated.View>}
  </View>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: cream },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: cream, alignItems: 'center', justifyContent: 'center' },
  media: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
});
