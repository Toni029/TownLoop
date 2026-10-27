import * as SplashScreen from 'expo-splash-screen';

// Keep the OS launch screen only until initialized navigation (or its error UI)
// has laid out. No playback, animation, or artificial delay is involved.
try { void SplashScreen.preventAutoHideAsync().catch(() => undefined); } catch {}

export function hideNativeSplash() {
  try { void SplashScreen.hideAsync().catch(() => undefined); } catch {}
}
