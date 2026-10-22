# Prepared account and media deletion — no deployment approval

## Request and recovery

`requestAccountDeletion` verifies Firebase Auth token signature/revocation and identity, `auth_time` within five minutes, and exact `DELETE` confirmation. Email/password reauthentication works natively; configured Google reauthentication works on web. Native Google sign-in was already unconfigured and remains a provider-configuration release gate. The public `/delete-account.html` uses the same authenticated request; passwords/tokens are never stored in job records.

A deterministic UID-hashed `account_deletion_jobs` record prevents duplicate requests. Acceptance freezes the profile with `deletionPending`, removes the directory projection, then the scheduled worker disables/revokes access. Six-minute durable leases exceed its five-minute invocation deadline; bounded, idempotent phases resume partial failures. Native cleanup runs only after server acceptance, deletes exact account-scoped medication/reaction data and signs out; ordinary logout preserves medication records. The public page removes only the verified UID's encrypted browser record/key and exact UID-prefixed Marketplace drafts, not unattributed legacy medications, mixed-user recovery archives or all site data. Historical mixed-user local message archives cannot be safely erased wholesale without losing another resident's drafts; their ownership-specific remediation remains a release gate. This is not a claim that every historical device copy is erased.

After explicit confirmation the trusted worker inventories UID references in the existing shared collections, 100 records per page. This implementation reads complete server-side records when executing an approved deletion request; it was not executed against resident data during development. It does not look up identity by names or sanitized IDs. Before enabling this worker, review operational costs, legacy identity coverage, shared references, and processor/backups deletion obligations.

## Required owner policy

Server-owned `deletion_policies/account` must have `ownerApproved:true`, a nonempty `approvalReference`, and collection-specific actions with nonempty `reason`:

- `retain`: preserve that shared collection's records under the explicitly approved rationale. No retention duration is invented or enforced by this action.
- `delete_owned_social`: only for discussion_feed/posts/marketplace_posts/marketItems. Transactionally recheck exact current ownership before deletion; conflicting identities fail closed. Owned parent deletion atomically queues linked media cleanup and an ID tombstone. For comments authored on someone else's record, a separate `sharedReferences:{action:'retain',reason:'...'}` decision is required.
- Unknown actions, anonymization and time-based policies are unsupported and remain blocked for separate review/implementation. Do not label retained identifiable shared history as anonymized or fully erased.

Work Order number reservations, counters and audit/history are not deleted. Unresolved shared-history decisions keep the request in `pending_owner_approval`; deployment must not leave residents indefinitely pending without an approved operational policy. Private profile/projection, push registrations, account-owned block records and private reporting-rate counters are removed only after inventory decisions resolve; Firebase Auth deletion retries independently. Identity removal with outstanding media is `identity_complete_media_pending`, not complete. Inventory-linked media jobs are checked in bounded pages; absent/queued/legacy-policy holds prevent completion. Only all tracked jobs completed allows the final completion state. Operator review remains necessary for untracked legacy media and processor/backups coverage.

## Media authorization and cleanup

`deletion_policies/media` requires `ownerApproved:true`, nonempty `approvalReference`, a Firestore Timestamp `trustedUploadsAfter`, and per-collection `{action:'delete_linked_media_on_parent_deletion',reason:'...'}`. The cutover must follow deployment and verification of the C2 secure Storage rules; legacy attacker-writable metadata does not prove provenance. Objects must match the existing collection/folder/record link and security version, with trusted GCS `timeCreated` at/after that cutover. Staff attachments may have a different uploader from the resident owner; exact trusted parent linkage, not guessed filenames, establishes the relationship.

Parent-deletion and late-upload triggers enqueue idempotent server-only jobs. Workers page bucket listings, check metadata, recheck the parent, and use object-generation preconditions before deletion. A permanent server tombstone plus matching create rules prevents ordinary clients recreating a cleaned parent ID. Admin SDK restoration requires controlled operations; it bypasses client tombstone rules and must be coordinated with cleanup. Legacy, malformed, orphaned or pre-cutover files are retained for review rather than destructively assigned. Pending legacy jobs require an explicitly reviewed correction/requeue procedure; do not blindly change their state to complete.

Draft expiration additionally requires per-collection `expireUploadDrafts:true`; only trusted post-cutover draft documents with an elapsed original upload expiry plus a 15-minute in-flight safety margin qualify. This is an opt-in operational decision, not an approved resident-record retention period.

## Deployment prerequisites

Deny all client access to deletion jobs/inventory, deletion policies, cleanup jobs/cursors and tombstones. Deploy the prepared job/status indexes and correct database-specific functions together with reviewed rules/clients. Never run a broad `firebase deploy` to resolve one issue. No live migration, cleanup, Auth change, deployment or build occurred in this implementation. Real staging/device and authorized recovery verification remain required before release.

Operational deletion/inventory job receipts, report audits, incoming block preferences owned by another resident, and processor/backups retention still require an approved retention schedule; successful identity deletion is not a promise that these approved shared/audit exceptions disappear.
