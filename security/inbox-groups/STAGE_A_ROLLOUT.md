# Stage A Inbox rollout — deployment checkpoint `647da3d`

Stage A was subsequently deployed and verified active. The historical findings and
rollout below describe that checkpoint. See [LEGACY_SELF_LEAVE.md](LEGACY_SELF_LEAVE.md)
for the new, not-yet-deployed legacy departure correction.

## Confirmed missing integration (2026-10-29, read-only metadata)

Firebase project `cc-livingcommunity-app`, region `us-central1`, database `(default)`:
- `manageInboxConversation`, `revokeInboxGroupMemberships`, and
  `notifyInboxGroupMessage` are absent.
- `registerInboxDevice` and `getNotificationState` exist and need their compatible
  Stage A versions, not duplicate endpoints.
- The deployed default rules have no `inbox_conversations` access. Exact source
  SHA-256: `b93e8c376f2609c1200b5c42553d71cbd531e997ec0f30ee8ef9fe45a4dafc89`.
  This is identical to `security/inbox-push/firestore-replies.candidate.rules`.
- All three required composite indexes were missing in the read-only index listing.
- No resident documents/messages were queried to establish these findings.

The installed client already calls the missing authenticated endpoint. Another OTA
cannot supply it. Do not hide the error or restore client team-wide `sideLeft` writes.

## Exact approval scope and sequence

1. Re-fetch ONLY the default rules and compare their hash before deployment. If
   changed, regenerate/review the patch against the new baseline. Generate locally:
   `node security/inbox-groups/prepare.cjs <verified-default-rules-file>`.
   The prepared artifact is `.release/inbox-groups`; its `scope.json` names the
   exact exports. All flags remain OFF in the generated artifact.
2. Use `index-create-requests.json` to create only missing indexes; skip equivalent
   existing indexes and wait until READY. Never deploy a replacement index inventory.
   Required indexes: `messages.visibility CONTAINS + sequence DESC`,
   `inbox_memberships.uid ASC + status ASC + updatedAt DESC`,
   `notification_events.uid ASC + target ASC + seen ASC + sequence ASC`.
3. Deploy ONLY these Stage A functions (default database, existing project):
   `manageInboxConversation`, `revokeInboxGroupMemberships`,
   `registerInboxDevice`, `getNotificationState`, `notifyInboxGroupMessage`.
   Use the explicit `deployOnly` selector in `scope.json`; never an unscoped
   `firebase deploy`. No receipt scheduler, old category triggers, account-deletion
   function, cleanup runner, Storage rules, Hosting or named database is included.
4. Deploy ONLY `.release/inbox-groups/firestore.rules` to `(default)`, after the
   baseline check. Existing Inbox writes are fenced only after a server cutover
   marker; direct permanent deletion is denied. Unrelated rules stay unchanged.
5. Separately approved Stage A activation must set `INBOX_GROUPS_ENABLED=true`.
   Otherwise capability negotiation deliberately keeps group handling unavailable.
   Keep Stage B absent, not merely toggled off. Reopen the updated app so it
   negotiates capabilities before converting a real conversation.
6. Preserve existing notification recipient/platform restrictions and credentials.
   The new `notifyInboxGroupMessage` needs the existing approved delivery scope plus
   `INBOX_GROUP_PUSH_ENABLED=true` to preserve notifications on converted threads.
   Do not enable broader recipients, enable iOS, reset preferences, or redeploy the
   four existing category senders. Do not deploy generated OFF/tester placeholders
   as a substitute for the verified existing delivery configuration. If group push
   activation is not approved/ready, do not convert active conversations expecting
   continued push delivery. Sending must never be tested on unrelated residents.
7. Verify capabilities, denied unauthenticated/nonmember access, actor-only leaving,
   remaining history, departed direct-read denial, and no duplicate leave events
   using authorized fixtures/testers. Verify that the last leave queues only
   `awaiting_separate_approval`, retaining source/messages. No real permanent
   deletion is authorized. No new APK or native dependency is required.

## Legacy support and explicit limits

Exact UID-pair private chats support atomic conversion plus leaving in one callable
transaction. Already-converted chats route to the same per-person membership logic.
Only the authenticated actor can leave; clients cannot name another member to remove.
Private remaining members retain history but cannot send to a departed member.

Old Office/Maintenance role-wide records do not identify everyone who historically
had access. Independently reviewed, expiring, exact-source authorization manifests
are required before converting these records. The manifest contract is in README.md;
no live manifests were created. This requirement cannot safely be bypassed by adding
all current staff, inferring readers from message authors, or trusting a client list.

Unknown identities, changed/missing proofs, conflicting threads, unsupported media,
or histories exceeding the bounded 150-message transaction remain intact and return
an explicit review error. Do not promise that deployment alone converts these cases.
Resolve verified membership/media or prepare a separately reviewed bounded migration.
The six quarantined files and existing download tokens remain untouched.

## Local correction and verification

Atomic legacy leaving now projects the actual remaining active-member count and
only each member's visible sequence; it no longer reports the pre-leave count or
projects the new leave event's sequence to the departed member.

Focused transaction fixtures cover no-confirmation, idempotency, concurrent leaves,
legacy rollback and unresolved ownership. Real local Firestore emulator tests cover
historical privacy, forged writes, departing access and preserved remaining history.
Push fixtures exclude departed recipients, including queued events created before
leaving. These are local tests, not deployed or physical-device verification.
