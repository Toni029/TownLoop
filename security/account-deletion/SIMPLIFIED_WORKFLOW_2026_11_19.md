# Account deletion: local implementation and controlled rollout

Date: 2026-11-19. Branch: native/expo-migration. Base commit: 51874c8.

**Subsequent release execution:** disabled production staging is recorded in
[STAGED_DEPLOYMENT_2026_11_19.md](STAGED_DEPLOYMENT_2026_11_19.md). The local-only
statements below describe the original implementation session, not current deployment state.

**LOCAL ONLY.** No production access, resident mutation, deployment, worker pause,
receipt acknowledgement, OTA, binary build or push was performed. Existing unrelated
workspace changes are excluded. This document is not a production policy receipt.

## Final workflow

1. The existing authenticated request callables require recent verified login and
   typing DELETE. A server transaction creates workflowVersion 3, a unique requestId,
   and autoDeleteAt = server submission time + 30 × 24 hours. Duplicate pending
   submissions reuse the original request and deadline. Pending access is unchanged.
2. Another currently approved Admin/VIP approves transactionally. The server writes
   a matching review receipt and authorization, then signals a Firestore job event.
   First dispatch rechecks canonical reviewer authority and the exact review receipt.
   This starts the existing scoped engine without waiting for the five-minute cron.
3. Invalid requests/identity problems/documented withdrawals can be rejected with
   a reason and reference. A private persistent profile notice reaches the resident;
   rejection leaves access intact and permits a new verified request generation.
   It is not a permanent deletion ban.
4. The existing five-minute scheduler authorizes only undecided new-policy requests
   at or after the exact 30-day deadline. Initiation can be up to one schedule interval
   later. It does not authorize rejected, approved, cancelled, completed or legacy jobs.
5. Both authorization sources use the same leased, resumable processor. It reuses
   the existing cross-database engine, media provenance checks, policy/rules receipt
   checks, and transactional coordination with Database Cleanup. Bounded work signals
   continuation; transient failures retry; unresolved evidence/schema/ownership issues
   remain needs_review. An Admin/VIP retry rechecks evidence; it never overrides it.
6. Completion requires both database scopes, eligible content/media, and Auth deletion
   to verify. It is not delayed until an operational receipt expires. A late upload
   can reopen the SAME authorized job, preserving request identity and ownership proof.

### Access safety is not a product waiting period

Approval initiates securing access immediately. The existing minimum **65-minute
security drain remains** after disabling Auth/revoking tokens and fencing account writes.
Current rules and object generations do not prove that all previously started Storage
resumable sessions are finished. Removing that drain was not proven safe. A narrow
Storage finalize event wakes the same fenced request; it cannot directly delete files.
Ownership/reference/evidence checks still run in the common processor. No global
orphan worker or cleanup activation was added.

Operational proofs have a 60-day-from-request expiry target, extended only as needed
for at least seven days after securing access to cover previously started resumable
uploads. Only verified completed v3 root jobs get v3ReceiptExpiresAt. Reopening clears
that field atomically. Proposed TTL applies ONLY to this new field in the default
account_deletion_jobs collection group. Never enable TTL on legacy expiresAt or
retentionDueAt. The existing job event prunes identity-bound server proof metadata
once its completed root expires; it does not erase Auth, resident content or Storage.

## Historical requests and migration

The two pre-existing retention_pending/scoped_retention requests and their original
December 27/29 deadlines are deliberately excluded from v3 submission, timeout,
processor, upload reconciliation and TTL paths. Synthetic tests prove their documents
remain unchanged. No production record was read or changed during implementation.
They are not migrated, reauthorized, accelerated or reprocessed by this release.
Their eventual legacy finalization is a separate decision, not silently handled by v3.

Before cutover, read-only inventory must identify any legacy pending requests created
while staging. Do not migrate them automatically. Obtain separate owner instructions
for any such requests; v3 deadlines apply only to newly created policy generations.

## Personal-data coverage and explicit exceptions

- Auth identity, private profile/directory, device registrations, preferences,
  notification state/events and applicable personal documents use the existing inventory.
- Owned Discussion/Marketplace parents and own embedded comments/likes are removed;
  removed comment avatars/attachments receive exact media cleanup receipts.
- Inbox own messages/memberships are removed; other people's messages remain.
  Exact UID:epoch visibility/receipt keys and copied peer identity are removed without
  promoting receipt status. Historical participants are never restored.
- Existing maintenance records are privacy-redacted rather than deleting other staff's
  independently owned records; own comments, resolution identity and attachments are
  handled. RSVP identity and notification identity copies are removed/redacted.
- Owned media requires trusted record/object provenance, generation/metageneration,
  and reference checks. Shared objects, unknown ownership, quarantine and reported
  evidence are held rather than guessed. Google-hosted avatar references may be
  removed from TownLoop; third-party provider objects are not deleted by TownLoop.
- Unknown record schemas/private subcollections, ambiguous legacy chat identity,
  unstructured personal references, or live moderation evidence require explicit
  review/disposition. They remain incomplete; no promise of universal automatic erasure.
- Offline device caches, backups and external-provider records are separate limitations.

## Files changed (account-deletion scope only)

Backend lifecycle/dispatch:
accountDeletionLifecycle.cjs, accountDeletionJob.cjs, accountDeletionJobEntry.cjs,
accountDeletionUpload.cjs, accountDeletionRecheck.cjs, accountDeletionReceipts.cjs,
deletionRulesRuntime.cjs, deletionProcessingEntry.cjs,
accountDeletionReview.cjs, deletionExecutionCoordination.cjs.

