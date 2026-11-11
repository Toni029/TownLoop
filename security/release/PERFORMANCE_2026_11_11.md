# TownLoop native performance pass — 2026-11-11

Baseline: `fe3062c`, branch `native/expo-migration`. Local changes only; no cloud operations, live-data changes, builds, pushes or releases.

## Evidence and limits

ADB was available but `adb devices -l` reported no attached device. This pass cannot establish the Samsung's thermal root cause, battery drain, CPU/GPU utilization, frame rate or memory usage. No such improvement is claimed. The measurements below execute the actual source with controlled lifecycle/timer/network boundaries; they establish avoidable work, not watts saved. Before changes, all four original lifecycle regression tests failed; their measurements were captured before editing implementation.

| Controlled workload | Before | After |
| --- | --- | --- |
| Weather timer callbacks during five background minute ticks | 5 | 0 |
| Weather poll intervals after card leaves viewport | 1 | 0 |
| Offscreen weather animation gate | Active | Paused |
| Legacy Inbox scans during ten background 30-second ticks | 10 | 0 |
| Coincident initial membership snapshot/bootstrap legacy scans | 2 | 1 |
| Device registrations over five resumes, unchanged granted permission | 10 | 5 |
| Initial device registration in that same fixture | 2 | 1 |

Weather cache lifetime remains 45 minutes: those five old weather timer callbacks were **not** necessarily five network fetches. Initial snapshot coalescing applies to overlapping calls; a later genuinely changed snapshot still refreshes. Actual mobile OS timer throttling differs from the controlled clock.

## Focused changes

- Home measures weather-card intersection with its scroll viewport, including content padding and orientation/layout changes. An external store notifies React only at visibility boundaries; scrolling does not set state on every event. Unknown initial measurements remain visible to avoid delaying first rendering.
- Weather polling runs only when the tile/tab is visible and app active. Background/blur/unmount aborts outstanding requests; aborted/stale responses cannot update cache/state. Foreground return refreshes expired data; existing cache, timeout and retry UI remain. A timeout is still surfaced as an error.
- Clouds/snow keep identical trajectories, textures, speeds and counts; their cycle phase is preserved across pause/resume. Existing wet-glass/rain frame clock and lightning scheduler receive the same lifecycle gate. Existing reduced-motion behavior and clipping remain. No weather effect, image quality or shader was reduced.
- Legacy Inbox fallback polling is foreground-only, with one request in flight. Active-membership/message Firestore listeners remain live. Resume catches up; account changes dispose old polls/listeners and reject late results.
- Native notification permission handling stays independent of login. A changed OS permission still requests reconciliation. Unchanged permission no longer schedules a second registration in addition to the normal resume sync. Token refresh, category choices, delivery, authorization and badges are unchanged.

## Scoped review and verification

History review traced weather work to the existing weather implementation and recent `c9e80a0` effects, and notification preference handling to `778a9aa`. Reviewed direct call sites: one Home weather entry, one WeatherAtmosphere entry, one useGroupInbox call through profile data, and one root InboxPushProvider. The new foregroundPoll has two production callers (weather and legacy Inbox). No query, role, membership, notification recipient filter, rules, endpoint or backend code changed.

Inspected the adjacent shared collection subscription lifecycle, Social FlatList settings, explicitly opened media viewers, PDF memoization/cache disposal, and focused Work Order queue polling. No measured defect justified changing those paths. This is not a claim of device-proven memory or rendering efficiency.

Verification:

- 9 new source-executing lifecycle tests pass: background/offscreen polling, atmosphere gate, duplicate registration, viewport edges, phase-preserving resume, repeated foreground/offline transitions, abort/stale weather result, and late account bootstrap disposal.
- 47 existing focused weather/motion/notification tests pass (56 distinct targeted tests overall). Includes drizzle/rain/heavy rain/storm model coverage, wet-glass geometry/clip behavior, storm cancellation, reduced motion, notification settings/queue/device/payload behavior.
- Native TypeScript passes.
- Changed-file lint: two errors and two warnings, reproduced unchanged from HEAD in the provider/group files (render-time session ref assignment, synchronous state clearing, two pre-existing dependency warnings). Other changed production files lint clean. No unrelated lint refactor was performed.
- Native Babel compilation confirms the resumed weather-cycle callback is compiled as a Reanimated worklet.
- `git diff --check` passes. No modified visual assets, particle geometry, cloud rendering, startup, PDF, Gemini, native dependencies or build configuration.

Confidence: high for controlled lifecycle/call-count corrections; actual native visual continuity, GPU impact, physical notification delivery and phone thermal behavior remain device checks. No real backend traffic was generated by tests.

## Device acceptance / before-after measurements still required

Use the same Samsung, app account, brightness, network, battery range and weather conditions. Close the old Preview installation and use the Play internal release without a development server. Compare five minutes each of: visible idle Home; Home scrolled past weather; other tabs; normal feed/Marketplace scrolling; PDF open/close and repeated navigation; messaging; background/screen-off; return to Home. Repeat relevant lifecycle/navigation cases on an iPhone release build.

Record Android CPU activity, process memory, rendered-frame/jank counts and thermal status with available device profiling, plus Samsung battery usage over a comparable longer interval. Confirm no animation jumps, duplicate lightning timers, lost unread updates, duplicate notifications or account-crossed results. Check drizzle, light/heavy rain, storms and reduced motion. The visible Home scene intentionally still renders its full-quality animation; no reduction in its steady-state GPU cost has been demonstrated.

## Release compatibility

Locally generated Android fingerprint using the existing Production Firebase/signing environment helper:
`d0d315f570703b0202fb2f0defad872bdb5169fe`.

Matches the recorded installed Google Play AAB `c3caf877-2b29-4764-b1ee-21beb482c5ca`, package `com.townloop.app`, Production channel. Changes are compatible with a **Production OTA**; no AAB, native dependency, Firebase deployment or rule change is required. Preview is a separate channel/runtime. iOS source is shared, but physical iPhone verification and that binary's own runtime check remain necessary. No release was performed.
