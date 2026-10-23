# Prepared native startup / Preview runtime correction

## Confirmed runtime difference

The installed Preview APK (`f8e73db3-7fdd-4b1b-b800-745d1f55a44c`) has fingerprint `11ed319e93600a1176aa3d3a1860011a190af93a`. The published update `01a16988-c089-7288-8654-75c9af10e8d5` uses `f190bde0483ce6d58074f4ab5bc8721ab925e4c9`.

Read-only EAS comparison of these two stored hashes showed exactly one changed fingerprint source: `assets/startup/first-frame.png` (`291cea029920ebc78e542324d8c3b1a796bb21cc` → `ff538aaf8292cf442c6dc24f8c1a34ff56827b63`). It is the image configured in the native splash plugin. This is a genuine native splash asset difference, not an expo-video dependency upgrade or JS-only fingerprint error. No incompatible runtime is forced.

The native splash now references a separate `native-splash.png` (a byte-identical copy of the current improved first frame). Keep this asset stable for the lifetime of an APK. Editing the startup video fallback frame no longer edits native splash input implicitly. Native splash cream now matches the existing improved animation background. Fingerprint policy, application ID, project ID, channels and signing configuration remain intact.

## Android startup opt-out

The pinned expo-video 57.0.5 patch adds an immutable Android constructor option, `disableAudioSession`, default false. Only the startup player opts in. That player creates no basic MediaSession, does not register with the audio-focus manager, disables audio-track selection and cannot register with the playback service. Cleanup tolerates an absent session. Other players keep their existing behavior. iOS keeps its existing silent/mixing configuration.

`prepare-native-dependencies.cjs` applies the patch on local and clean EAS installs. The patch is idempotent and refuses an unexpected package version or source drift. Re-review it before any expo-video upgrade. No new native dependency is introduced. A new APK is required; old APKs cannot gain this constructor behavior through OTA.

The approved MP4, fallback frames, scaling, fades, Reduce Motion, and authentication/navigation logic are preserved. The candidate includes `6e6ff50`, `dffc0c8`, and `cae2caf`, including the temporary Discussion Feed trace and all existing security code. Firebase configuration/rules/data are untouched.

## Next authorized release

Nothing is built, pushed or published by this preparation.

1. Approve/push the prepared candidate, then build **one** Android `preview` APK using the existing signing configuration. Clean EAS install must run postinstall; do not bypass the patch.
2. Record the successful APK's actual build ID/runtime and confirm its update channel is Preview. Install over the previous app and test startup while earbuds are playing tablet audio; verify no active TownLoop media session with Android diagnostics if available.
3. Publish only through `npm run update:preview -- --build-id NEW_PREVIEW_BUILD_ID "Reviewed release"`. The script queries the chosen finished Preview build and computes the current Android fingerprint with the Preview environment. It refuses missing/mismatched fingerprints, another package or non-Preview build. No manual runtime pin or override is supported.
4. Confirm the resulting update runtime equals the chosen APK runtime. Older `11ed319…` APKs remain isolated; they need the new binary for the Bluetooth change. Production is separate and unchanged.

## Verification limits

Focused checks cover startup option wiring/lifecycle, patch application/idempotence/source-drift rejection, nullable-session guards/default behavior, strict runtime publication guard and existing diagnostic privacy tests. TypeScript passes. No Gradle/APK compilation or physical Bluetooth verification was performed because builds are held for approval. Those are the remaining validation gates; source checks do not prove multipoint-earbud behavior on hardware.