Existing adapters/guards:
accountDeletionPolicy.cjs, accountDeletionRetention.cjs, accountDeletionInventory.cjs,
accountDeletionPreflight.cjs, accountDeletionScope.cjs, accountDeletionScoped.cjs,
accountDeletionV2.cjs, accountDeletionMedia.cjs, accountDeletionLateMedia.cjs,
deletionMediaReferences.cjs, databaseCleanupSafety.cjs.
Only the optional verified-writer inventory changes in Database Cleanup; its behavior,
rules pins, unrelated UI and authorization are preserved.

Packaging: functions/tools/deletion-package.cjs, prepare-deletion-processing.cjs,
prepare-deletion-review.cjs. Both packages traverse the complete literal local dependency
closure. Processing includes the generated reviewed deletionScopeRules.json; missing
manifest causes import failure. Review packaging exports only its five existing callables.
Test packages exist only in temporary directories and are removed afterward.

Native: src/lib/accountDeletion.ts, src/lib/deletionStatus.ts,
src/profile/AccountDeletion.tsx, AccountDeletionRequests.tsx, AccountDeletionNotice.tsx;
_layout.tsx only mounts the private rejection notice. Public privacy.html and
delete-account.html contain proposed matching wording, not published changes.

Tests: focused accountDeletion lifecycle/job/upload/receipts/data/packaging tests,
existing scoped/retention/preflight/media tests; native deletion tests; local
Auth/Firestore/Storage integration in accountDeletionLifecycle.emulator.test.cjs.
Local emulator config: firebase.account-deletion-emulator.json.
Configuration drafts: simplified-policy.UNAPPROVED.json, simplified.indexes.json,
simplified.ttl.PROPOSED.json. Plan: docs/superpowers/plans/2026-11-19-account-deletion.md.

## Exact separately approved deployment sequence

1. Read-only production preflight: confirm cc-livingcommunity-app, both database IDs,
   current rules hashes and service identities; preserve current config/receipts;
   identify all legacy requests. No job processing or migration during preflight.
2. Preserve current approved receipts/config. Stage the new index and NEW-FIELD-only
   root TTL. Verify required Eventarc/Firestore/Storage trigger permissions and existing
   deletion identity's narrowly required Auth/Firestore/Storage/rules-read permissions.
   No new secret, registration service or native SDK is required.
3. Deploy updated review package ONLY: requestAccountDeletion,
   submitAccountDeletionRequest, getAccountDeletionStatus,
   listAccountDeletionRequests, reviewAccountDeletionRequest. Under the old policy
   new requests retain legacy behavior until the explicit cutover.
4. Deploy scoped processing package ONLY: existing fulfillApprovedAccountDeletions,
   new processAccountDeletionJob (us-central1 default Firestore event), and
   reconcileAccountDeletionUpload (us-east1 existing bucket finalize event).
   Keep account/scoped/automatic processing disabled during staged verification.
   Preserve existing scheduler identity/settings; its new body only authorizes v3.
   Do not enable or modify unrelated cleanup workers/functions.
5. Verify exact deployed source/revision/manifest, IAM, trigger delivery/retries,
   index and TTL configuration, and current reviewed rule hashes. Add the new optional
   guarded writers to the existing Database Cleanup safety receipt only after verifying
   their code/env/identity/coordination; preserve all other required writers and flags.
   No Firestore/Storage rule change is proposed; never acknowledge mismatched hashes.
6. Publish a runtime-compatible client OTA and update only the public deletion/privacy
   pages with actual publication date. Perform disposable-account phone checks. Old
   resident request callables remain compatible; old Admin clients lack generation IDs
   and must update before reviewing v3 requests. No new native dependency/AAB needed
   by these changes; verify installed runtime before any OTA publication.
7. LAST: separately approve and write the real v3 policy receipt/effectiveFrom and
   verified coverage flags, and enable the matching account/scoped flags plus automatic
   authorization flag. Never deploy the UNAPPROVED template as an active receipt.
   Verify one disposable request, denial/reapplication and authorized completion;
   do not test with existing residents or historical requests.
8. Confirm historical jobs/deadlines unchanged and Database Cleanup compatibility.
   On failure disable new processing flags and hold new decisions; do not delete jobs,
   clear fences/proofs/locks blindly, roll rules back permissively, or restore the broken
   scheduled worker. Only resume the same generation after a verified correction.

Firestore rule source hashes currently pinned locally:
- default: 8d105d51885783e5b98993ca185d0ac968abf4d1eb423f53d78710e78dcc9047
- named: 8493ef2624b905208328f9ac7116dfe59e8349b1d24a8c3aa0883ceabd0da02d
- Storage: b844e570c4e44c8abb8961d934bf3d8393ae97b3ae2408d5cf7828dcb80f80b5

No live deployment state is certified by those local values. Existing deployment
findings must be rechecked immediately before a separately approved rollout.

## Verification and release decision

Verified: 115 combined backend checks, four additional event-dispatch checks and one additional stale-package guard (120 distinct checks). The final isolated packaging run passed all three package tests. Eight emulator scenarios and 29 focused native checks passed; native TypeScript passed. See final session report for targeted lint results. Real emulator Auth, both Firestore
server scopes and Storage were used with disposable data and a controlled clock.
Current default security rules rejected resident job/approval/notice writes. Runtime
rules verification is stubbed only for the synthetic demo project; production IAM,
Eventarc delivery, TTL service timing and physical-device UX are not thereby proven.

Conditional GO for a staged deployment after separate owner approval and the exact
preflight above. NO-GO for enabling production processing without those checks and a
matching active policy receipt. Local code does not repair the currently deployed
missing-manifest worker until explicitly deployed.
