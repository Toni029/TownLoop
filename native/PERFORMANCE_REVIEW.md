# TownLoop motion and performance checkpoint

Branch: native/expo-migration. Baseline 5b2ce19 was pushed before changes, with tag `checkpoint/before-app-motion-2026-10-15`.

## Scope and audit

| Area | Change / disposition |
| --- | --- |
| Global tabs and stack | Preserve mounted tab state; UI-thread opacity transitions on focus; native stack transitions respect Reduce Motion. Selection haptics use Expo and defer to platform support. |
| Profile menu | Existing popup spring/glass/design retained. Conversation history is windowed with stable message IDs and bottom anchoring; no forced scroll-to-bottom on every content-size change. Submenu motion already uses UI-thread Reanimated. |
| Shared dialogs | ProductDialog and Home sheets now use UI-thread animation and Gesture Handler drag tracking. Handle/header drags track the finger and spring back when cancelled. Background fades with the panel. Removed delayed content reveal. Full-screen sizing stays within original geometry. |
| Home | Shared button feedback, interactive keyboard dismissal in sheets, UI-thread sheet motion. Calendar is a bounded grid, not an unbounded feed; existing layout and interactions retained. Weather/checklist/medication semantics unchanged. |
| News / PDF | Shared buttons/dialogs/collapsible changes apply to editors and readers using them. Native PDF retains its native rendering/zoom implementation; web PDF remains separate. No AI/upload/RSVP changes. |
| Work Orders | Memoized order cards, queue calculations and translations; stable expansion callback prevents sibling card renders on expansion. Keep cards mounted to preserve in-progress proof uploads and local drafts. Shared media viewer and dialog improvements apply. |
| Social | FlatList windows posts/listings (five initial/per batch, seven viewport window). Comment text and idempotency IDs survive recycling. Existing feed/card layout retained. |
| Images/video | Native image pinch/pan runs in worklets, with bounded scale/pan, double tap, accessibility zoom buttons and existing retry controls. Web keeps its existing zoom implementation. Video retains native controls. Media modal respects Reduce Motion. |
| Expand/collapse | Reanimated drives measured height and opacity instead of JS-driven height animation. First mount remains lazy; visited content remains mounted to retain input state. Height still incurs native layout work and must be profiled. |
| Rendering/data | Stable presentation context; Firestore query lifetimes follow identity/permissions, not cosmetic profile-object changes. Profile chat decoding reads current user data through an effect event. No collections/rules/permissions were changed. |
| Accessibility | One shared Reduce Motion subscription replaces per-component subscriptions and avoids stale asynchronous preference overwrites. Startup stays conservative until the OS preference is known. |

## Refresh rates and measurement status

- iOS explicitly sets supported `CADisableMinimumFrameDurationOnPhone=true`, per Reanimated guidance: https://docs.swmansion.com/react-native-reanimated/docs/guides/performance/ . This enables eligibility on ProMotion devices, not a guaranteed frame rate.
- Android uses supported native scheduling; no display-mode forcing, timers emulating frame rates, or unsafe feature flags. 144 FPS is an unverified target where hardware/OS/runtime permit it. Android can choose lower refresh rates for power/thermal reasons: https://developer.android.com/develop/ui/views/animations/adaptive-refresh-rate .
- Frame budgets are targets: 16.67 ms at 60 Hz, 8.33 ms at 120 Hz, 6.94 ms at 144 Hz. No physical-device FPS, dropped-frame, touch-latency or GPU measurements were available on this Linux host (no Android SDK/device or Xcode).
- Browser tool access to both previews is blocked by saved permissions. No screenshot-based or interactive browser verification is claimed.
- Bundle exports validate JavaScript/native-platform resolution only; they do not validate native module linking or runtime gesture behavior. New native development/release builds are required for Gesture Handler/Haptics and the SDK patch updates.

## Native acceptance protocol (remaining)

Use the baseline and final commits on the same physical devices, production-like builds, same accounts and data. Record hardware, OS, thermal state and low-power mode. Test one 60 Hz device, a supported ProMotion iPhone and a high-refresh Android device.

1. Build with `npx expo run:ios --configuration Release` on a Mac, or `npx expo run:android --variant release` with the Android SDK. Validate signing and native configuration normally.
2. iOS: record Instruments Animation Hitches/Core Animation plus Time Profiler. Android: record Android Studio System Trace / Perfetto FrameTimeline. Check actual app frame presentation, not only the display's refresh-rate counter.
3. Record at least 60 seconds per scenario, both cold and warm: rapid tab switching; every profile subview; a long inbox; Home calendar/sheets; large Social feed; Work Order expansion/upload; PDF paging/zoom; image pinch; video; keyboard show/hide.
4. Repeat during live Firestore updates, messages and uploads. Verify no draft loss, duplicate sends, role leakage, jumped scroll position or blocked dismissal while busy.
5. Report median/p95/p99 frame duration, missed deadlines/janky-frame percentage and touch-to-visible-response latency. Compare against the device's actual selected refresh period.
6. Repeat with Reduce Motion, large text, keyboard, app background/foreground, slow network, low-power mode and 60 Hz settings. Confirm the same visual design and functional controls.

## Checkpoints

- Navigation / high refresh eligibility: d360630
- Dialogs / sheet gestures: 8cc637e
- Media / expansion / button feedback: bd9f2f3
- Rendering / lists / subscriptions: 0e645a2
- Final regression checkpoint: the commit containing the completed verification section below.

## Verification

- TypeScript: passed, including final SDK patch updates.
- Native tests: 62 passed, including the accessibility-store race and shared-subscription tests.
- Profile nested-button regression: passed.
- Expo compatibility: dependencies up to date after supported SDK 57 patch updates.
- Android, iOS and web production bundle exports: passed (`expo export --platform all --max-workers 2`). Hermes bundles generated for both native platforms.
- Expo web preview restarted on port 8082; browser interaction remains unverified due to the saved tool permission block.
- Full lint: passed with zero errors and one existing emulator unused-variable warning. Generated PDF vendor files excluded; CommonJS build-script Node global declared.
- The native text test now excludes platform-specific `.web.tsx` files, whose HTML text is valid; no application behavior was changed to silence that test.
