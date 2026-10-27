# Unsigned iOS Simulator preparation — 2026-10-27

## Access and execution

Read-only `eas simulator:availability --json` returned `available: false` for `seeds4clix`.
Expo supplied https://expo.dev/services/simulators as the access/waitlist destination.
No simulator session, build, deployment, enrollment or subscription change was started.
Cloud EAS compilation of a simulator artifact does not depend on access to the browser simulator.
No paid Apple membership, signing certificate, device UDID, provisioning profile or APNs key is
required for an iOS Simulator build: https://docs.expo.dev/build-reference/simulators/.

Prepared profile: `ios-simulator` in native/eas.json; Release configuration, ios.simulator=true,
Preview environment, isolated `preview-simulator` update channel, existing bundle identifier
`com.toni029.townloop`, existing fingerprint runtime safety. The physical-device Preview,
Android and Production profiles are unchanged. No development server is required by the Release
bundle. Do not force a physical-device runtime or publish a matching simulator OTA accidentally.

After explicit build approval, from a clean managed release checkout only:

```
node native/scripts/submit-build.cjs ios ios-simulator
```

The helper submits once, immediately opens the returned exact Expo build URL through the default
browser, prints the URL even if opening fails, and never polls, retries or cancels the build.
Do not run this command during preparation. No build was submitted.

## Testing from Linux

Recommended browser alternative while Expo access is gated: use an Appetize account and upload
only the approved compressed simulator `.app` artifact after building. Appetize supports simulator
archives, not App Store `.ipa` files, and recommends ARM simulator builds:
https://docs.appetize.io/platform/app-management/uploading-apps/ios.
This is a separate provider/account and may have usage costs; no upload or account creation was
performed. A borrowed/remote Mac with Xcode can instead install the same compatible simulator
artifact. Linux cannot run Apple's iOS Simulator locally; Expo Go/web previews do not verify
TownLoop's custom native dependencies. Requesting Expo waitlist access remains another option.

## Included and testable

The shared original 7ae4520 native fade/scale startup and neutral cream splash are unchanged.
There is no startup MP4/player. Authentication, canonical approval/roles and native navigation,
Home/medications/calendar, News/PDF reader, Work Orders, Social, Marketplace, Discussion Feed,
photo selection and Inbox remain in the bundle. Existing Firebase rules and authorization apply;
use an authorized existing account, and remember that submissions to the live project are real
writes, not simulator fixtures. No resident data was accessed during preparation.

Google native SDK remains included but its button remains disabled until real iOS OAuth/callback
configuration passes the existing gates. Google OAuth registration is independent of purchasing
Apple membership; simulator success still does not verify real iPhone sign-in.

All four notification categories, settings and native modules remain present. The simulator-only
build flag prevents waiting for APNs/Expo token registration and reports that preferences are
saved but push delivery requires a configured physical iPhone. It cannot send messages or bypass
backend authorization. Physical iPhone and Android registration behavior is unchanged. Sending,
notification workers, account deletion, retention and cleanup remain disabled. Pending backend
v2/state/index/reply prerequisites from PLATFORM_PREREQUISITES.md are not deployed by this build.

Apple membership/signing/APNs remain necessary for EAS real-iPhone ad-hoc installation,
TestFlight/App Store and full end-to-end remote-notification verification. Simulator layout,
authentication and navigation tests do not prove background/closed-device delivery, Bluetooth,
real-device performance, camera, or biometric protections. No phone or simulator test is claimed.

## Focused verification

Eight fixtures passed: profile isolation, iOS-only helper selection, actual EAS profile resolution
and credential-provider bypass, simulator notification registration bypass, preservation of both
physical registration paths, and the existing submit-once/browser-opening safeguards. TypeScript
and simulator Expo configuration inspection passed. Existing Android, signed Preview and Production
profiles were compared against 47fbb47 and remain unchanged.
No native compilation blocker was demonstrated; compilation remains unverified until the approved
EAS macOS build. No native dependency was removed, downgraded or substituted.
