# Production Android signing — configured 2026-11-06

## Completed with owner approval

- Confirmed EAS project `@seeds4clix/townloop-native`
  (`9f970d26-beed-44d6-a590-9dcdc00e85de`) and Android `com.townloop.app`.
- Rechecked that no package-specific keystore existed. Created exactly one
  EAS-managed upload keystore, assigned as default build credentials
  **TownLoop Production Upload**, and verified the remote certificate against
  the secure local backup. It is not the existing Android Debug certificate.
- Changed only `build.production.android.credentialsSource` to `remote`.
  Preview/development remain local; their keystore and credentials file were
  preserved. Other EAS app credential records were verified unchanged.
- Added upload SHA-1/SHA-256 to Firebase Android app
  `1:883715389126:android:869aa93ffdc82d5127c9c7` in
  `cc-livingcommunity-app`. Retained Preview certificates, old Android registration,
  Firebase web OAuth client, iOS identity and all resident data.
- Downloaded actual refreshed Production Firebase JSON to ignored mode-0600
  `native/credentials/google-services.townloop-app.production.json` and validated
  package/project/app/web-client/upload-certificate OAuth matching.
- Created Production-only EAS secret file variable `GOOGLE_SERVICES_JSON`.
  Preview/development environment metadata remained unchanged.
- Set `productionCertificateSHA1` to the verified upload certificate. Production
  configuration now validates with its explicit Firebase file; known Debug
  signing remains rejected. No APK/AAB or physical-device test is claimed.

Public fingerprints:

- SHA-1: `D8:AD:D6:AA:A3:B7:68:99:0A:A1:22:45:F8:C7:67:29:9A:C7:8C:01`
- SHA-256: `CB:F8:21:33:EC:21:F7:8B:0F:D0:FE:70:BC:60:01:A2:6B:94:5B:41:AF:BB:D4:84:91:FB:CE:0C:BD:49:7D:47`

Public configuration/registration receipt:
`security/release/production-upload-signing.json`.
Encrypted keystore and private recovery metadata are backed up locally under
`/home/tonio/.local/state/townloop/production-signing/com.townloop.app`, with
0700 directory / 0600 files. No private signing material is in Git or logs.
Owner should store a separate secure offline recovery copy; a local backup is
not an off-device backup. Do not replace/regenerate this key during later setup.

## Google Play Console — still required

1. Create/configure the Play Console app for the new package and enroll in
   **Play App Signing**. Keep the upload key distinct from Google's signing key.
2. Obtain Google's app-signing SHA-1/SHA-256 and public certificate from the app's
   **App signing** page (App integrity / Setup navigation may vary).
3. Register those fingerprints on the SAME Firebase Android registration; verify
   the Android OAuth client matches `com.townloop.app` + Play signing SHA-1.
   Refresh Production Firebase JSON and its Production-only EAS file as needed.
   Do not change the web client, iOS callback, Preview certificates or upload key.
   If Play does not expose its signing certificate until enrollment/first upload,
   finish this before internal testers exercise Google Sign-In.
4. Complete Play's Internal Testing setup, app-access/reviewer instructions and
   required listing/policy fields using the existing release checklist.

## One AAB and final Google Sign-In checks

Signing/configuration preparation is ready for a separately authorized first
production AAB. No build, upload, OTA, deployment or GitHub push was performed.
Before building, confirm the selected remote key/fingerprints still match this
receipt and review version code, Production environment and build scope.
The new Android identifier's FCM v1 sending-credential association must also be
verified before claiming notification readiness; it was not changed by signing setup.

After explicit build/upload approval, install through Google Play Internal
Testing (not a side-loaded Preview APK). Confirm the installed certificate is
Google Play's, then test Google sign-in/sign-out/sign-in, existing Firebase
UID/profile/approval preservation, email login and notification/deep-link routing.
Both old Preview and new production app can coexist; local data is not migrated.

References:
- https://docs.expo.dev/app-signing/managed-credentials/
- https://developer.android.com/studio/publish/app-signing
- https://firebase.google.com/docs/auth/android/google-signin
