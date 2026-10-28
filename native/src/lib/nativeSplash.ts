import * as SplashScreen from 'expo-splash-screen';

// Keep the OS launch screen only until initialized navigation (or its error UI)
// has laid out, or until the approved startup first frame is visible.
try { void SplashScreen.preventAutoHideAsync().catch(() => undefined); } catch {}

export async function hideNativeSplash() {
  try { await SplashScreen.hideAsync(); } catch {}
}
