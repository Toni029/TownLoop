import { Component, useCallback, useEffect, useState, type ReactNode } from 'react';
import { AppState, Platform, Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useVideoPlayer, VideoView } from 'expo-video';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeOut } from 'react-native-reanimated';
import { useReducedMotion } from '../home/hooks';

const cream = '#f3eddf';
const sourceWidth = 1280;
const sourceHeight = 720;
// Preserve launch state across authentication and navigation remounts.
let launchFinished = false;
let launchPlaybackFinished = false;
void SplashScreen.preventAutoHideAsync().catch(() => undefined);
const hideSplash = () => {
  try { void SplashScreen.hideAsync().catch(() => undefined); } catch { /* Splash failure must not crash navigation. */ }
};

// Optional startup decoration must never replace the app with its global error UI.
class StartupAnimationBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? null : this.props.children; }
}

function LaunchVideo({ onComplete }: { onComplete: () => void }) {
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
    const stop = () => {
      if (!active) return;
      active = false;
      try { player.pause(); } catch { /* The native player may already be unavailable. */ }
      onComplete();
    };
    // Covers an unresolved prepare promise or a decoder that never emits a frame/end.
    const watchdog = setTimeout(stop, 4500);
    const state = AppState.addEventListener('change', next => {
      if (next !== 'active') stop();
    });
    const ended = player.addListener('playToEnd', stop);
    const status = player.addListener('statusChange', event => {
      if (event.status === 'error') stop();
    });
    if (AppState.currentState !== 'background') {
      void player.replaceAsync(require('../../assets/startup/startup.mp4')).then(() => {
        if (active && AppState.currentState === 'active') player.play();
        else stop();
      }).catch(stop);
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
    <VideoView player={player} style={styles.media} contentFit="contain" surfaceType="textureView" nativeControls={false}
      allowsPictureInPicture={false} fullscreenOptions={{ enable: false }} useExoShutter={false}
      onFirstFrameRender={() => setFrameReady(true)} />
    {!frameReady && <Image source={require('../../assets/startup/first-frame.png')} style={styles.media} resizeMode="contain" fadeDuration={0} />}
  </>;
}

/** Initialization runs concurrently; playback never imposes a minimum wait. */
export function StartupLoading({ ready, children }: { ready: boolean; children: ReactNode }) {
  const reduced = useReducedMotion();
  const [finished, setFinished] = useState(launchFinished);
  const [playbackFinished, setPlaybackFinished] = useState(launchPlaybackFinished);
  const { width, height, scale } = useWindowDimensions();
  // Preserve the complete landscape composition, with no upscaling beyond source pixels.
  const mediaWidth = Math.min(width, height * sourceWidth / sourceHeight, sourceWidth / Math.max(1, scale));
  const finishPlayback = useCallback(() => {
    launchPlaybackFinished = true;
    setPlaybackFinished(true);
  }, []);
  useEffect(() => {
    try { SplashScreen.setOptions({ fade: !reduced, duration: reduced ? 0 : 180 }); } catch { /* Optional native fade. */ }
  }, [reduced]);
  useEffect(() => {
    const timeout = setTimeout(hideSplash, 1200);
    return () => clearTimeout(timeout);
  }, []);
  useEffect(() => {
    if (!ready) return;
    // Do not depend solely on an onLayout callback to remove startup decoration.
    launchFinished = true;
    setFinished(true);
    finishPlayback();
    hideSplash();
  }, [ready, finishPlayback]);
  return <View style={styles.page}>
    {ready && <View style={{ flex: 1 }} onLayout={() => {
      launchFinished = true;
      setFinished(true);
      finishPlayback();
      hideSplash();
    }}>{children}</View>}
    {(!finished || !ready) && <Animated.View exiting={reduced ? undefined : FadeOut.duration(200)}
      style={styles.overlay} accessibilityLabel="Starting TownLoop" accessibilityRole="progressbar">
      <View style={{ width: mediaWidth, aspectRatio: sourceWidth / sourceHeight }}>
        <Image source={!reduced && !finished && !playbackFinished ? require('../../assets/startup/first-frame.png') : require('../../assets/startup/poster.png')} style={styles.media} resizeMode="contain" fadeDuration={0} onLoad={hideSplash} />
        {!reduced && !finished && !playbackFinished && <StartupAnimationBoundary onFailure={finishPlayback}><LaunchVideo onComplete={finishPlayback} /></StartupAnimationBoundary>}
        {/* Feather only the empty cream perimeter; logo and animation remain intact. */}
        <LinearGradient pointerEvents="none" colors={[cream, '#f3eddf00']} style={styles.topEdge} />
        <LinearGradient pointerEvents="none" colors={['#f3eddf00', cream]} style={styles.bottomEdge} />
        <LinearGradient pointerEvents="none" colors={[cream, '#f3eddf00']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.leftEdge} />
        <LinearGradient pointerEvents="none" colors={['#f3eddf00', cream]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.rightEdge} />
      </View>
    </Animated.View>}
  </View>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: cream },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: cream, alignItems: 'center', justifyContent: 'center' },
  media: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  topEdge: { position: 'absolute', top: 0, left: 0, right: 0, height: 16 },
  bottomEdge: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 16 },
  leftEdge: { position: 'absolute', top: 0, left: 0, bottom: 0, width: 16 },
  rightEdge: { position: 'absolute', top: 0, right: 0, bottom: 0, width: 16 },
});
