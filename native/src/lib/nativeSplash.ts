import * as SplashScreen from 'expo-splash-screen';

// Release after startup content commits, or initialized navigation/error layout.
// Android holds pre-draw while this splash is visible: never wait for a video
// first-frame or image-load callback before hiding it.
try { void SplashScreen.preventAutoHideAsync().catch(() => undefined); } catch {}

export async function hideNativeSplash() {
  try { await SplashScreen.hideAsync(); } catch {}
}
