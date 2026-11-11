# Native Inbox message receipts — November 11, 2026

Scope: private/Office/Crew native Inbox only, no Marketplace, notification delivery,
startup, resident-message rewriting, deletion/retention activation or security-rule
changes. Continues the automatic fresh-conversation correction from `140ba00`.

## Meaning and design

- Single gray check: a persisted message snapshot. Pending local writes show none.
- Double gray: every original recipient has acknowledged that exact message after
  actual authenticated message reception. Firebase saving, membership counters,
  FCM acceptance, notification arrival and old read watermarks are not delivery.
- Double blue: every original recipient acknowledged that exact message after it
  was viewable in the open foreground conversation (native minimum view time 600ms).
- Incoming messages never show outgoing checks. Existing icon sizes/style remain.

Groups use immutable send-time `visibility` audiences, excluding the sender. Later
joiners cannot see/ack old messages and do not count toward them. A recipient leaving
cannot turn a partial receipt into a unanimous receipt. New messages use their own
current authorized audience. This deliberately prefers under-reporting over false
Delivered/Read states when a recipient leaves or uses an older app without support.

The existing `manageInboxConversation` gains a bounded `receipt` action (50 IDs).
It rechecks canonical approval, role, active membership/epoch, exact message
visibility and cleanup fencing in a transaction. Client-supplied actor/timestamps/
status fields are ignored. All reads precede writes. Updates affect only receipt
metadata and the recipient's own monotonic cursors; no message body, sequence,
visibility, root activity timestamp, audience or history is rewritten. Duplicate,
concurrent and out-of-order device receipts cannot downgrade status or reset times.
A missing/unauthorized member in a mixed batch aborts everything atomically.

The always-mounted foreground Inbox membership listener triggers serialized, bounded
fetches of actual authorized message documents, then a delivery acknowledgment.
It does not acknowledge cached membership counters, notification events or a failed
fetch. One queued fetch per conversation, bounded retries and lifecycle cancellation
avoid new listeners per thread or background polling. Existing composite indexes
(visibility array + sequence descending) are reused.

Conversation viewability supplies exact read IDs, rather than marking every loaded
page read on open. Existing unread cursors/badge refresh are retained after server
confirmation. Receipt batches coalesce and prefer Read over Delivered. Failed
acknowledgments retain their evidence in account/conversation/epoch-scoped existing
AsyncStorage (message IDs + acknowledgment type only), survive restart, and retry
while foreground. No new native dependency or body/attachment cache is introduced.
Account/epoch changes dispose old queues. Background/closed notifications alone
remain Sent until the app actually receives/acknowledges the message; OS push
receipts are never represented as application delivery.

New capability `receiptsVersion:1` gates acknowledgments against older backends.
Unconverted historical Inbox rows returned by the server can show Sent; their old
`readBy` projections do not fabricate new read/delivery receipts. Legacy conversion
remains independently safeguarded. Receipt metadata on old native messages is only
updated when that authorized participant genuinely receives/views them, not by a
bulk migration or administrative rewrite. Existing bearer-link retirement limits
remain unchanged; no attachment, membership or Storage transition is activated.

## Focused verification and review

- 65 synthetic checks passed: backend status/authorization/idempotency/group
  aggregation, client queue/foreground/viewability/offline persistence/account
  switching, plus existing fresh-conversation and group behavior.
- Two real local Firestore-emulator scenarios passed using unchanged default Rules:
  actual transaction concurrency, direct client receipt forgery rejection,
  post-leave denial, fresh-history isolation and pre-join read/ack denial.
- Native TypeScript and new-module lint checked before commit/release. Existing
  ProfileMenu/groupInbox lint findings are unchanged; no unrelated refactor.
- Surgical differential review: one new action under existing callable auth;
  one existing message listener/UI call site; existing packagers add its module.
  No new public function, client write permission, push trigger or index. New
  receipts contain only already-authorized audience keys and server times.
- Physical Android/iPhone behavior is not verified by these checks.

## Approved release scope

Deploy only `manageInboxConversation`, preserving current environment/IAM/settings,
then publish one Android Production OTA after exact installed runtime comparison.
No rules/index/Storage/notification worker deployment or AAB is needed for this
feature. Keep the prior unshipped App Check/security rollout excluded: use the
previous runtime-compatible Inbox release source (`17ec765`) plus only this patch,
not an overridden fingerprint. Preserve pending security work on the main branch.

Phone acceptance: sender A sends while B is closed (single gray); B opens TownLoop
and receives bytes without opening chat (double gray); B opens chat and views the
message (blue). Scroll to older messages; ensure unviewed messages stay unread.
Repeat offline/reconnect, rapid sends, notification tap, second device, membership
leave/recreate, Office/Crew partial/all acknowledgment, Android and iPhone. Older
clients cannot confirm the new delivery/read semantics until updated. No real test
messages or push notifications are sent to residents during release preparation.
