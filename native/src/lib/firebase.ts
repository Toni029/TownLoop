import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import config from '../../firebase-config.json';
// Same public Firebase client configuration as the web app; never add server keys here.
export const app = getApps().length ? getApp() : initializeApp(config);
export const auth = (() => {
    try {
        return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
    }
    catch (error) {
        if ((error as {
            code?: string;
        }).code === 'auth/already-initialized')
            return getAuth(app);
        throw error;
    }
})();
export const db = getFirestore(app, config.firestoreDatabaseId || '(default)');
export const storage = getStorage(app);
