# Native Inbox membership upgrade — LOCAL / NOT DEPLOYED

This extends the existing `(default)` Inbox and existing push infrastructure. It does
not change Marketplace, the website/named database, Auth roles, account deletion,
Storage rules/tokens, six quarantined objects, or notification delivery configuration.

## Stage A implementation

- `manageInboxConversation`: capabilities/create/add/sync/send/read/roster/leave and
  explicit non-destructive legacy cutover, plus atomic `leaveLegacy` cutover/leave. OFF unless `INBOX_GROUPS_ENABLED=true`.
- `inbox_conversations` stores no embedded history; server-owned
  `inbox_memberships` stores UID, epoch, join/leave times, reason and read watermark.
  Each message has an immutable audience of `uid:epoch` keys. A re-enrolled staff
  member gets a new epoch. Explicit leavers cannot be re-added by sync/add/create.
- Default DB rules permit only current approved members with current canonical
  roles; message queries MUST include `visibility array-contains uid:epoch` and
  order by sequence. Direct historical gets, unfiltered queries, forged events,
  member changes and client deletion are denied. Own mailbox projections contain
  no message preview; group titles are generic. Rosters show current members only.
- Transactional creation/reuse, idempotent send IDs and join/leave IDs, atomic
  member/message changes. Private threads become read-only when one person leaves.
  Every leave is one tap, including the final member; it only queues held cleanup.
- `revokeInboxGroupMemberships` handles trusted profile role/approval loss and
  removes individual memberships. Direct rules deny invalid roles immediately;
  asynchronous revocation is retryable and stale loss events cannot revoke a
  newer join. Maintenance sync occurs on open and before sending; no scheduler.
  Authorized additions receive only subsequent messages. Maximum 50 identities
  per group (including prior membership records); overflow fails rather than
  silently omitting staff.
- `notifyInboxGroupMessage` reuses existing registration, transport, preference,
  multi-device, blocking, recipient gates, opaque push destinations, expiry and
  deduplication. Both group and push gates default OFF. Only newly created genuine
  messages notify; system events and imported history never do. Recipient/sender
  authorization is checked again before sending. `registerInboxDevice` records group protocol support; older devices are excluded
  from group pushes until their compatible JS registers support. `getNotificationState` needs its
  compatible resolver/ack update. Other four category triggers are not redeployed.
- Native capability negotiation fails safely against the currently deployed
  backend; legacy Inbox remains the fallback. When Stage A is enabled, server
  legacy listing replaces permissive role-wide client queries. Group history is
  subscribed only for the selected thread, newest 100 first with earlier-page
  loading. Read watermarks acknowledge the displayed sequence, not later arrivals.
  UI state is scoped to account/role and cleared from presentation on auth changes.

## Existing conversations and exact historical ownership

No live migration was performed. Sources are retained with one server routing
marker; historical IDs/timestamps/bodies are preserved and never re-notified.
Legacy writes are fenced after cutover. Archive reads require an active ORIGINAL
membership epoch. New members cannot get the archive through direct old paths.
Legacy direct-deletion permission is removed in the Stage A rule candidate.

Supported automatic cutover requires exact two-party identityVersion 2 UIDs,
valid source messages and at most 150 messages. An Office-direct thread can become
an Office group only when exactly one current Resident and one current Admin/VIP
are verified. It preserves the old two-person visibility before additions.
Duplicate/colliding threads, oversized histories, unknown authors, legacy aliases,
and embedded attachments are held unchanged, not silently merged or truncated.

Old role-wide Office/Maintenance documents do NOT establish individual historical
membership. They require an independently reviewed, server-only
`inbox_legacy_authorizations/{sha256(source/id)}` manifest:
`sourceHash=sha256(JSON.stringify(exact original document))`, exact verified
`participantIds`, current Admin `reviewedBy`, documented `evidenceReference`, and
mandatory `expiresAt`. Ordinary clients cannot create/read these manifests. No
such manifest was invented or written. Staff with uncertain ownership remain
excluded; the generic failed-precondition response does not retry automatically.
This is a genuine legacy activation gate, not permission to guess ownership.

## Attachment limitation

