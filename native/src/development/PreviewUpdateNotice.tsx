import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, Text, View, Keyboard } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { updateStatus } from './updateStatus';

export function PreviewUpdateNotice({ dark = false }: { dark?: boolean }) {
  if (__DEV__ || Platform.OS === 'web' || !Updates.isEnabled) return null;
  return <UpdateStatus dark={dark} />;
}
function UpdateStatus({ dark }: { dark: boolean }) {
  // Expo hydrates this hook from its native state, including pre-React downloads.
  const updates = Updates.useUpdates();
  const insets = useSafeAreaInsets();
  const [acknowledge, setAcknowledge] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState('');
  const [keyboard, setKeyboard] = useState(false);
  const key = `townloop:preview-update-seen:${Updates.updateId}`;
  useEffect(() => {
    let active = true;
    if (!Updates.isEmbeddedLaunch && Updates.updateId)
      void AsyncStorage.getItem(key).then(seen => { if (active) setAcknowledge(!seen); }).catch(() => {});
    return () => { active = false; };
  }, [key]);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboard(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboard(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  const state = error ? { kind: 'error', label: error, progress: null }
    : updateStatus(updates) || (acknowledge ? { kind: 'applied', label: 'TownLoop is up to date', progress: null } : null);
  const identity = `${state?.kind}:${updates.downloadedUpdate?.updateId || updates.availableUpdate?.updateId || ''}`;
  if (!state || hidden === identity || keyboard) return null;
  const ink = dark ? '#f1f5f9' : '#0f172a';
  async function retry() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) await Updates.fetchUpdateAsync();
    } catch { setError('Unable to download the update. Check your connection and retry.'); }
    finally { setBusy(false); }
  }
  function restart() {
    Alert.alert('Restart TownLoop?', 'Finish any unsaved work first. TownLoop will restart to apply the update.', [
      { text: 'Not now', style: 'cancel' },
      { text: 'Restart', onPress: () => { void Updates.reloadAsync().catch(() => setError('Unable to restart. Close and reopen TownLoop when you are ready.')); } },
    ]);
  }
  function dismiss() {
    setHidden(identity);
    if (state?.kind === 'applied') {
      setAcknowledge(false);
      void AsyncStorage.setItem(key, '1').catch(() => {});
    }
  }
  return <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + 8, left: 16, right: 16, zIndex: 100, alignItems: 'center' }}>
    <View style={{ width: '100%', maxWidth: 416, padding: 12, gap: 8, borderRadius: 18, backgroundColor: dark ? '#0f172af5' : '#fffcf5f5', borderWidth: 1, borderColor: dark ? '#334155' : '#ddd6c8', boxShadow: '0px 4px 16px rgba(0,0,0,0.12)' }}>
      <Text accessibilityLiveRegion="polite" style={{ color: ink, fontFamily: 'JakartaSemi', fontSize: 13 }}>{state.label}</Text>
      {state.progress !== null && <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: state.progress }} style={{ height: 3, borderRadius: 3, backgroundColor: dark ? '#334155' : '#e7e5e4', overflow: 'hidden' }}><View style={{ height: 3, width: `${state.progress}%`, backgroundColor: '#059669' }} /></View>}
      <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
        {state.kind === 'ready' && <Pressable accessibilityRole="button" disabled={updates.isRestarting} onPress={restart} style={{ paddingVertical: 8 }}><Text style={{ fontFamily: 'JakartaBold', color: dark ? '#6ee7b7' : '#047857' }}>Restart to apply</Text></Pressable>}
        {(state.kind === 'error' || state.kind === 'available') && <Pressable accessibilityRole="button" disabled={busy} onPress={() => void retry()} style={{ paddingVertical: 8 }}><Text style={{ color: ink, fontFamily: 'JakartaBold' }}>{busy ? 'Please wait…' : state.kind === 'error' ? 'Retry' : 'Download'}</Text></Pressable>}
        <Pressable accessibilityRole="button" onPress={dismiss} style={{ paddingVertical: 8 }}><Text style={{ color: ink, fontFamily: 'Jakarta' }}>{state.kind === 'applied' ? 'Got it' : 'Later'}</Text></Pressable>
      </View>
    </View>
  </View>;
}
