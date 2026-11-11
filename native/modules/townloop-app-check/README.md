# Android App Check monitoring bridge

Local source preparation only. This module is discovered automatically by the installed Expo autolinker under `native/modules`; it requires a **new Android binary**. It cannot add native code to existing APKs through an OTA. No dependency installation, Gradle/native build, deployment or production enforcement change is included.

The module reuses the default Android Firebase app initialized from the existing `GOOGLE_SERVICES_JSON` configuration. It accepts only `com.townloop.app`, project `cc-livingcommunity-app` and the registered TownLoop Android Firebase app ID. JS keeps the existing Firebase web configuration and working JS Auth/Firestore/Storage clients: a Firebase JS `CustomProvider` obtains actual App Check tokens from the Android SDK. Initialization runs before those services. `appCheckHeaders()` supplies tokens to explicit custom HTTP/REST callers. It returns no header on monitoring failure, never a fabricated valid token. SDK traffic retains Firebase's standard error-token behavior if attestation is unavailable.

There is no debug provider, debug token, server credential, RNFirebase migration or attestation-verdict override. If the Firebase JS debug flag is present, this integration stays inactive. iOS/web and old binaries without this module retain their current behavior; Apple attestation remains separate work. Native provider setup or SDK initialization failures cannot throw into app startup. Token waits are bounded to five seconds; a slow native operation can complete afterward and populate the native cache.

The Android dependency is pinned to `firebase-appcheck-playintegrity:19.0.1`: the official Firebase BoM 34.7.0 matrix pairs it with `firebase-messaging:25.0.1`, the dependency in installed Expo Notifications 57.0.24. This chooses an existing compatible family rather than updating Firebase Messaging globally. Gradle resolution, compilation and physical-device behavior are **not verified** under the no-build boundary.

## Local verification

From the repository root:

```sh
node --test native/tests/appCheck.test.cjs
```

From `native`, `expo-modules-autolinking search --platform android` and `resolve --platform android --json` verify discovery and source metadata without compiling. The focused tests execute the actual JS adapter with native/SDK boundaries replaced, covering optional module absence, unsupported platforms, initialization/attestation errors, invalid/expired responses, bounded waits, debug-flag avoidance, genuine-token headers and idempotent setup. Source assertions are not a substitute for Android compilation or Play attestation.

## Next approved release verification

Keep Firebase enforcement OFF. Separately verify Play **app-signing SHA-256**, linked Play Integrity project and production Android config; upload-key registration alone does not prove Play installs can attest. Build and test a new internal Play AAB only after approval. Check verified/unverified metrics for Auth/Firestore/Storage and every explicit transport; header attachment alone does not validate tokens at custom backends. Test reinstall, account switching, background refresh, expiry/offline behavior, resumed uploads and all push categories. Old binaries and iOS remain unverified and must be accounted for before any later enforcement decision. This module does not change rules, server validation or cloud settings.

References consulted November 11, 2026:

- [Firebase Android Play Integrity provider](https://firebase.google.com/docs/app-check/android/play-integrity-provider)
- [Firebase JS custom provider](https://firebase.google.com/docs/app-check/web/custom-provider)
- [Firebase Android release notes and BoM 34.7.0 matrix](https://firebase.google.com/support/release-notes/android#bom_v34-7-0)
- [Expo local modules](https://docs.expo.dev/modules/get-started/)
