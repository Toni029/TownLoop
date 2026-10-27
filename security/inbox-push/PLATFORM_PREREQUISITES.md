# iPhone-first + Android Preview release gates — 2026-10-27

Supersedes the Android-first sequencing in earlier notes. One shared default-database backend;
iPhone and Android must pass their own gates before advertising either as fully configured.
No build, deployment, credential creation, push delivery or resident-data operation was performed.

## Verified status

| Gate | iPhone | Android |
|---|---|---|
| Application identifier | `com.toni029.townloop` | `com.toni029.townloop` |
| Google provider | Firebase Google enabled; no Firebase iOS app/client configured | Existing Firebase app; zero SHA registrations / Android OAuth clients |
| Google button | Hidden until verified iOS configuration | Hidden until verified Android configuration |
| Push credential | EAS metadata: zero Apple teams, matching app identifiers and APNs keys | Existing Preview FCM v1 credential configured; no live delivery test |
| Signing | Owner Apple session/team, certificate and device provisioning required | Existing signing identity verified against actual finished APK |
| Profile | `preview`: internal, physical device, remote credentials | `preview`: APK, existing local credentials |
| Runtime | Fingerprint; first signed binary required | Fingerprint; complete Google configuration requires new binary |

Apple membership itself cannot be inferred from an empty EAS account. The owner must sign in.
Both profiles use environment/channel `preview`; Production is separate and unchanged. iOS and
Android fingerprints need not be equal. Record each actual EAS runtime after the approved builds;
never force the installed Android runtime `00add22145e025fb9329377ce1a2d9d6ecdaf393` onto new native configuration.
The latest inspected Android APK is build `49e3b645-1d6f-4dbd-aa4d-820f835dc812`, source `c8c77e2`;
it does NOT contain the newer restored fade/scale or four-category client changes.

## Owner steps — iPhone first

