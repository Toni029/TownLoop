# Existing native lint diagnostics: risk classification — 2026-11-05

Evidence: reused `/tmp/townloop-launch-eslint.txt`, exactly **49 errors and 31 warnings**. No new lint audit was run. Counts are diagnostics, including repeated findings on one Animated expression, not independent defects. Source was inspected against baseline `9c0d5da`; later working fixes may shift lines.

## Triage result

No confirmed P0/P1 native safety defect was established by these diagnostics. No native source, startup, rules, worker or dependency changes were made by this workstream. Keep the lint status visible as failing; do not suppress the entire rule set or call the check clean.

| Rule group | Errors | Warnings | Action |
|---|---:|---:|---|
| `react-hooks/refs` | 30 | 0 | Review compiler/concurrent-render suitability; many occurrences are Animated values or current-account guards |
| `react-hooks/set-state-in-effect` | 13 | 0 | Confirm bounded updates and stable dependencies; preserve deliberate subscription/notification resets |
| `react-hooks/purity` | 3 | 0 | Distinguish actual render randomness from event-only IDs; timestamp rendering is a separate deterministic-render improvement |
| `react-hooks/immutability` | 1 | 0 | The reported setter is referenced by a deferred effect, not synchronously before declaration |
| `react/no-unescaped-entities` | 2 | 0 | JSX copy escaping; no authorization/crash evidence |
| `react-hooks/exhaustive-deps` | 0 | 17 | Investigate stale account/authorization/async callbacks first; then narrow stable dependencies |
| array types / require imports | 0 | 6 | Style and platform-specific module-loading review; do not replace guarded native requires blindly |
| duplicate imports / type-value redeclarations / unused vars | 0 | 6 | Low-risk cleanup; shared exported type/value names are legal TypeScript |
| import order / conditional unused expression | 0 | 2 | Formatting/style; PDF transfer ternary deliberately invokes resolve/reject |
| **Total** | **49** | **31** | |

## Security-sensitive findings inspected

- `notifications/usePushDocument.ts:14–27`: render-updated account ref feeds late snapshot guards; immediate return also requires current readiness and matching UID. The subscription has active cleanup and compares UID/readiness. The effect state resets are bounded. Moving the ref update to a later passive effect solely to satisfy lint could leave an authorization-stale callback window. Preserve this defense until a behaviorally verified equivalent is designed.
- `notifications/InboxPushProvider.tsx:26,89`: current account/readiness refs are used after awaits and before presentation/navigation. UID/approval guards, epoch checks, auth-transition clearing and revocation remain. Lint does not demonstrate unauthorized notification delivery; the backend independently authorizes. Do not refactor working notification state for an unproven lint benefit.
- `profile/AccountDeletionRequests.tsx:17–42`: async results and approval UI use epoch checks, operation lock, canonical manager projection and account-key visibility. Account changes invalidate results; original independent backend review remains authoritative. Ref-cleanup dependency warnings alone do not establish self-approval or cross-account disclosure.
- `profile/InboxParticipants.tsx:32–62` and parent `ProfileMenu.tsx:2021`: participant controller is keyed by UID/category/thread. That remount prevents its retained resolved ID from targeting a different selected conversation; generation/active checks reject old roster results. Do not report a stale-ID bug without this parent context.
- `profile/groupInbox.ts:19–76`: account-key and message key/epoch projections prevent displaying a previous account's rows; listeners have active cleanup. Missing dependency suggestions involving full profile/thread objects need careful narrowing. Maintenance-status sync rechecks on status change could be improved separately, but no launch-critical failure was reproduced.
- `components/PrivateImage.tsx:15–52`: the warning concerns a captured `onError` callback. Actual bytes are protected by auth/generation guards, per-UID cache paths, cleanup and render-time UID/source matching. No bearer fallback is introduced. A callback ref/destructure improvement is optional after a targeted stale-callback test.