The existing native Inbox is text-only. Stage A keeps it text-only and rejects
client attachment payloads. It does not remove existing data or copy token URLs
into new groups. `inbox-group-media.cjs` prepares a verified membership/message-
epoch authorization contract for an authenticated streaming adapter. No new group
upload/stream endpoint is exported or enabled yet. Future attachments require that
adapter and verified object/reference metadata; do not enable attachments first.
Previously issued Firebase download URLs are bearer capabilities and remain usable
by holders until separately retired; rules/UI cannot revoke those capabilities.
Historical media-bearing cutovers therefore remain held, preserving the six
quarantined files and all tokens. No photos were downloaded or inspected.

## Stage B safeguards

`inbox-group-cleanup-runner.cjs` is NOT imported/exported by ANY deployment entry
point, is not copied into the Stage A artifact, and defaults to disabled. It has
no scheduler. Final leave never invokes it. The prepared runner requires separate
code-level activation AND a live, expiring Admin-reviewed cleanup manifest proving
membership, complete media-reference inventory, evidence review, matching server
sequence, and exact legacy-source verification. Active/incomplete memberships,
report/legal holds, shared/quarantined/unverified media, changed object generations,
and unknown source ownership stop processing. The pure plan is always non-executing.

After a separately approved activation, the runner can resume bounded, idempotent
message/metadata cleanup and generation-conditional deletion of verified exclusive
`inbox_groups/{conversationId}/...` objects only. It never scans/deletes historical
Storage folders. Membership removal and root finalization are atomic. Interrupted
runs keep a content-free retry/review receipt and lease. Evidence holds require a
documented basis and approved expiry; no 400-day exception is introduced. Minimal
cleanup receipts expire after 60 days (future approved TTL/maintenance required;
no expiry worker/TTL was enabled). Prior legacy delivery receipts without target
metadata follow their existing expiry; never claim instant backup/offline erasure.

## Deployment dependencies / approval gates

1. Review/rebase the generated candidate against the CURRENT deployed default DB
   rule baseline. The local test baseline is the existing prepared chat-lifecycle
   candidate; it is NOT evidence of what is currently deployed. Do not overwrite
   unrelated current rules. Create only the three additive indexes in `indexes.json`.
2. Scoped Stage A functions ONLY: `manageInboxConversation`,
   `revokeInboxGroupMemberships`, `registerInboxDevice`, `getNotificationState`, and optional
   `notifyInboxGroupMessage` with group sending OFF. No old senders, scheduler,
   deletion module, account-deletion module, or retention worker in the entry point.
   `node security/inbox-groups/prepare.cjs <reviewed-default-baseline>` generates
   `.release/inbox-groups` locally; nothing deploys automatically. Preserve current
   private-message recipient scope/platform restrictions when later enabling groups.
3. Publish compatible shared JS after separate approval. No native dependency or
   manifest changes were made. Runtime must still be checked against the intended
   APK before OTA. iOS uses the same UI/queries but real push requires existing
   APNs credentials and a signed iPhone build; no device testing is claimed here.
4. Enable Stage A only after synchronized client/rule/backend verification and
   supported cutover review. Older clients cannot write migrated sources and must
   update; test that path before converting a real conversation. Unsupported legacy
   records remain intact and unconverted pending exact ownership/media evidence.
5. Group push activation requires its own explicit approval and eligible-device
   fixture/real-device tests. Stage B remains entirely absent from deployment until
   separately authorized and complete inventories/retention evidence are verified.

## Focused verification

- Pure/transaction fixtures: `node --test functions/inbox-groups.test.cjs
  functions/inbox-groups-push.test.cjs functions/inbox-push.test.cjs`.
- Actual local Firestore emulator: loopback `demo-townloop-inbox-groups` only,
  `FIRESTORE_EMULATOR_HOST=127.0.0.1:8898 node --test
  security/inbox-groups/emulator.test.cjs`; tests refuse non-loopback access.
  Includes real Admin transactions and adversarial authenticated REST queries.
- Native TypeScript and existing profile-model tests. No APK/iOS build, live
  resident account, resident message/photo, real push transport, deployment, or
  physical-device testing was used.
