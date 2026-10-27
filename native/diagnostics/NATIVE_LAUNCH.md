# Direct native launch — no custom startup playback

The custom video/fade/scale system, MP4s, posters, controllers, timers, playback tests, Android startup-only expo-video patch and its build gates are removed. The original file in the owner's Downloads directory is untouched. Historical implementations remain only in Git history; they are not app imports.

Only the standard Expo/native static launch splash remains. `assets/native-splash.png` is the existing single cream pixel, not a logo/poster: Expo SDK 57's Android splash styles always reference a drawable, so a valid unbranded drawable is retained. iOS uses the same static launch configuration. No custom splash animation, fade, duration or video player runs.

The root layout waits only for the existing session/registration, community and font readiness. Initialized navigation lays out and dismisses the native splash immediately. Existing community/login/pending/approved-user route guards are unchanged. The existing error-boundary screen also dismisses the splash when laid out, so a rendered failure cannot be hidden by it. Font-loading failure uses the existing fallback-font path. No timer, frame loop, AppState listener or playback lifecycle is involved.

`expo-video` and its normal plugin remain because `MediaViewer.tsx` uses them for actual app videos. Its standard behavior is restored: startup-only SDK patching, forced Android source compilation and startup artifact checks are removed. No other media code changes.

## Existing Android APK versus complete removal

A JavaScript-only backport can stop invoking custom playback on installed Preview runtime `00add22145e025fb9329377ce1a2d9d6ecdaf393`. It must retain that APK's native inputs in an isolated compatible release snapshot; the complete cleanup candidate has different native inputs and must not be forced onto the old runtime.

An OTA cannot erase the existing APK's embedded JavaScript/video assets, compiled startup-specific SDK patch, native splash resources or previously cached updates. Expo's failure recovery/reinstallation/rollback can still select that older code. Therefore permanent binary removal and isolation from all older startup OTAs require a new approved Android APK, and a corresponding fresh iOS build, with a new fingerprint runtime. Keep fingerprint checks, Preview/Production channels and publication guards intact. Publish future updates only for the new exact runtime; never republish a historical startup bundle to it. Do not deactivate Expo rollback safety or updates to pretend the old binary is cleaned.

No build, publication, remote update deletion or release-channel change is performed by this cleanup. Ignored `.release` folders are historical release snapshots, not active application sources. They must not be reused wholesale for a future release.

## Verification scope

Focused executable source fixtures verify ready/unready navigation, authenticated Home versus sign-in/pending routes, registration gating, font/error-boundary/splash failure handling, repeated render/resume without playback controllers or delay timers, removed playback files/configuration, and retained non-startup media support. They do not constitute device launch, native compilation or Bluetooth testing. Existing account-routing fixtures also cover route guards. Physical cold launch/relaunch/resume still needs verification after an approved release.