## Compiler/style findings that are not confirmed launch safety bugs

- `shell/TownLoopShell.tsx:146`: `setMenu` is captured inside `useEffect`; React executes it after render has initialized the setter. This is not an actual synchronous temporal-dead-zone crash. Moving the effect below state declarations is a possible clarity/compiler cleanup, not a P1 fix.
- `profile/ProfileMenu.tsx:414–416`: `Date.now` and `Math.random` generate a pending message ID only when send handlers invoke `messageId` (call sites around 702 and 2246), preserving retry identity. Do not replace it with per-render IDs to silence purity diagnostics. `SocialFeed.tsx:214`'s default timestamp is a deterministic-render improvement, not demonstrated data corruption.
- `development/PreviewUpdateNotice.tsx` and `profile/DeletionRequestSuccess.tsx`: repeated refs diagnostics derive from `useRef(new Animated.Value(...)).current` and interpolation in JSX. These need an explicit compiler-compatible animation pattern if the relevant compiler is adopted; they do not independently establish a crash. Reduced-motion state resets are bounded by dependency changes.
- `news/PdfReader.tsx:68` keeps latest config for a later effect/timer; do not change the edition/download lifecycle without its existing cancellation/edition tests. `news/pdfTransfer.ts:45` deliberately resolves or rejects the waiting promise; converting the ternary to if/else would only satisfy style.
- Social/Work Orders notification effects intentionally open the authorized target and consume it. The suggested full `push` object dependency changes every provider render; blindly adding it can increase reruns. Prefer stable destructured callbacks only during separately tested maintenance.
- All five diagnostics in `components/ApprovedStartup.tsx` remain explicitly out of scope. They are recorded, not changed or re-audited. No startup behavior fix is proposed.

## Per-file inventory from the saved output

| File | Errors | Warnings |
|---|---:|---:|
| `src/components/ApprovedStartup.tsx` | 3 | 2 |
| `src/components/PrivateImage.tsx` | 0 | 1 |
| `src/components/SafetyActions.tsx` | 1 | 0 |
| `src/components/media.ts` | 0 | 2 |
| `src/development/PreviewUpdateNotice.tsx` | 8 | 1 |
| `src/keyboard/KeyboardScrollView.tsx` | 0 | 2 |
| `src/lib/accountDeletion.ts` | 0 | 1 |
| `src/lib/googleSignIn.ts` | 0 | 1 |
| `src/localData/nativeStorage.ts` | 0 | 1 |
| `src/news/PdfReader.tsx` | 1 | 0 |
| `src/news/pdfTransfer.ts` | 0 | 1 |
| `src/notifications/InboxPushProvider.tsx` | 2 | 0 |
| `src/notifications/device.ts` | 0 | 1 |
| `src/notifications/usePushDocument.ts` | 3 | 1 |
| `src/profile/AccountDeletion.tsx` | 2 | 0 |
| `src/profile/AccountDeletionRequests.tsx` | 1 | 2 |
| `src/profile/DeletionRequestSuccess.tsx` | 19 | 0 |
| `src/profile/InboxParticipants.tsx` | 1 | 3 |
| `src/profile/ModerationPanel.tsx` | 0 | 1 |
| `src/profile/ProfileMenu.tsx` | 3 | 1 |
| `src/profile/groupInbox.ts` | 0 | 2 |
| `src/shell/TownLoopShell.tsx` | 1 | 0 |
| `src/social/SocialFeed.tsx` | 1 | 1 |
| `src/social/SocialScreen.tsx` | 2 | 3 |
| `src/workorders/WorkOrdersFeed.tsx` | 1 | 2 |
| `src/workorders/model.ts` | 0 | 2 |

Next action: prioritize a focused regression only when a concrete stale-account, navigation or repeated-render failure is reproduced. Cosmetic/compiler cleanup can follow under its own reviewed scope. No bulk autofix or blanket rule disabling is proposed.
