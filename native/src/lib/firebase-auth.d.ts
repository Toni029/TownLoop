import 'firebase/auth';
import type { Persistence } from 'firebase/auth';
import type AsyncStorage from '@react-native-async-storage/async-storage';
// Firebase 12 exposes this at runtime in its RN entry, but its first `types`
// export selects the web declaration before the react-native condition.
declare module 'firebase/auth' {
    export function getReactNativePersistence(storage: typeof AsyncStorage): Persistence;
}
