import { useEffect, useState, type ReactNode } from 'react';
import { AppState, Image, StyleSheet, View } from 'react-native';
import { SplashScreen } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import Animated, { FadeOut } from 'react-native-reanimated';
import { useReducedMotion } from '../home/hooks';

const cream = '#f4eee0';
// Preserve launch state across auth changes and navigation remounts.
let launchFinished = false;
void SplashScreen.preventAutoHideAsync().catch(() => undefined);
const hideSplash = () => { void SplashScreen.hideAsync().catch(() => undefined); };

function LaunchVideo() {
  const [frameReady, setFrameReady] = useState(false);
  const player = useVideoPlayer(require('../../assets/startup/startup.mp4'), video => {
    video.muted = true;
    video.loop = false;
    video.play();
  });
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') player.pause();
      else if (player.currentTime < player.duration) player.play();
    });
    return () => subscription.remove();
  }, [player]);
  return <>
    <VideoView player={player} style={styles.media} contentFit="contain" surfaceType="textureView" nativeControls={false}
      onFirstFrameRender={() => setFrameReady(true)} />
    {!frameReady && <Image source={require('../../assets/startup/first-frame.png')} style={styles.media} resizeMode="contain" />}
  </>;
}

/** Initialization runs concurrently; playback never imposes a minimum wait. */
export function StartupLoading({ ready, children }: { ready: boolean; children: ReactNode }) {
  const reduced = useReducedMotion();
  const [finished, setFinished] = useState(launchFinished);
  useEffect(() => {
    // Defensive fallback if a platform never reports the poster layout/load.
    const timeout = setTimeout(hideSplash, 1200);
    return () => clearTimeout(timeout);
  }, []);
  return <View style={styles.page}>
    {ready && <View style={{ flex: 1 }} onLayout={() => {
      launchFinished = true;
      setFinished(true);
      hideSplash();
    }}>{children}</View>}
    {(!finished || !ready) && <Animated.View exiting={reduced ? undefined : FadeOut.duration(180)}
      style={styles.overlay} accessibilityLabel="Starting TownLoop" accessibilityRole="progressbar">
      <Image source={require('../../assets/startup/poster.png')} style={styles.media} resizeMode="contain" onLoad={hideSplash} />
      {!reduced && !finished && <LaunchVideo />}
    </Animated.View>}
  </View>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: cream },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: cream, alignItems: 'center', justifyContent: 'center' },
  media: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
});
