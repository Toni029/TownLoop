# System-bar / edge-to-edge review

Recovery: `6a4a891`, pushed tag `checkpoint/before-system-bars-2026-10-15`.

## Changes

- SDK 57 `expo-navigation-bar` config plugin disables the automatic navigation contrast scrim, keeps the bar visible, and configures dark initial icons. `expo-status-bar` config plugin keeps status icons visible and dark at initial launch.
- The generated Android project enables edge-to-edge, targets API 36, uses transparent status/navigation colors, and retains `adjustResize` keyboard handling. No deprecated system-bar background setters or hidden-bar tricks are used.
- The application window/loading fallback uses TownLoop cream. Native shell edge borders are removed; the existing gradient remains the full-screen background. Web framing remains unchanged.
- Shared declarative system-bar entries track the visible screen's actual theme. Retained, unfocused screens do not override the active route. Modal entries restore previous icon styles on dismissal. Explicit icon colors follow the installed SDK 57 native implementation (both libraries interpret `dark` as dark foreground content).
- All six native modal surfaces extend under both system bars. Backdrops cover the entire window; full-screen content panels put safe-area padding inside the background, not outside it. Image/PDF viewers use light icons on their existing dark background.
- Authentication gradients already wrap their safe areas and now set matching icon contrast. Root safe-area metrics initialize immediately. Account/pending pages now include the bottom safe area. Centered News dialogs respect the top and bottom insets.
- Fullscreen panel height follows the keyboard-resized layout. The floating dock retains `20 + insets.bottom` placement and keyboard hiding. Existing animations, role/data behavior and layouts are retained.

## Verification

The source checks below passed before the final panel/keyboard sizing refinements. The user subsequently requested APK creation only, with phone testing performed by them.

- TypeScript: passed.
- Existing native tests: 62 passed.
- Full lint: zero errors; one pre-existing unused variable warning in the numbering emulator script.
- Expo dependency compatibility: passed.
- Android and iOS native project generation: passed.
- APK compilation: passed (`:app:assembleRelease`, 2026-10-15). Per the user’s updated request, the APK was not installed or tested here; phone testing belongs to the user. Output: `/home/tonio/Downloads/TownLoop-edge-to-edge-2026-10-15-arm64.apk`.

## APK build

Release variant for `arm64-v8a` Android phones, built locally with the generated project’s debug signing key. This is a review build, not a production signing-key replacement. Android may reject it as an update if the installed app uses a different signing key or a higher version code; do not remove the existing app merely to work around that without considering its local data. Use the existing signing pipeline for an in-place production update.

Build concurrency: one Gradle worker, Kotlin in-process, one Ninja compiler job and one Metro worker. These are local build-machine limits, not app runtime changes.

## Device limitations / phone review

No physical device is attached. No iOS device, simulator or Xcode is available on this Linux host. iOS home-indicator contrast is managed by the operating system. Android OEM gesture indicators and IME navigation areas can differ; the keyboard owns its own system-bar treatment. Expo documents an Android 15 emulator navigation-style issue, and this change has not been verified on an emulator.

On the phone, review both TownLoop themes and both gesture/three-button modes: community selection and login, keyboard opening/dismissal, all four tabs, profile and nested menus, modal open/drag/close, image/video/PDF readers, and Account/back navigation. Ensure content scrolls clear of the dock and home indicator. Authentication-dependent flows require the user's signed-in device; no test users or fake Firebase data were introduced.

Sources: [Expo system bars](https://docs.expo.dev/develop/user-interface/system-bars/), [SDK 57 navigation bar](https://docs.expo.dev/versions/v57.0.0/sdk/navigation-bar/), and the installed SDK's config plugin/Kotlin implementation.
