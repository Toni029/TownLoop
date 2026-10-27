# Google sign-in preparation — local only

Existing Firebase project cc-livingcommunity-app, existing Firebase JS Auth instance and (default) profile
collection are preserved. The original hosted web app and named database are unchanged. No account or
Firebase configuration was created/modified during implementation.

Read-only configuration verification found Google enabled with its existing web client ID, but zero
registered Android/iOS Firebase apps. The public web client ID is in native/google-auth.json;
no OAuth client secret, private key or access token is shipped. The current Preview certificate was
verified directly from the cached APK; see google-auth-registration.json. No keystore was accessed.

Implemented:
- Web uses the existing Firebase Google popup. Native obtains a Google ID token and exchanges it via
  Firebase signInWithCredential. Only basic Google sign-in is requested; no Drive/Gmail permissions.
- Existing profile approvals/roles are never rewritten. New profiles require explicit Terms/Privacy
  acknowledgment and are created transactionally as approved=false, role=resident.
- The existing registration-navigation guard covers profile initialization. Failure signs out only
  that captured user, preserving a separately switched session.
- Google account-deletion request reauthentication is supported in a configured native build;
  it does not delete an account or change the Admin/VIP request workflow.
- Native module and platform-registration guards hide the provider on unconfigured/older binaries.
  No fake Android/iOS client IDs or native-readiness claims are used.

Activation requires separate approval:
1. Register Android package com.toni029.townloop in the existing Firebase project with the verified
   Preview certificate SHA-1. Ensure the matching Google Android OAuth client is generated/registered
   in the same Google Cloud project. Do not replace the existing web client or signing credentials.
   Future Google Play builds additionally need their Play app-signing certificate registered.
2. Verify the package/certificate/OAuth match, then set androidOAuthRegistered=true in google-auth.json.
   iOS stays off until an actual bundle identifier, iOS OAuth client and reversed URL scheme are configured.
3. Build ONE separately approved Android Preview APK containing the Google native SDK. Its runtime
   will differ; do not force the old installed runtime or send this dependency as an old-runtime OTA.
4. Test actual Google sign-in, cancel, existing approved account, new pending account/consent and
   Google reauthentication on a real configured build. Fixture tests are not real Google device testing.

No build, publication, Hosting/rules deployment, provider change or app registration has been executed.
The independent registration-layout/Inbox-width commit remains JS-only for a scoped existing-runtime OTA.

References:
- https://docs.expo.dev/guides/google-authentication/
- https://react-native-google-signin.github.io/docs/setting-up/expo
- https://react-native-google-signin.github.io/docs/original


Current 2026-10-27 read-only status supersedes the earlier zero-Android-app observation: the Android
Firebase app is now registered and the Google SDK is in Preview build 49e3b645, but zero SHA certificates
are registered. Google readiness stays false pending the verified Android OAuth match. No iOS Firebase
app/client or Apple signing is configured. The iOS URL-scheme construction is corrected locally; see
../inbox-push/RESTORATION_RELEASE.md for exact public fingerprints and owner-only setup steps.

## iPhone-first release gate (2026-10-27)

See [platform prerequisites](../inbox-push/PLATFORM_PREREQUISITES.md) for exact Apple, Firebase,
Google and EAS owner steps. `native/scripts/verify-google-ios.cjs` validates the actual ignored
Firebase plist against the project, bundle, app, explicit iOS client and reversed URL scheme.
The config plugin refuses an enabled but incomplete iOS configuration. Both platform readiness
flags remain false until actual registration is complete; email/password and approval/consent
requirements remain unchanged. No credentials were registered or live accounts created.
