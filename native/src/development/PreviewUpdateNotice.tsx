import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, BackHandler, Keyboard, Platform, ScrollView, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, CircleAlert, Download, RefreshCw } from 'lucide-react-native';
import { MotionPressable as Pressable } from '../motion/Pressable';
import { useReducedMotion } from '../home/hooks';
import { updateStatus } from './updateStatus';

export function PreviewUpdateNotice({ dark = false }: { dark?: boolean }) {
  if (__DEV__ || Platform.OS === 'web' || !Updates.isEnabled) return null;
  return <UpdateStatus dark={dark} />;
}

function DownloadProgress({ percent, dark }: { percent: number | null; dark: boolean }) {
  const reduced = useReducedMotion();
  const value = useRef(new Animated.Value(0)).current;
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (percent === null) {
      value.setValue(0);
      if (reduced) return;
      const motion = Animated.loop(Animated.timing(value, { toValue: 1, duration: 1300, useNativeDriver: true }));
      motion.start();
      return () => motion.stop();
    }
    const motion = Animated.timing(value, { toValue: percent / 100, duration: reduced ? 0 : 180, useNativeDriver: true });
    motion.start();
    return () => motion.stop();
  }, [percent, reduced, value]);
  return <View style={{ gap: 10, width: '100%' }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <Text style={{ fontFamily: 'JakartaSemi', color: dark ? '#cbd5e1' : '#475569', fontSize: 12 }}>Downloading update</Text>
      {percent !== null ? <Text style={{ fontFamily: 'JakartaBold', color: dark ? '#6ee7b7' : '#047857', fontSize: 12 }}>{percent}%</Text> : <ActivityIndicator size="small" color={dark ? '#6ee7b7' : '#047857'} />}
    </View>
    <View accessibilityRole="progressbar" accessibilityLabel="Update download progress"
      accessibilityValue={percent === null ? { text: 'Download in progress' } : { min: 0, max: 100, now: percent }}
      onLayout={event => setWidth(event.nativeEvent.layout.width)}
      style={{ height: 8, borderRadius: 99, backgroundColor: dark ? '#334155' : '#e2e8df', overflow: 'hidden' }}>
      <Animated.View style={{ height: '100%', borderRadius: 99, backgroundColor: '#059669', width: percent === null ? '33%' : '100%', transformOrigin: 'left center',
        transform: percent === null ? [{ translateX: reduced ? width / 3 : value.interpolate({ inputRange: [0, 1], outputRange: [-width / 3, width] }) }] : [{ scaleX: value }] }} />
    </View>
  </View>;
}

