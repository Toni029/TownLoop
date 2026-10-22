import AsyncStorage from '@react-native-async-storage/async-storage';
import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import { createProtectedStorage, type KeyValueStorage } from './chunkedStorage';
import { readHome, storageKey } from '../home/model';

// Loading expo-secure-store itself calls requireNativeModule. Probe first so an OTA
// received by an older binary never loads that module or crashes during startup.
function secretStorage(allowBackgroundAuth = false): KeyValueStorage | null {
  if (Platform.OS === 'web' || !requireOptionalNativeModule('ExpoSecureStore')) return null;
  const secure = require('expo-secure-store') as typeof import('expo-secure-store');
  const options = { keychainAccessible: allowBackgroundAuth ? secure.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY : secure.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
  return {
    getItem: key => secure.getItemAsync(key, options),
    setItem: (key, value) => secure.setItemAsync(key, value, options),
    removeItem: key => secure.deleteItemAsync(key, options),
  };
}
const secrets = secretStorage();
export const hasProtectedStorage = secrets !== null;
export const protectedHomeStorage: KeyValueStorage = secrets
  ? createProtectedStorage(secrets, AsyncStorage, readHome)
  : AsyncStorage;
// Firebase's supported RN Persistence interface requires get/set/remove. Chunking
// avoids treating arbitrarily large token-bearing Firebase JSON as one Keychain item.
const authSecrets = secretStorage(true);
export const authPersistenceStorage = authSecrets ? createProtectedStorage(authSecrets, AsyncStorage) : AsyncStorage;
/** Explicit account deletion only. Ordinary sign out preserves this resident's records. */
export const clearResidentHomeData = (uid: string) => protectedHomeStorage.removeItem(storageKey(uid));
