# Marketplace bulk conversations and deployment preparation

Local implementation only, continuing 6558a89. Supersedes its promise to preserve
Marketplace chats during BULK cleanup. Ordinary individual listing deletion still
preserves chats and displays "This listing has been deleted." No deployment,
production mutation, flag activation, account-policy change, push, OTA or build.

## Implemented scope

Selecting marketplace now inventories marketplace_posts, marketItems and
marketplace_chats, recursively including messages/replies and record-specific nested
metadata. Preview and final counters explicitly show conversations, deleted
conversations and remaining conversations in addition to total documents/files.
The original confirmation, strict approved Admin authorization, write barriers,
per-root fences, conditional Storage deletion, durable batches, resume and audits
remain in use. Other category allowlists are unchanged.

Conversation attribution requires canonical immutable listing/buyer IDs, the
canonical existing chat ID, exactly two distinct buyer/seller UIDs and a seller UID
matching the listing's authoritative owner. A server-owned matching deleted-post
receipt may establish ownership after an earlier individual deletion. Once the
confirmed job removes a listing, its own server-only manifest retains that exact
owner/link proof for subsequent conversation batches. Ambiguous source collisions,
missing proof or noncanonical histories are held, never guessed from names/text.

Structured references to another listing/conversation, third-party senders,
explicit unrelated-content flags or non-Marketplace conversation types are held.
Unmarked free-text topic changes cannot be reliably classified; the verified chat
relationship is the scope, not a semantic guess about its message bodies. Legal,
report/evidence and nested retention markers protect the group. Marketplace holds
propagate between a listing and its attributed conversations. Ordinary resident,
Office/Maintenance and group Inbox roots are never part of this category.

Listing media and verified conversation-owned files under marketplace/ are included.
Chat file ownership requires immutable collection=marketplace_chats, exact chat ID,
participant uploader, default-database linkage, generation/metageneration and the
existing trusted upload cutover. The reviewed Storage create predicates do not
allow ordinary clients to forge that linked conversation metadata. Unknown legacy
attachments/paths remain held with a visible exception. Listing-preview references
are not duplicate file ownership: the listing manifest owns those files. Selected,
unheld conversations may reference their selected listing's media without causing
an artificial shared-reference hold; unrelated references still protect the file.

The individual preview-retirement helper skips writes while a confirmed Marketplace
bulk job owns chat versions, avoiding an Eventarc race with the deletion manifest.
Its ordinary behavior outside bulk cleanup is unchanged. No preview copies are made.

## Simplest safe release sequence — separate approval required

1. Confirm project cc-livingcommunity-app and current production snapshots. No full
   audit: compare existing pinned rules, guarded writer revisions, queued cleanup
   jobs, IAM and worker flags to the prepared receipt. Do not act on stale snapshots.
2. The existing safety gate REQUIRES account-deletion execution to be explicitly
   disabled/quiescent; a policy mismatch alone does not satisfy it. Obtain separate
   approval for a controlled maintenance pause of existing account-deletion worker
   execution, including any already-running invocation. Keep deletion_policies/account
   and all retention/deadline fields unchanged. Do not acknowledge receipts or run
   jobs to clear the gate. If a pause cannot be approved/proven, STOP activation.
   Generic and narrow media reapers must also be disabled/quiescent to avoid
   overlapping Storage requests. These flag changes are proposals, not executed.
3. Deploy existing guarded writer revisions if not already matching: manageInboxConversation,
   revokeInboxGroupMemberships, syncResidentDirectory, submitSafetyReport,
   reviewSafetyReport, newsletterApi, runNewsletterAnalysis and monitorInboxRetention
   if present. No extraction, notification or messaging redesign is included; only
   the existing barrier-compatible versions are required.
4. Deploy scoped manageDatabaseCleanup from databaseCleanupEntry.cjs with
   TOWNLOOP_DATABASE_CLEANUP_ENABLED=false, plus cleanupDeleted_marketplace_posts
   with the updated preview-retirement helper if that handler is deployed/released.
   Keep its narrow Storage-cleanup flag false. Do not deploy the root function
   inventory wholesale. No new service identity, secret or scheduled function.
5. Deploy reviewed security/database-cleanup/firestore.rules ONLY to (default),
   and security/database-cleanup/storage.rules to the existing bucket. Named
   deny-all remains untouched. Default hash is
   ee68e66da3e7e4e55546e77790ca674ca4c550e1ea816aa54b5902dfaded3c42;
   Storage hash remains
   06d24519f84deb79f2cd6d24248f1ac45242e841cdd69d2ac56a5b3ee4fcbdae.
   Coordinate rather than overwrite any separately prepared rule release. These
   rule changes invalidate old worker hash expectations; do not auto-update the
   account receipt/worker or restore permissive rules as a shortcut.
6. Release matching native UI via ONE Production OTA only after the installed
   Google Play runtime and exact release fingerprint are confirmed equal. This
   feature adds no native dependency. The current branch separately contains an
   unshipped App Check native module: do not override runtime checks or assume the
   whole tree can be published to the installed AAB. Use an explicitly compatible
   JS release, or stop for separate AAB approval if compatibility is unavailable.
   No new binary was built and no live compatibility claim is made here.
7. Verify non-destructively (function readiness, Admin/denied roles, preview/counters,
   correct rules and guarded identities). Then separately approve matching
   database_cleanup_policies/current receipt and ONLY the narrow bulk feature flag.
   No purge is authorized merely by approving deployment. Each actual deletion
   requires the Admin's selected preview, plan hash and typed confirmation.
8. During a confirmed purge, app writes temporarily pause; reads remain available.
   Keep the Admin screen open; interrupted work resumes from server checkpoints.
   Never manually clear a barrier with an unresolved Storage intent. Keep account
   deletion paused until a separately approved compatible worker/rules/policy
   sequence; NEVER auto-resume or acknowledge its receipt after bulk cleanup.

The existing Firebase runtime identity needs reviewed Firestore scoped mutation,
named database read/control access, Auth READ, bucket list/get/delete, and rules/
function metadata reads. No Auth deletion permission or new service account is
introduced. Safety receipt pins actual complete function inventory/revisions.
Existing backup, soft-delete/recovery generations, retention/evidence holds,
shared/ambiguous attachments and external-provider copies can prevent a total
physical purge. completed_with_holds explicitly reports this, not success-by-hiding.

## One focused emulator verification

The sole scenario is functions/databaseCleanup.marketplace.e2e.cjs. It uses real
synthetic Auth, Firestore and Storage emulator operations and compiles the exact
candidate default rules. Synthetic guarded-deployment readiness stands in for
cloud preflight; it does not verify live IAM or deployed function inventory.
It covers verified listing/media + conversation/nested replies/owned attachment
removal, an earlier individually deleted listing's receipt-linked conversation,
Admin-only confirmation, a Storage failure/resume, explicit unverified-history
retention, unrelated Inbox and its independent attachment preservation, and
unselected category/Auth/profile preservation. Result appended after the sole run.

Result: ONE scenario passed, zero failed. Real synthetic files/documents were
removed, two verified conversations were deleted, one unverified history remained
and was counted, and unrelated Inbox history/attachment and unselected categories
survived. One injected Storage failure paused and resumed correctly. No second test
run, additional suite, physical-device test or production operation was performed.