function UpdateStatus({ dark }: { dark: boolean }) {
  // Expo hydrates this hook from native state, including downloads started before React.
  const updates = Updates.useUpdates();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const operation = useRef(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const [acknowledge, setAcknowledge] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [dismissed, setDismissed] = useState(false);
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
  const nativeStatus = updateStatus(updates);
  const state = error && nativeStatus?.kind !== 'ready' ? { kind: 'error', label: error, progress: null }
    : nativeStatus || (busy ? { kind: 'checking', label: 'Checking for updates…', progress: null }
      : acknowledge ? { kind: 'applied', label: 'TownLoop is up to date', progress: null } : null);
  // Routine automatic checks stay invisible. Later defers the entire flow for this session.
  const visible = !!state && !dismissed && !keyboard && !(state.kind === 'checking' && !busy);
  useEffect(() => {
    if (!visible) return;
    opacity.setValue(reduced ? 1 : 0);
    const motion = Animated.timing(opacity, { toValue: 1, duration: reduced ? 0 : 180, useNativeDriver: true });
    motion.start();
    return () => motion.stop();
  }, [visible, reduced, opacity]);
  useEffect(() => {
    if (!visible) return;
    const back = BackHandler.addEventListener('hardwareBackPress', () => { dismiss(); return true; });
    return () => back.remove();
  }, [visible, restarting, updates.isRestarting, state?.kind, key]);
  if (!visible || !state) return null;
  const ready = state.kind === 'ready', applied = state.kind === 'applied';
  const working = busy || updates.isDownloading || updates.isRestarting || restarting;
  const ink = dark ? '#f1f5f9' : '#0f172a';
  const muted = dark ? '#cbd5e1' : '#64748b';
  const title = restarting ? 'Opening the update' : ready ? 'Your update is ready' : applied ? 'You’re up to date' : state.kind === 'error' ? 'Let’s try that again' : working ? 'Updating TownLoop' : 'A fresh update is here';
  const description = ready ? 'Save any unfinished work, then restart TownLoop to apply the update.'
    : applied ? 'The latest TownLoop update has been applied.'
    : state.kind === 'error' ? error || state.label
    : 'We’re preparing the latest improvements. You can keep using TownLoop while the update downloads.';
  const Icon = state.kind === 'error' ? CircleAlert : restarting ? RefreshCw : ready || applied ? Check : Download;
  async function retry() {
    if (operation.current || updates.isDownloading || updates.isRestarting) return;
    operation.current = true; setBusy(true); setError('');
    try {
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) await Updates.fetchUpdateAsync();
    } catch { setError('Unable to download the update. Check your connection and try again.'); }
    finally { operation.current = false; setBusy(false); }
  }
  async function restart() {
    if (operation.current || !updates.isUpdatePending || updates.isRestarting) return;
    operation.current = true; setRestarting(true); setError('');
    try { await Updates.reloadAsync(); }
    catch {
      operation.current = false; setRestarting(false);
      setError('Unable to restart. You can close and reopen TownLoop when you are ready.');
    }
  }
  function dismiss() {
    if (restarting || updates.isRestarting) return;
    setDismissed(true);
    if (applied) {
      setAcknowledge(false);
      void AsyncStorage.setItem(key, '1').catch(() => {});
    }
  }
  // Stay in the app view tree: the existing startup overlay and native editor
  // modals retain priority. A separate native Modal would cover the startup movie.
  return <Animated.View accessibilityLabel="TownLoop update" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 100, opacity, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24, backgroundColor: '#0f172a66' }}>
      <View accessibilityViewIsModal style={{ width: '100%', maxWidth: 392, maxHeight: '100%', borderRadius: 28, backgroundColor: dark ? '#0f172a' : '#fffcf5', borderWidth: 1, borderColor: dark ? '#334155' : '#e7e1d5', boxShadow: '0px 16px 48px rgba(15,23,42,0.18)', overflow: 'hidden' }}>
        <ScrollView bounces={false} style={{ flexGrow: 0 }} contentContainerStyle={{ padding: 24, alignItems: 'center', gap: 18 }}>
          <View style={{ width: 60, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: dark ? '#064e3b' : '#e4f2e8' }}>
            <Icon size={28} color={dark ? '#6ee7b7' : '#047857'} strokeWidth={2} />
          </View>
          <View style={{ gap: 10, width: '100%' }}>
            <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={{ fontFamily: 'JakartaBold', fontSize: 23, lineHeight: 30, textAlign: 'center', color: ink }}>{title}</Text>
            <Text style={{ fontFamily: 'Jakarta', fontSize: 14, lineHeight: 22, textAlign: 'center', color: muted }}>{description}</Text>
            {ready && !!error && <Text accessibilityRole="alert" style={{ fontFamily: 'Jakarta', fontSize: 13, lineHeight: 20, textAlign: 'center', color: dark ? '#fda4af' : '#be123c' }}>{error}</Text>}
          </View>
          {state.kind === 'downloading' && <DownloadProgress percent={state.progress} dark={dark} />}
          <View style={{ width: '100%', gap: 4 }}>
            <Pressable accessibilityRole="button" accessibilityLabel={ready ? 'Restart to apply update' : applied ? 'Continue to TownLoop' : 'Download update'}
              accessibilityState={{ disabled: working, busy: working }} disabled={working}
              onPress={ready ? () => void restart() : applied ? dismiss : () => void retry()}
              style={{ width: '100%', minHeight: 52, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 17, backgroundColor: '#047857', opacity: working ? 0.65 : 1, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' }}>
              {working ? <ActivityIndicator size="small" color="#fff" /> : ready ? <RefreshCw size={18} color="#fff" /> : !applied ? <Download size={18} color="#fff" /> : null}
              <Text style={{ fontFamily: 'JakartaBold', fontSize: 15, lineHeight: 22, color: '#fff', textAlign: 'center', flexShrink: 1 }}>{restarting ? 'Restarting…' : ready ? 'Restart to apply' : applied ? 'Continue' : working ? 'Preparing update…' : state.kind === 'error' ? 'Try again' : 'Download update'}</Text>
            </Pressable>
            {!applied && <Pressable accessibilityRole="button" accessibilityLabel="Update later" disabled={restarting || updates.isRestarting} onPress={dismiss} style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center', paddingVertical: 10 }}>
              <Text style={{ fontFamily: 'JakartaSemi', fontSize: 13, color: muted }}>Later</Text>
            </Pressable>}
          </View>
        </ScrollView>
      </View>
  </Animated.View>;
}
