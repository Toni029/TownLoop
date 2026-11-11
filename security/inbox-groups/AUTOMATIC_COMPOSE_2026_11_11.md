# Automatic Inbox composition after departure

Local changes only, continuing `749157a`. No deployment, resident-data mutation,
rules change, notification change, cleanup activation, push, OTA or build.

## Confirmed cause and correction

The existing current-v3 private route already creates a new immutable generation
when either member leaves. Eight new synthetic cases initially passed for either
initiator with Resident/Admin/VIP/Crew peers. Three failing cases isolated the
remaining blocker: normal compose attempted legacy conversion and returned a
`legacy-review` error for protected Office/Crew history or ambiguous private
histories. The UI exposed that historical-access decision and a manual retry button.

Normal `create` now retains safe, unique legacy reuse but falls through to existing
transactional, independently authorized fresh creation when historical conversion
explicitly requires legacy review, or several old histories cannot be selected
safely. Authentication, blocking, invalid recipient and transport errors are not
swallowed. Explicit `upgradeLegacy` remains protected. No old history, source,
attachment URL, notification preview or membership is copied by the fresh path.

The same server-only route transaction serializes both initiators and retries:
active private pairs reuse their current thread; any departed private pair receives
new conversation/membership records. The remaining old private membership still
reads its own permitted history, read-only. The departed membership stays revoked.
All-left queues, timestamps, holds and evidence are unchanged. Initial membership
creates no join event. Existing Office/Crew roles, group additions, epoch visibility
and explicit-staff-leave protection remain unchanged.

Normal composition now always uses `create`, without warning/fresh-choice state.
An old read-only thread is identified inline as “Previous conversation · Read-only”.
The separate historical-thread recovery action still starts normal composition.

Existing Rules already deny client membership/message/route writes and require
active authorized membership plus message visibility epochs. No Rules change is
required for this correction. Current group messages remain text-only. Existing
historical media remains protected/quarantined under its prior policy; this change
cannot revoke previously copied Storage bearer URLs and does not rotate tokens.

## Actual retention policy and read-only production check

`functions/inbox-retention.cjs` uses **six UTC calendar months** without a genuine
message, then a **30-calendar-day grace period starting at detection**. Empty threads
use creation time. Final departure starts a full **30-day grace period**; retrying
leave does not extend it. Activity can cancel inactivity grace before a cleanup
claim, but never restores departed memberships or reopens a private read-only pair.
Evidence/legal holds, reviewed inventory and separate cleanup authorization remain
required. There is no blanket 90-day deletion rule.

A successful read-only Firebase Functions inventory on November 11, 2026 in project
`cc-livingcommunity-app` returned 27 functions; neither `monitorInboxRetention` nor
`cleanupExpiredInboxConversations` is deployed. Their prepared schedules are hourly,
with separate `INBOX_RETENTION_MONITOR_ENABLED` and
`INBOX_RETENTION_CLEANUP_ENABLED` flags default OFF. Scheduled Inbox retention
cleanup is therefore not operational; dates are eligibility deadlines, not proof
of actual deletion. No schedules, jobs or resident records were inspected/modified.

## Focused verification

- New failing reproduction: 8 passed / 3 failed before correction; failures were
  protected Office/Crew conversion and ambiguous private history.
- 72 distinct focused synthetic checks passed (69 initial selected checks, then
  the 3 added legacy-one-left/authorization cases). Covers two-way creation/send,
  active reuse, one/all departures, concurrent requests, no old-history copying,
  read-only preservation, blocked/unauthorized rejection, existing retention and UI.
- 7 real local Firestore-emulator scenarios passed, using unchanged Rules loaded
  before requests, synthetic `demo-townloop-inbox-regression` data and actual
  server transactions. Includes direct reads after revocation, outsider denial,
  server-only routes, membership epochs, Office/Crew and both single-leave starters.
- Native TypeScript passed. Targeted lint matches HEAD:
  three pre-existing errors (two purity and one effect-state) and one dependency
  warning; no new findings. Unrelated ProfileMenu behavior is left unchanged.
- No physical-phone or deployed-fix verification claimed.

## Required approved release

Deploy only `manageInboxConversation` and ship the compose/list UI through a
runtime-compatible Production release. No Inbox Rules/index/Storage/notification
worker deployment is needed. Preserve backend feature flags. The prior commit's
shared quota dependencies must accompany its backend source; do not deploy an
incomplete old package. This Inbox change itself introduces no native dependency.
The earlier, separately prepared App Check module still requires the next planned
AAB: do not override the installed runtime or claim the entire native-changing
branch can be sent as an incompatible OTA. Retention activation remains separate.
