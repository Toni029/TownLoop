import 'firebase/auth';
import type { Persistence } from 'firebase/auth';
import type { KeyValueStorage } from '../localData/chunkedStorage';
// Firebase 12 exposes this at runtime in its RN entry, but its first `types`
// export selects the web declaration before the react-native condition.
declare module 'firebase/auth' {
    export function getReactNativePersistence(storage: KeyValueStorage): Persistence;
}
