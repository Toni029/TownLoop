import { useRouter, useRootNavigationState, useSegments } from 'expo-router';
import { useCommunity } from '../lib/community';
import { useCallback, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { useSession } from '../lib/session';
import { auth } from '../lib/firebase';
import { registerDevice } from './registration';
import { PushContext, type InboxTarget } from './context';
export { useInboxPush } from './context';
// Foreground already has Inbox unread badges; avoid a duplicate banner/sound.
Notifications.setNotificationHandler({ handleNotification: async () => ({
  shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false,
}) });
export function InboxPushProvider({ children }: PropsWithChildren) {
  const { user, profile } = useSession();
  const router = useRouter();
  const navigation = useRootNavigationState();
  const segments = useSegments();
  const { community, ready } = useCommunity();
  const uid = user?.uid;
  const approved = !!profile && profile.approved !== false;
  const [target, setTarget] = useState<InboxTarget | null>(null);
  const [status, setStatus] = useState('');
  const working = useRef(false);
  const receive = useCallback((response: Notifications.NotificationResponse | null) => {
    if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const data = response.notification.request.content.data;
    if (!data || data.type !== 'inbox' || !['friend', 'office', 'maintenance'].includes(String(data.category)) || typeof data.conversationId !== 'string' || typeof data.recipientId !== 'string') return;
    setTarget({ category: data.category as InboxTarget['category'], id: data.conversationId, recipientId: data.recipientId, requestId: response.notification.request.identifier });
  }, []);
  useEffect(() => {
    // Synchronize the OS cold-start response with the React navigation state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    receive(Notifications.getLastNotificationResponse());
    const listener = Notifications.addNotificationResponseReceivedListener(receive);
    return () => listener.remove();
  }, [receive]);
  useEffect(() => {
    if (target && target.recipientId === uid && approved && ready && community && navigation?.key && segments[0] !== '(tabs)') router.replace('/');
  }, [target, uid, approved, ready, community, navigation?.key, segments, router]);
  const consume = useCallback(() => { setTarget(null); Notifications.clearLastNotificationResponse(); }, []);
  const enable = useCallback(async (ask = true, devicePushToken?: Notifications.DevicePushToken) => {
    if (!uid || !approved || working.current) return;
    working.current = true;
    try {
      if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('inbox', {
        name: 'Inbox messages', importance: Notifications.AndroidImportance.DEFAULT,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
      });
      let permission = await Notifications.getPermissionsAsync();
      if (!permission.granted && permission.canAskAgain && ask) permission = await Notifications.requestPermissionsAsync();
      if (!permission.granted) { setStatus('Phone notifications are off. Enable TownLoop notifications in phone Settings.'); return; }
      const projectId = Constants.easConfig?.projectId || Constants.expoConfig?.extra?.eas?.projectId;
      if (!projectId) throw Error('Missing Expo project configuration.');
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const token = await Promise.race([
        Notifications.getExpoPushTokenAsync({ projectId, devicePushToken }).then(result => result.data),
        new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(Error('Push registration timed out.')), 15000); }),
      ]).finally(() => clearTimeout(timeout));
      if (auth.currentUser?.uid !== uid) return;
      // Store before registration so logout can revoke even if the response is lost.
      const previousToken = await AsyncStorage.getItem('townloop.pushToken');
      await AsyncStorage.setItem('townloop.pushToken', token);
      await registerDevice({ token, previousToken, platform: Platform.OS });
      setStatus('Phone notifications are enabled.');
    } catch { setStatus('Phone notifications could not connect. Tap to retry.'); }
    finally { working.current = false; }
  }, [uid, approved]);
  useEffect(() => {
    if (!uid || !approved) return;
    // Registration synchronizes this Firebase session with the native push service.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void enable();
    const state = AppState.addEventListener('change', s => { if (s === 'active') void enable(false); });
    const tokens = Notifications.addPushTokenListener(token => { void enable(false, token); });
    return () => { state.remove(); tokens.remove(); };
  }, [uid, approved, enable]);
  return <PushContext.Provider value={{ target, consume, status, enable: () => enable(true) }}>{children}</PushContext.Provider>;
}
