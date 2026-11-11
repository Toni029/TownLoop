import type { FirebaseApp } from 'firebase/app';
import { CustomProvider, initializeAppCheck, setTokenAutoRefreshEnabled } from 'firebase/app-check';
import { requireOptionalNativeModule } from 'expo';
import { AppState, Platform } from 'react-native';

type NativeToken = { token: string; expireTimeMillis: number };
type NativeAppCheck = {
    initialize(): void;
    getToken(forceRefresh: boolean): Promise<NativeToken>;
};

let bridge: NativeAppCheck | null = null;
let initialized = false;
const TOKEN_WAIT_MS = 5000;

async function nativeToken(forceRefresh: boolean): Promise<NativeToken> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        if (!bridge) throw new Error('App Check unavailable');
        const result = await Promise.race([
            bridge.getToken(forceRefresh),
            new Promise<never>((_, reject) => {
                timer = setTimeout(() => reject(new Error('App Check timed out')), TOKEN_WAIT_MS);
            }),
        ]);
        if (!result || typeof result.token !== 'string' || !result.token.trim()
            || !Number.isFinite(result.expireTimeMillis) || result.expireTimeMillis <= Date.now()) {
            throw new Error('App Check invalid response');
        }
        return result;
    } catch {
        // Never pass native errors (which may contain request details) into SDK logs.
        throw new Error('App Check monitoring token unavailable');
    } finally {
        if (timer !== undefined) clearTimeout(timer);
    }
}

/** Monitoring only: old binaries/iOS remain usable while enforcement stays OFF. */
export function initializeNativeAppCheck(app: FirebaseApp): void {
    if (initialized || Platform.OS !== 'android') return;
    // This bridge deliberately supports Play Integrity only, including in development.
    if ((globalThis as typeof globalThis & { FIREBASE_APPCHECK_DEBUG_TOKEN?: unknown }).FIREBASE_APPCHECK_DEBUG_TOKEN) return;
    try {
        const native = requireOptionalNativeModule<NativeAppCheck>('TownLoopAppCheck');
        if (!native) return;
        native.initialize();
        bridge = native;
        let refreshing = AppState ? AppState.currentState === 'active' : true;
        const appCheck = initializeAppCheck(app, {
            provider: new CustomProvider({ getToken: () => nativeToken(true) }),
            isTokenAutoRefreshEnabled: refreshing,
        });
        initialized = true;
        try {
            AppState?.addEventListener('change', state => {
                const active = state === 'active';
                if (active === refreshing) return;
                try {
                    setTokenAutoRefreshEnabled(appCheck, active);
                    refreshing = active;
                } catch { /* Monitoring refresh must not interrupt app lifecycle. */ }
            });
        } catch { /* Optional lifecycle integration must not disable genuine token requests. */ }
    } catch {
        // Initialization must not interrupt authentication or normal app startup.
        bridge = null;
    }
}

/** Attach only genuine, unexpired native tokens to authorized Firebase/custom requests. */
export async function appCheckHeaders(): Promise<Record<string, string>> {
    if (!bridge) return {};
    try {
        // Use native cache; avoid Firebase JS SDK's internal dummy error-token result.
        const { token } = await nativeToken(false);
        return { 'X-Firebase-AppCheck': token };
    } catch {
        return {};
    }
}
