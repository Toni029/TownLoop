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