1. Sign in to [Apple Developer](https://developer.apple.com/account/) with an active paid Developer
   Program team. Confirm permission to use explicit App ID `com.toni029.townloop`; enable Push
   Notifications. Do not revoke an existing app's keys/certificates. No private key/password in chat.
2. In [Firebase project settings](https://console.firebase.google.com/project/cc-livingcommunity-app/settings/general),
   register an iOS app for that exact bundle ID (reuse if one appears). Keep the existing project,
   web app, databases and Google web OAuth client. Download its real `GoogleService-Info.plist` to
   ignored `native/credentials/GoogleService-Info.preview.plist`, private file permissions.
3. In [Google Cloud credentials](https://console.cloud.google.com/apis/credentials?project=cc-livingcommunity-app),
   confirm/create the matching **iOS** OAuth client for that bundle. Confirm its CLIENT_ID and
   REVERSED_CLIENT_ID agree with the Firebase plist; re-download after configuration if necessary.
   Set only the public `iosClientId` in `native/google-auth.json`. Run
   `node native/scripts/verify-google-ios.cjs`. After live metadata and file checks agree, enable
   `iosOAuthRegistered`; never enable on a guessed client ID. Keep the existing web client ID.
4. Supply that same ignored plist as Preview-only EAS file variable `GOOGLE_SERVICES_PLIST`.
   This is a build-time validation input. The installed Google SDK uses explicit `iosClientId`
   and the verified reversed-client URL scheme; Firebase authentication remains the existing JS SDK.
   No native Firebase migration or Android file is required for iOS Expo-to-APNs delivery.
5. From `native`, run `./node_modules/.bin/eas device:create`; open the enrollment URL on the test
   iPhone. Run `eas credentials:configure-build --platform ios --profile preview` using the local
   CLI, choose the correct Apple team and authorize the matching distribution certificate/ad-hoc
   profile containing that iPhone. Run `eas credentials --platform ios`, choose Preview, then
   Push Notifications to reuse an appropriate APNs authentication key or authorize creation.
   EAS stores it securely. Recreate the provisioning profile if Push capability was added later.
   These owner credential operations require authorization; no build is submitted by these steps.
6. Recommended first iPhone test distribution: existing **ad-hoc Preview**, requiring registered
   device UDID and matching provisioning. If TestFlight is preferred, explicitly choose it before
   building: it additionally needs App Store Connect app/access and a separate store-distribution
   Preview-channel profile/submission approval. Do not use Production as a shortcut.

## Android in parallel

Use ANDROID_PREREQUISITES.md's exact existing certificate and console procedure. Firebase Android
app is `1:883715389126:android:9be9bbe73fece14e27c9c7`. Add verified SHA-1 and SHA-256, confirm the
matching Android OAuth client, refresh the ignored JSON and existing Preview EAS file variable.
Run `node native/scripts/verify-google-android.cjs`; only then enable `androidOAuthRegistered`.
No new signing key, service account or credential secret is required.

- SHA-1: `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`
- SHA-256: `FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C`

## Shared implementation and backend approval

Four categories are implemented, not live: Private Inbox (friend/office/maintenance sources),
Marketplace messages, Discussion comments/direct replies, and Work Order non-Done to Done.
Recipient authorization, blocking, sender suppression, generic opaque payloads, category preference,
multiple devices, retry suppression, revoked tokens and authenticated tap routing are shared.
Only registerInboxDevice v1 is currently ACTIVE; sending remains false. Local v2 and state callable
are prepared. Reuse the six passing emulator cases at checkpoint 8d21bfe; no repeated suite needed.

Approve only the previously prepared Stage A: two additive indexes (skip existing matches, wait
READY), tested **default-only** reply-rule patch after baseline hash check, then ONLY
`registerInboxDevice` v2 and `getNotificationState`. See ANDROID_PREREQUISITES.md for isolated configs
and exact allowlisted commands. Keep sending/reply-capability false until separately approved.
The six source event triggers are a distinct held deployment; no scheduled receipt sender,
account-deletion processor, retention or cleanup worker is included. Tester-only sending later
requires separate approval, enabled sending AND an explicit tester-recipient allowlist.

## Build and device verification gates

- Startup is the shared exact 7ae4520 native image fade/scale with original brand asset, neutral
  splash/fallback, bounded initialization and no video player. Existing Android expo-video opt-out
  remains source-built for compatibility and normal playback remains opt-in unchanged.
- iOS config introspection confirms production APNs entitlement for ad-hoc Preview. Visible push
  alerts do not need silent-push background execution; its flag stays false. Android channels,
  13+ permission and icon are already configured. OS permission/privacy settings control banners
  and lock-screen display. Android dots/counts depend on the launcher. Other closed devices may
  retain a stale badge until later push/resume. Force-stop/OS restrictions are not bypassed.
- Installed ExpoNotifications pod requires iOS 16.4 or later. No Xcode/CocoaPods compilation or
  physical iPhone sign-in, animation or APNs delivery was performed on this Linux host.
- Build from a clean managed source checkout; preserve ignored stale native directories. Run
  focused config checks after real files/Apple credentials are supplied, then get build approval
  for one `ios preview` and one `android preview`. Both include the same approved JS features.
- Use `native/scripts/submit-build.cjs` separately per approved platform. Submit once, immediately
  open the returned exact Expo build URL in the default browser and provide its clickable link.
  No continuous polling, automatic retries, replacement builds or cancellation.
- Before tester sending: verify actual binaries' signing, runtime, native modules, callback scheme,
  entitlements and bundled startup. Then test Google cancel/conflict/approval, cold launch/resume,
  all four generic push categories, foreground/background/closed taps, denied permission, read
  badges, multi-device and blocking on designated consenting accounts/devices only.

References: [Google SDK Expo setup](https://react-native-google-signin.github.io/docs/setting-up/expo),
[Expo credentials](https://docs.expo.dev/app-signing/app-credentials/),
[physical iOS push prerequisites](https://docs.expo.dev/push-notifications/push-notifications-setup/).

## Local verification receipt

2026-10-27: five Google configuration/plugin fixtures and three push credential/profile fixtures
passed; three submit-once/browser-opening fixtures passed. TypeScript passed. Android and iOS
Expo introspection passed; the iOS callback is deliberately absent until real iOS registration is
validated. Both read-only live-file Google validators correctly reject current incomplete inputs.
Native patch preparation passed. The prior six backend/rules emulator cases were reused unchanged.
No native compilation, simulator/phone launch, Google authentication, FCM or APNs send was performed.
