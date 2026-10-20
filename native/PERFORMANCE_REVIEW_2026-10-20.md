# Local performance review — 2026-10-20

Recovery: d08d6a8 restores the shared creation dialog to the known working implementation. No pushes, OTA releases, APK builds, Firebase rules or schema changes in this pass.

## Implemented
- Shared Firestore collection subscriptions decode only added/modified documents and evict removed documents. Unchanged row objects retain identity; cache belongs to the subscription and is discarded on auth/query changes.
- Work Order queue positions are calculated once per list update instead of a filter/search per card. Existing queue order is retained. Cards no longer receive the entire changing array; action callback is stable. Expanded editors and their local state remain mounted.
- Social builds one ID/email avatar index per directory/user update, preserving first-match/current-user precedence and historical avatar fallback. Posts, listings and chat sorting are cached across unrelated screen updates. Mutable reaction membership has explicit revision invalidation.
- Profile directory sorting/filtering is cached independently of navigation, input and animation state.
- Shared keyboard scroll containers skip scheduling native measurements when there is no focused input (and on web).
- News and shared success toasts no longer restart animation/dismissal timers merely because a parent callback changes identity. Uses installed React 19.2 Effect Events; visual timing unchanged.

## Audit coverage and deliberate preservation
- Home: native-driven entrance; UI-thread weather loops already stop on unfocus/background and respect Reduce Motion. Startup uses existing native video, pauses in background, releases on unmount and does not impose a minimum wait. Preserved.
- News: native-driven feedback animations; PDF/media code and publication/analysis paths unchanged. Shared live-collection optimization applies where used.
- Work Orders: repeated queue calculations and invalidated row memoization addressed. Long lists still mount cards: virtualization deferred because these cards retain editable draft/translation/upload state. A safe state-preserving virtualization design needs separate device validation.
- Social/Marketplace: existing FlatList (5-row batches, window 7) retained; data preparation optimized. No aggressive clipping (would risk shadows/expanded content).
- Profile: existing Reanimated open/close/subview transitions and virtualized conversation messages preserved; directory computation optimized.
- Dock/navigation: existing UI-thread selector and fade transitions, measured tab positions and one-per-change haptics retained. No screen remount/freeze changes.
- Creation sheets: recovered ProductDialog retained for all three forms. No deferred native-event reads reintroduced. Further spring/height/gesture tuning intentionally deferred until actual Android opening/keyboard/closing checks are available after the previous regression.
- Authentication/keyboard: existing resize, safe areas and focused-field reveal retained; idle scheduling removed. No authentication changes.
- Images/video/PDF: existing sizing, native decoding and upload compression preserved. No full-resolution replacement/cache dependency introduced without device memory evidence.
- Native config: generated Android configuration has Hermes and New Architecture enabled; iOS CADisableMinimumFrameDurationOnPhone=true. No app-level forced frame cap added/found in inspected animation configuration. Actual display refresh is OS/device controlled, not verified here.

## Evidence and limits
- TypeScript passes; focused lint has no errors (existing keyboard component type/value-name warnings remain).
- 20 focused Social, Work Order, subscription and role/keyboard tests pass.
- Local Node 24/Linux synthetic benchmark: 1,000 residents, 5,000 avatar lookups, 5 warmups, median of 15 samples, identical outputs. Previous search 25.97 ms; indexed lookup including index creation 0.37 ms. This is CPU lookup time, NOT render time or FPS and not measured under Hermes.
- No physical-device FPS, UI-thread drops, native heap, thermal or GPU measurements available. 120 Hz / 8.33 ms remains a target, not an achieved result. Browser access remains blocked by saved permission policy; no end-to-end form submissions were performed.
- Phone review: open/type/expand/collapse/close all three forms; scroll long feeds; receive live updates during scrolling; show/dismiss keyboard; check avatar/reaction changes and reduced motion. Capture Android Perfetto or iOS Instruments traces in a release-like build before claiming high-refresh results.

All application changes use existing installed dependencies and are OTA-compatible with the current matching runtime. No new APK required. No backend deployment required.
