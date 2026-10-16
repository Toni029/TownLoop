import AsyncStorage from '@react-native-async-storage/async-storage';
import { signOut } from 'firebase/auth';
import * as Notifications from 'expo-notifications';
import { auth } from '../lib/firebase';
import { registerDevice, beginPushSignOut, endPushSignOut } from './registration';
export async function signOutSafely() {
  await beginPushSignOut();
  try {
    const token = await AsyncStorage.getItem('townloop.pushToken');
    // Revoke after registration. Fail visibly if offline instead of leaving
    // this installation subscribed to the previous account's conversations.
    if (token && auth.currentUser) await registerDevice({ token, remove: true });
    await AsyncStorage.removeItem('townloop.pushToken');
    await Notifications.dismissAllNotificationsAsync();
    Notifications.clearLastNotificationResponse();
    await signOut(auth);
  } finally { endPushSignOut(); }
}
