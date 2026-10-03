# TownLoop visual parity review

Recovery points: `checkpoint/functional-bd73527` preserves the functional migration; `checkpoint/pre-visual-8d19ad0` also preserves the subsequent native console fix. Both tags are pushed. All visual work follows the latter commit on `native/expo-migration`. Main and all backend rules/data remain untouched.

## Global shell checkpoint

Restored the shared resident greeting, original typefaces/weights, date hierarchy, profile-avatar styling and role artwork; the beige application gradient; and floating four-tab glass dock, original icon/label order and spring indicator. Retained account navigation and Home's appearance toggle in the avatar menu. Native blur captures the active scene independently from the dock; older Android versions receive the translucent gradient fallback. Safe areas and keyboard visibility are respected. Native feed containers now allow the shell background through and reserve room beneath the floating dock.

Validation: TypeScript, lint and all 34 regression tests pass. Matching 390×844 rendered comparisons were inspected for all four tabs, with zero console/runtime errors in isolated fixtures. The fixtures import actual product components and never write production data. Font and device rendering, blur performance, screen-reader focus and touch handling still require Android/iOS device acceptance.

## Home + News checkpoint

Matched the web weather hierarchy, forecast pills/strips, decorative sun rays and backgrounds; medication card/bottle/actions; checklist header, filters and compact rows; recurring calendar/header controls and activity containers; and Home sheet typography. Touch areas remain larger through invisible hitSlop. Matched News publication card gradient/glow, typography, button silhouettes, badges, selector sizing, RSVP cards and pinned notices. Existing Home stores, recurrence rules, newsletter availability/removal and Firebase actions are unchanged.

Validation: TypeScript/lint and 34 regression tests pass; Home's seven interaction flows (including medication actions, resident-isolated persistence and December/January recurring reminders), News's 16 role/editor/size checks and 18 newsletter-state checks pass without console/runtime errors. Comparison screenshots use equal dimensions and isolated fixtures.

## Work Orders + Social checkpoint

Matched Work Orders mode pills, request gradient/button height, compact ticket geometry and monospace fallback, category pills, translator/expansion controls and card rows. Matched Social feed selectors, post card spacing, avatar gradients, reactions/comments controls, marketplace title hierarchy, availability/price pills, glass sold toggle and sold thumbnail overlay. Restored creation sheets' bottom placement, full-screen shape, compact headers, motion timings and drag intent using native views. Existing submission guards, permissions, queue calculations, listeners and Firebase actions are unchanged.

Validation: TypeScript/lint and 34 regression tests pass. Work Orders' 28 and Social's 40 existing layout/role/form/comment/inbox checks pass. Resident screenshots for feed and marketplace were compared to the rendered web reference at 390×844. No connected Android device is available; gestures, native blur, keyboard and native media/PDF acceptance still need physical-device testing.

## Final rendered review checkpoint

The final review includes light and dark versions of every main tab, the marketplace, recurring calendar, pinned News, expanded ticket and Work Orders/Social creation sheets. Corrected dark surfaces/text, category icons, pinned badges, glass highlights, sheet content sizing, form spacing and upload targets after inspecting the rendered comparisons. The existing camera action remains a compact icon beside the upload target. Full-screen sheets retain the grab handle. The shell reads existing `avatar_url`/`avatar` fields as well as legacy photo fields so a saved resident photo is displayed.

### Checkpoints

| Milestone | Commit |
| --- | --- |
| Shared shell and navigation | `f01bc17` |
| Home + News | `673b82e` |
| Work Orders + Social | `96ec0f9` |
| Final review, dark parity and screenshot evidence | The final commit containing this document, tagged `checkpoint/visual-parity-2026-10-03` |

All checkpoints are on `native/expo-migration`. The functional recovery tag remains `checkpoint/functional-bd73527`; `checkpoint/pre-visual-8d19ad0` includes the native raw-text console fix. Main remains `a6567cdcbfaa578dd10a89b8c259a5650d5a0a76`.

### Rendered evidence and method

Screenshots are in [verification/visual-parity](verification/visual-parity/README.md). Each source image is 390×844. The comparison images place the web reference on the left and the actual native component tree rendered by Expo's web preview on the right. These are browser captures, **not Android/iOS device screenshots**. Both versions use October 3, 2026 in America/New_York, matching isolated content and deterministic weather responses. The Home comparison supplies equivalent medication metadata to the disposable screenshot browser only; there are no seeded medications or other sample records in the production native app. The harness imports real screens, controls and dialogs. It does not replace them with drawn mockups or embed the web app inside the native app.

Initial screens and the scrolled calendar, pinned notices, marketplace and creation sheets were inspected side by side. Existing interaction checks also exercised resident/admin/crew states and 320/390/768px layouts. Reduced motion was used for static captures; normal-motion form opening/expansion is covered by the existing interaction checks, with tactile acceptance still pending on devices.

### Final validation

- TypeScript and lint pass without lint warnings; all 34 regression tests pass.
- Home's seven existing interaction flows pass, including medications, task persistence, December/January recurrence reminders, filters, dark appearance and the small-screen sheet.
- News's 16 role/editor/size checks and 18 uploaded/missing/removed/legacy metadata checks pass.
- Work Orders' 28 and Social's 40 role/layout/form/comment/inbox/empty-state checks pass.
- News's 28 and Work Orders/Social's 30 local Firestore emulator checks pass, including existing permissions, concurrency guards and newsletter removal. These scripts load the repository's actual rules into a disposable demo project and never access production data.
- Expo dependency check passes; Expo Doctor passes all 21 checks. Android and iOS Hermes bundle exports succeed.
- No browser-only UI APIs or WebView were introduced into native source. Native raw-text regression passes. Existing listener/store/action modules are unchanged; 11 async UI upload/submission/status/comment/message handlers structurally match the pre-visual checkpoint.
- No root web source, Firebase configuration, Firestore/Storage rules, schemas, authentication/approval logic, local persistence models or recurrence rules were changed.

### Remaining differences and device acceptance

Native blur/reflections, gradients, shadows and weather artwork approximate the original CSS filters and procedural effects. Native blur cannot reproduce the web dock's combined saturation/contrast/brightness filters exactly. Android below API 31 uses the translucent gradient fallback; Android 31+ uses the dedicated blur target. Font rasterization, emoji and platform monospace ticket lettering will vary. Long ticket categories use native ellipsis with a complete accessibility label instead of CSS clipping.

Small differences remain in text wrapping, card heights and content-derived sheet sizing. The existing native ticket status/time metadata remains visible beneath the location; preserving it keeps functional information from the recovery checkpoint. Existing native placeholder copy and the camera shortcut remain; form values, labels, submission actions and permission checks are retained.

Physical Android/iOS acceptance is still required for safe areas, enlarged text, screen-reader focus, blur capture during tab switches, keyboard avoidance, touch targets, drag/full-screen sheet motion and performance. The native PDF reader, media picking/camera, sharing and upload/download also need device regression testing; this phase did not alter their backend or reader implementation. No connected Android device or iOS simulator was available here.

Pre-existing backend limitations are unchanged: newsletter AI needs the documented secure deployed service; resident RSVP remains blocked by the existing manager-only Firestore rules; translation uses the existing local native fallback until the secure endpoint is available. Passing regression checks preserves these documented baseline behaviors and is not a claim that those deferred backend capabilities are enabled.

This phase adds no product features. Work stops at the visual review checkpoint for owner review.
