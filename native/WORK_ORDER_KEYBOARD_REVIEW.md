# Work order permissions, retention, dock, and keyboard review

**Release status (2026-10-16):** After user approval, the Firebase rules, index, and scheduled cleanup were deployed and verified. The Android Preview OTA was published. See [release record](RELEASE_2026_10_16.md). The review-stage deployment notes below describe the pre-approval state.

Recovery: `checkpoint/before-workorder-permissions-keyboard-2026-10-16` → `77535f8`.

## App changes

- News bubble remains centered on the actual tab layout. Its width uses measured label space and adjacent label edges, including the existing selected scale. Other tab sizes and springs are unchanged.
- All numeric ticket identifiers display with `WO-`. Dotrice Bold remains bundled; text alone is sized to the original ticket interior. Database codes, document IDs, counters, permanent reservations, and the 1000–9999 atomic allocator are unchanged. Historical five-digit identifiers remain visible in full rather than being renumbered.
- Translation buttons appear only for approved Admin, VIP, and Crew profiles. Translations remain separate from original content. The web translation endpoint now authenticates Firebase tokens and checks saved roles. Direct browser calls using a Google API key were removed; the authenticated server and local fallback remain.
- Admin/VIP may delete any ticket. Crew may never delete. Residents may delete only their own unfinished tickets. The shared helper controls both clients, and proposed Firestore rules enforce these constraints against direct database requests.
- Completion requires a new nonblank crew note; photos remain optional. The note and appended comment are saved atomically with `completedAt: serverTimestamp()` and `retentionVersion: 1`. Completed cards retain their existing gray appearance. Reopening clears completion/retention fields in a transaction. Timestamp objects are normalized for display.
- Shared focus-aware inputs and scroll views measure the visible viewport and scroll the focused field above the keyboard. Applied across Home, News, Work Orders, Social dialogs, marketplace chats, profile/menu forms, authentication, and account forms. Android modal avoidance, bounded profile-panel height, and PDF page-input avoidance were added. Existing Android resize mode, safe areas, and keyboard dock hiding remain.

## Backend proposal — NOT DEPLOYED

The current live rules still permit Crew deletion. Hiding buttons alone does not close that gap. Deployment is required for enforcement.

1. Deploy the prepared `firestore.rules`: role/ownership deletion, protected completion fields, required crew note, trusted completion timestamp, and safe reopening. Unrelated collections are unchanged.
2. Deploy the additional `work_orders` index on `retentionVersion` and `completedAt`.
3. Deploy `cleanupCompletedWorkOrders` from the isolated `work-order-retention` Functions codebase. It runs hourly using Firebase's supported scheduled-function API: https://firebase.google.com/docs/functions/schedule-functions.
4. Restart/deploy the existing API service to activate the translation endpoint authorization. No new service-account key is placed in either client; the scheduled function uses managed server credentials.

The job queries completed timestamps at least 30 days old and re-reads each candidate inside a transaction. It checks the current status, timestamp, and retention marker before deleting. Reopening or recompletion causes a transactional retry and a fresh eligibility check. Repeat/overlapping runs are idempotent. An hourly schedule means removal normally occurs between 30 days and 30 days plus one hour; outages/backlogs can delay deletion, never make it early.

The job deletes only the qualifying `work_orders` document. Existing comments are embedded in that document. It does not delete Storage objects (`work_orders/...`), number reservations, or other collections. No existing work-order audit collection or attachment lifecycle was found in repository code. Cloud logs record the removed document ID, without resident text or photos. Photos remain stored after ticket deletion; automatic attachment cleanup is deliberately excluded.

Historical tickets lacking the new trusted retention marker are excluded. No historical records were changed or deleted during testing. Reopening and completing one again starts a fresh valid retention period.

Deployment requires a billing-enabled Firebase project and Cloud Scheduler/Functions access. This proposal is prepared locally only. Do not deploy automatically.

### Rollout and recovery

Coordinate the new client rollout with rules activation: older APKs send client-formatted completion times and will fail the stricter completion rules until they receive the new client. No APK rebuild is expected: existing native modules and keyboard resize configuration are reused. Confirm the installed runtime fingerprint before an approved OTA publication.

Deploy the index before enabling the scheduler; activate strict rules before allowing the cleanup job to run. Confirm updated crew clients are active. Schedule activation is separate from GitHub pushes and OTA publication.

To stop future automatic deletion, pause the scheduler. Deleted documents are not recoverable from Git; recovery would require an existing Firestore backup/PITR policy. Do not reset the work-order counter or delete permanent number reservations during rollback. Reverting to permissive rules would reopen the deletion vulnerability.

## Validation and limits

- Native TypeScript, lint, and Expo dependency compatibility checks passed.
- All 82 native unit tests passed, including all four roles, owned/other tickets, prefixed examples, enlarged neighboring labels, keyboard geometry, and note-only completion.
- Disposable Firestore emulator passed concurrent numbering, historical reservation skips, exhaustion, role deletion denial, forged completion rejection, trusted timestamp completion, and reopening. Live Firebase was not modified.
- Server tests passed translation authorization and retention boundary/idempotency checks. The actual scheduled handler also passed against a separate disposable Firestore emulator project: expired-only deletion, preservation of reopened/recompleted/historical/unrelated documents and reservations, and an idempotent second run.
- Android JavaScript/assets export passed. No APK was installed or tested here.
- Web TypeScript has 32 pre-existing errors; comparison against the recovery checkpoint found no new errors. Missing local React type resolution was restored in ignored node_modules for the comparison; no root dependency manifest was changed.
- Browser automation remains blocked by saved permission. Physical-device keyboard/cursor behavior, modal resizing, large-font layouts, and visual spacing still need Android/iOS review. Static measurements and exports do not establish device-level usability.

No GitHub push, EAS update, production rules/index deployment, or scheduled-function deployment has been performed for this task.
