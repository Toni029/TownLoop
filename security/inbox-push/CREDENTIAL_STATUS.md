# Inbox notification credentials — 2026-10-26

Credential setup only. No backend function, notification trigger, scheduler, app binary or OTA was deployed. No push was sent. No resident records, security rules, hosted site, named database, account-deletion/cleanup worker or Production environment was changed.

## Android: configured

- Firebase project: `cc-livingcommunity-app`; FCM API verified **ENABLED**.
- Firebase Android app registered for the existing package **`com.toni029.townloop`**. Public app ID: `1:883715389126:android:9be9bbe73fece14e27c9c7`.
- Matching `google-services.json` is stored in **EAS Preview only**, project `@seeds4clix/townloop-native` (`9f970d26-beed-44d6-a590-9dcdc00e85de`), as the **secret file variable `GOOGLE_SERVICES_JSON`**. The ignored local copy is `native/credentials/google-services.preview.json`, mode 0600. Neither copy is a sender private key. Production/development environment variables were not created.
- EAS FCM v1 sender credential is assigned to that package/project. No reusable EAS FCM key existed. A dedicated service account, `townloop-expo-fcm@cc-livingcommunity-app.iam.gserviceaccount.com`, was provisioned with **only `roles/firebasecloudmessaging.admin`**. Other IAM bindings were preserved using the existing policy etag. This predefined role permits FCM messages/topics, delivery-data lookup and project metadata; it grants no Firestore, Storage, Auth or account-deletion access.
- One active service-account key was verified by metadata. Its private material was transferred directly in memory to EAS, never printed, written to disk or committed. No Firebase Admin SDK key was reused. Credential validity has not been tested by sending an alert.
- Android Preview keeps the existing local keystore and `credentialsSource: local`. The certificate extracted from the actual local keystore matches the previous installed Preview certificate SHA-1 in `security/release/google-auth-registration.json`. No signing key was replaced or uploaded.
- Native `expo-notifications` and `expo-crypto` dependencies are present. Channel: `inbox`; monochrome white notification icon: `native/assets/notification-icon.png`; Android 13 permission is supplied by the notification library's manifest and requested through the existing opt-in flow.

## iOS: local configuration ready; owner login required

No EAS iOS app credentials, Apple team, APNs key, certificate or provisioning profile is registered for this Expo project. Apple membership/device access cannot be established without the owner's Apple session. No Apple credential was created or invented. An additional Firebase iOS registration is not needed for Expo-to-APNs delivery; the existing Firebase JS account/Inbox integration remains unchanged.

Prepared Preview profile: internal distribution, physical device (`simulator: false`), remote signing credentials. Bundle ID remains **`com.toni029.townloop`**. Preview ad-hoc and future store builds use the **production APNs entitlement**; development-client builds use **development/sandbox**. Expo introspection verified the Preview entitlement without compiling.

Owner steps (no secrets in chat):

1. Confirm active Apple Developer Program membership and that your team can register/use `com.toni029.townloop`. Sign in at [Apple Developer account](https://developer.apple.com/account/). A team Account Holder/Admin may need to approve App ID/Push Notifications capability or credential creation. Reuse an existing applicable APNs key/certificate where possible; do not revoke another app's key.
2. In the `native` project folder, run `./node_modules/.bin/eas device:create`. Choose the registration website and open its link **on the test iPhone** to enroll the device UDID. This is necessary for ad-hoc installation; do not paste device identifiers into chat.
3. Run `./node_modules/.bin/eas credentials:configure-build --platform ios --profile preview`. Sign in to Apple interactively, select the correct team and bundle ID, and authorize only the needed distribution certificate/ad-hoc provisioning profile for the enrolled iPhone. This command configures signing; it does not build or submit an app.
4. Run `./node_modules/.bin/eas credentials --platform ios`, select `preview`, and use its **Push Notifications / Apple Push Notifications Key** section to reuse an appropriate APNs key or create one with the team's approval. EAS securely stores the `.p8` key, key ID and team association. Do not paste/export the key into Git or chat. If managing the App ID manually, enable Push Notifications in Apple Identifiers and regenerate its provisioning profile after capability changes.
5. Report only “Apple credentials configured” when done; credential metadata can then be checked without downloading private keys.

An ad-hoc Preview build uses production APNs, but **this does not publish to the App Store or the Production OTA channel**. Future TestFlight/store distribution requires a separately approved store build/profile and App Store Connect setup; no submission is prepared for execution here.

## Runtime, registration and next approvals

- Preview channel remains `preview`; Production remains `production`. Fingerprint runtime policy remains enabled. Push dependencies and Firebase native configuration require a **new Android APK and new iOS binary**; they cannot be added by OTA to the installed `d6f09b9023171c8bdabd4a8e1da0b41223dff3b9` APK. The new build's actual runtime must be recorded from EAS after completion. Never force the old runtime.
- Local configuration falls back to the ignored Android client file for reliable fingerprint checks. EAS uses the Preview secret file; Expo fingerprints this file by contents, not its machine-specific path. Future OTA preparation needs this exact native configuration file (or its safely retrieved matching copy), the intended EAS environment and the new APK's exact runtime.
- Read-only Cloud Functions lookup returned **404** for `registerInboxDevice`: it has **not** been deployed. The isolated callable is ready for scoped deployment after approval; it derives the account UID from verified callable authentication, ignores supplied recipient/UID fields and requires an approved canonical profile. Capability-based **revocation only** also works after sign-out; it cannot register or send notifications. A focused forged-recipient fixture passed.
- All Inbox sending defaults **OFF** (`INBOX_PUSH_ENABLED` is not enabled). No trigger or receipt scheduler needs deployment to test token registration.

Next approval can cover **only** deploying `registerInboxDevice` from the isolated package and **one Android Preview APK**. Android credential configuration is ready. iOS build approval should follow successful Apple steps above. After deployment verify only the callable's registration/revocation authorization with designated test devices/accounts, without sending resident notifications. Verify that unauthenticated registration is rejected at the callable layer; any Cloud Run invocation setting must apply only to this callable and must not bypass Firebase authentication.

Then, with separate approval, deploy disabled Inbox delivery functions/receipt handling and perform approved tester-only Android+iPhone foreground/background/ordinary-closed tests. A later explicit sending activation is required; credential setup alone does not activate live delivery. Keep all destructive workers and Admin escalation delivery disabled.

References: [Expo FCM v1 setup](https://docs.expo.dev/push-notifications/fcm-credentials/), [EAS credential management](https://docs.expo.dev/app-signing/managed-credentials/), [iOS internal/ad-hoc distribution](https://docs.expo.dev/build/internal-distribution/).

## Focused checks for this preparation

Two configuration fixtures passed (missing/mismatched Android config denied, local/EAS file paths accepted, physical iOS Preview and APNs mode configured) and one backend fixture proved that forged `uid`/`recipientId` fields cannot change registration ownership. Prior delivery/security tests were reused, not rerun. Actual Expo Preview introspection verified the project/package/bundle IDs and production APNs entitlement.

The local Android candidate fingerprint is `00add22145e025fb9329377ce1a2d9d6ecdaf393`; it intentionally differs from the installed pre-push APK. This is preparation evidence, **not an actual built APK runtime**. Confirm the runtime from the approved EAS build before any future OTA. No native compilation, FCM delivery, APNs delivery or real-device notification behavior is claimed here.
