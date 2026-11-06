# Android permanent identity preparation — 2026-11-06

Target Android application ID: **com.townloop.app**.
iOS remains **com.toni029.townloop**. Shared URL scheme stays `townloop`.
Existing EAS project `9f970d26-beed-44d6-a590-9dcdc00e85de`, channels,
Firebase project `cc-livingcommunity-app` / sender `883715389126`, databases,
Auth users, Storage and backend services remain unchanged.

## Verified state / required owner approval

Read-only Firebase inventory found one ACTIVE Android app:
`com.toni029.townloop`, Firebase app ID
`1:883715389126:android:9be9bbe73fece14e27c9c7`.
There is no `com.townloop.app` registration. No registration, OAuth client,
certificate registration, EAS environment or cloud data was changed.

Approval requested: add a separate Android app for **com.townloop.app** in the
existing Firebase project, retain the old app, and register the public existing
Preview certificate SHA-1/SHA-256. Download its actual `google-services.json`;
never change the package string inside the old file or reuse its Firebase app ID.
Set the returned verified ID in `native/google-auth.json.androidFirebaseAppId`.
Re-enable `androidOAuthRegistered` only after validation and OAuth setup pass.
This temporary false flag represents pending setup, not removal of Google sign-in.
The Android build plugin fails closed until it is verified. iOS is unaffected.

Existing Preview certificate (public; verified against the local keystore):
- SHA-1: `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`
- SHA-256: `FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C`

## Google Sign-In / signing / redirect preparation

Retain Firebase's existing enabled Google provider and web OAuth client. Add the
new Android package + actual signing SHA-1 OAuth identity; verify the refreshed
JSON includes that Android client and the existing web client. No Android client
ID is substituted for the existing server/web client ID. Native Google Sign-In
uses its SDK; the shared TownLoop deep-link scheme and iOS reversed client scheme
do not change merely because the Android package changes. Review any future
HTTPS Android App Links association for the new package/certificate separately.

The existing local keystore is explicitly **CN=Android Debug**, with the above
certificate. Preserve it for existing Preview installs. Do not replace it or
rotate it silently. A separately approved, securely backed-up **release upload
key** is required for Google Play. Its public SHA-1 must be set as
`productionCertificateSHA1` (currently null); Production validation uses that
value rather than silently accepting Preview signing. Configure Production signing separately from
Preview; current local credentials are shared, so changing that file blindly
would affect both profiles. No release key was generated here.

Register new-package OAuth SHA-1/SHA-256 for every actual distribution signer:
Preview, the release/upload signer where needed, and especially the **Google
Play App Signing certificate** used on Play-installed builds. Google Play may
re-sign the app, so registering only the upload certificate is insufficient.

## FCM / EAS configuration

Use the new Android registration's JSON via `GOOGLE_SERVICES_JSON` in each
approved EAS environment (Preview, Production and Development if used). Existing
Preview file/secret still belongs to the old package and is deliberately not
changed without registration approval. Production must provide an explicit file.
Verify the existing Expo FCM v1 service credential is associated with the new
Android identifier in the same EAS/Firebase project; reuse the existing sending
credential where supported, do not generate another service-account key blindly.
No notification category, channel, badge, icon, payload or backend changes are
required by the package rename itself. Test all four categories in the new binary;
a working old package is not proof the new package's registration works.

## Installed Preview and local data

Android installs the new package as a separate app, not an upgrade. Leave the old
Preview app installed. No OTA can rename it, and the runtime/application-ID guard
rejects publishing the new identity to the old APK. Both apps may coexist, share
the same backend account after sign-in, and receive notifications independently.
Users must sign in again and grant notification/media permissions in the new app.

SecureStore/Firebase Auth persistence, AsyncStorage, local medication/checklist
state, drafts, pending uploads, downloaded PDF caches, push tokens and settings
stored only on-device do not automatically transfer between Android sandboxes.
Server-persisted data and preferences remain with the existing Firebase user;
local-only or unsynced changes need a separately reviewed transfer plan if they
must be retained. No migration/export/uninstall was attempted here. The `townloop`
scheme may be offered by either installed app; test notification/deep-link routing
with both installed and choose the intended app if Android asks.

## Build readiness

Expo generates Android native applicationId/namespace from `android.package`;
there is no tracked native Android Gradle project. The existing ignored local
Gradle namespace/application ID, Kotlin packages/paths and blob-provider authority
were aligned too, without compiling or changing old build artifacts. EAS regenerates
these files from Expo config; regenerate local native files with the verified new
Firebase configuration before a future build. The ignored old google-services file
was not forged or changed. Preview remains APK;
Production remains AAB and uses the same EAS project. No dependencies/assets/
startup behavior changed. Production is **not ready to build** until the new
Firebase config, OAuth/certificates, FCM association and release signing are ready.
Old release snapshots/registration receipts remain historical evidence, not
configuration for the new identity. No binary, push, OTA or deployment was run.

References: [Firebase Android registration](https://firebase.google.com/docs/android/setup),
[Google sign-in setup](https://firebase.google.com/docs/auth/android/google-signin),
[Android/Play signing](https://developer.android.com/studio/publish/app-signing).
