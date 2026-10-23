# Startup reliability correction (local; not released)

Current implementation: native Expo splash → actual MP4 in expo-video (Android ExoPlayer with startup-only MediaSession opt-out) → React/Reanimated fade into existing navigation. This is not a replacement native animation.

Confirmed local defect: expo-video's `useVideoPlayer` invokes Expo's `useReleasingSharedObjectWithLifecycle`. Its earlier effect releases the SharedObject on unmount. TownLoop's subsequent effect cleanup invoked `player.pause()` on that released object. Expo Android defines the resulting exception as “Cannot use shared object that was already released.” The startup regression test was run red with the original component and Expo's release-before-cleanup ordering; it threw at the real component's cleanup call.

Correction: let the hook own release; never pause in cleanup; tolerate removal of listeners after release. A failed pause still completes startup. A startup-only React boundary contains player setup/render/effect failures. A 4.5-second watchdog replaces stalled playback with the existing poster; normal app readiness ends startup immediately and no longer depends solely on layout. Authentication/readiness checks are preserved, not bypassed. The original MP4, cream, size, native patch and fade are unchanged.

Verification: seven focused component checks cover constructor configuration, background/resume without replay, Reduce Motion, cold module launch/remount, release-before-cleanup, unresolved preparation, pause/render failure fallback, and readiness without layout. These use native lifecycle fixtures, not a physical Android run. TypeScript and diff checks pass.

The finished EAS Preview build `26feaf48-c696-4e7f-aca3-5bd1603fa4b1` records bundled commit `fb1a602` and fingerprint `a6551ff3ee4b0d2b0c6797653fc556f234494d65`. The corrected source produces that exact fingerprint. An OTA can repair this JS lifecycle defect in that APK; the previously published `f190bde…` update is incompatible and does not overwrite it.

Missing evidence: no connected-device crash log or error-boundary stack was available. The lifecycle defect is demonstrated; attribution of every physical-phone freeze/black frame to it is not proven. Native process crashes or JS-thread stalls cannot be recovered by a React boundary/watchdog. If symptoms remain after an approved compatible OTA, obtain the cold-launch AndroidRuntime/FATAL EXCEPTION stack, React error message/component stack, and actual running update/runtime ID with private values redacted. Do not clear app data or rebuild speculatively.
