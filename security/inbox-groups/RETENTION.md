# Inbox retention: locally prepared, inactive

Scope: native private, Community Office and Maintenance conversations in Firestore
`(default)`. No Marketplace, named-database, account-deletion worker, push transport,
Storage-rule, token, backup or Hosting changes.

## Lifecycle

- Leave still removes only the authenticated member. Remaining participants retain
  permitted history. A private thread with one remaining member stays read-only.
- Final leave sets a full 30-calendar-day deadline. Retries cannot extend it. A final
  leave during inactivity grace replaces that deadline with a new full 30 days.
- Six calendar months in UTC (clamped at month end) without a genuine message
  archives a thread. Empty threads use creation time. Reads, retries, joins, leaves
  and role changes do not reset inactivity. Archive grace starts at detection, not
  retroactively; old abandoned threads also receive a full 30 days.
- Membership projections carry the archive notice/deadline. Native Inbox list and
  open-thread notices inform remaining participants. Ship this UI before activating
  monitoring. An authorized new message atomically reopens the conversation and
  cancels inactivity cleanup until the cleanup claim wins. Departed members never
  rejoin, and historical visibility/epochs remain unchanged.
- A cleanup claim freezes further messaging/membership mutations and client reads.
  Every transactional batch rechecks claim, sequence, retention boundary, current
  Admin approval, membership inventory and evidence. Root/membership/reference/source
  finalization is atomic. Leases, bounded pages and one-hour retry backoff support
  resumption. Human-review failures are held, not repeatedly retried as transient.

## Required safety review

The membership query must exactly match the authoritative root UID/reference map.
Missing, extra and mismatched members never mean an empty conversation. Old v3
threads with complete memberships are supported. Unconverted legacy records enter
`needs_review`; team-left flags, aliases and names never authorize deletion.
Verified legacy cutovers require the exact source hash and routing fence. Others
need the existing reviewed cutover process or a separately verified migration.

The runner additionally requires `inbox_cleanup_authorizations/{cid}` containing:
`status: approved`, a currently approved canonical Admin `approvedBy`, finite numeric
`expiresAt`, exact `sequence`, `membershipInventoryComplete`,
`mediaReferenceInventoryComplete` and `evidenceReviewComplete` all true, and
`inventoryHash` from trusted `readCleanupInventory`. The hash binds membership
epochs/statuses, media references and holds, without copying messages/tokens.
Legacy sources also require `legacySourceApproved` and `legacySourceHash`.
These are server-only review attestations, never client claims. Approval does not
replace an actual complete inventory/evidence review.

Review must account for reports referring to residents instead of message IDs;
absence of a structured conversation report is not proof that evidence is absent.
Conversation/source reports and applicable legal holds preserve the entire thread
until independently resolved. Holds need a documented basis and approved expiry.
No evidence archive, legal basis or 400-day exception is invented.

Only verified exclusive `inbox_groups/{cid}/{messageId}/` objects are eligible.
A bounded Storage metadata listing must have no untracked files; global Inbox
reference lookups reject sharing even when a reference count is stale. Object
metadata/generation must match and deletion is generation-conditional. Unexpected
subcollections, unindexed message media, shared/quarantined/unknown attachments or
incomplete inventories hold processing. Historical Storage folders are never purged;
tokens and all six quarantined attachments remain unchanged. Future upload/reference
writers must obey the root cleanup fence before enabling them; current group uploads
remain disabled/text-only.

Partial runs remain processing/retry_required/needs_review, never falsely completed.
After a human hold is resolved, renew the manifest/hash and explicitly reset the
request to awaiting_separate_approval. Expired approvals must be renewed. Previously
removed objects (404) and deleted batches resume safely.
Known conversation-targeted notification metadata is removed; old delivery receipts
without reliable targets follow existing expiry, never guessed ownership.
Completion retains a content-free receipt for the existing 60-day audit window.
The separately gated cleanup scan expires it only after the conversation is absent.
No claim of remote offline-device or immediate backup erasure is made.

## Exact release dependencies: approval still required

1. Generate local artifacts with `node security/inbox-groups/prepare-retention.cjs
   BASELINE_RULES OUTPUT`, using freshly reviewed live default-database rules.
   The script never deploys or scans live records.
2. Create only the missing messages composite: type ASC, createdAt DESC. The package
   supplies a create-only request. Existing report queries reuse equality index
   merging. Preserve all other indexes; do not deploy an old entire index file.
3. Update only manageInboxConversation and revokeInboxGroupMemberships with the
   packaged dependencies. Preserve all existing group/push environment settings.
   Deploy the default-rule diff adding only the cleanup_in_progress read fence.
4. Release the JavaScript archive notices before monitoring starts grace periods.
   No new native module or APK/iOS build is required for these UI changes.
5. Separately approve deployment of monitorInboxRetention and
   cleanupExpiredInboxConversations. Both are hourly/default OFF and absent from
   live functions/index.cjs and Stage A artifacts. Merge the two false retention
   flags into the existing environment; never replace live push configuration
   with the generated partial .env file.
6. Separately approve INBOX_RETENTION_MONITOR_ENABLED=true, then destructive
   INBOX_RETENTION_CLEANUP_ENABLED=true only after reviewing exception handling,
   the rules fence, actual inventories/manifests and capacity. Monitoring visits
   25 documents/page; cleanup visits 10 requests/page, with persistent cursors.
   Large backlogs need an explicitly approved capacity adjustment, not an unbounded
   purge. Per-conversation reviewed manifests remain required for cleanup.

Verification: disposable transaction fixtures, loopback demo Firestore emulator,
packaging checks and native TypeScript. No live records inspected/changed, no
cleanup or schedules activated, and no deployment/push/OTA/build/device test.
