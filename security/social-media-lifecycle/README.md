# Social media lifecycle: local, disabled preparation

Nothing in this directory is deployed. `functions/index.cjs`, active rules, account deletion,
and the protected global database-cleanup controls are untouched.

Only default-database `marketplace_posts` and `discussion_feed` are mutation targets.
The named database is **read-only** reference evidence. Private messages/chats are read
for references, never deleted or modified. All `marketplace/` and `feed/` objects with
unqualified metadata remain retained; the inventory cursor reports unclassified counts.

## Prepared interfaces and integration

`functions/socialMediaLifecycleEntry.cjs` exports
`createSocialMediaLifecycleHandlers({db, databases, bucket, listPage, deploymentReady, enabled})`.
The factory returns `{handlers, queue, tick, inventoryOrphans}`. Only `handlers` would be
exported from the Functions entry after separate integration/review. Merely requiring
this file registers nothing. `enabled` defaults false; `deploymentReady` defaults false.
The factory requires the existing two database IDs from `accountDeletionScope.cjs`,
default `db`, and exact existing bucket. No environment switch is added automatically.

`listPage: source => createDocumentPager({project, databaseId:source.databaseId,
getAccessToken})` uses the existing read-only, bounded REST pager, including missing
parents with live descendants. Do not supply a query-based pager that loses descendants.

`deploymentReady()` is an **authoritative server verifier**, not a local boolean flag or
an approval-only Firestore field. Until implemented and verified, the worker reports
`reference_writers_unfenced` and performs no Storage deletion. It must verify:

* Owner-approved server policy, trusted-upload cutover and original secured-upload
  provenance, plus exact separately reviewed deployed default Firestore and Storage
  candidate hashes. The historical `deletion_policies/media.storageRulesSha256` is the
  original immutable Storage hash, also required as the deployed Storage hash. The
  deployed default Firestore fence-rules hash is a separate receipt.
* Named client rules remain deny-all; authoritative backend/function/service inventory
  proves **no concurrent named-database reference writers**. The worker never writes
  a named lock, tombstone, job, or resident document.
* Every default-database Admin SDK reference writer reads
  `assertSocialReferenceWritesAllowed(tx, db)` inside its writing transaction, or is
  disabled and its in-flight work drained. This includes chat writers, profile avatar
  writers, imports, newsletter/work-order writers, account-deletion and old media
  cleanup workers, and any direct REST/service-account writers. All writes must be
  guarded because resident content can embed a Storage URL in ordinary text.
* Privileged Storage object writers are guarded or disabled/drained; rules do not
  constrain Admin SDK/service-account writes. Native social media remains create-only
  (`resource == null`) with updates forbidden. The original Storage rules stay unchanged
  to preserve Firebase Storage’s two unique Firestore document lookup budget: approved
  profile and linked parent. No Storage control-document lookup is added. Existing
  resumable/signed upload paths must be covered by the privileged-writer review.
* Conflicting cleanup jobs/destructive exports are disabled or verified idle. This
  lifecycle does not turn on global cleanup or change account-deletion behavior.
* The dedicated worker identity has default Firestore read/write, named Firestore
  **read only**, Storage object metadata/list/delete, bucket metadata read, authoritative
  inventory/rules read, and existing Storage-rules cross-service read permissions.
  Storage does not read the social cleanup control document. Verify scopes rather than reusing broad admin IAM.

The concrete authoritative verifier is `functions/socialMediaLifecycleReadiness.cjs`.
The isolated `functions/socialMediaLifecycleScopedEntry.cjs` wires that verifier, the
existing bounded pager, both database read scopes and the dedicated worker identity.
It is not imported by the main entry. Its enablement requires
`TOWNLOOP_SOCIAL_MEDIA_LIFECYCLE_ENABLED=true` plus the exact production project;
no enablement flag or approved manifest is supplied here.

`socialMediaLifecyclePins.json` pins the root-owned coordinated registration/social
rule candidates, **not** this directory's standalone candidates. At packaging, compare
its default/storage hashes against `security/registration-lifecycle/coordinated.*.rules`;
any subsequent coordinated rule change requires reviewed repinning. Named rules remain
the exact existing deny-all hash 8493ef2624b905208328f9ac7116dfe59e8349b1d24a8c3aa0883ceabd0da02d.

Storage must remain byte-identical to the reviewed live immutable rules, SHA256
`9aac5f82b7e31fef034b92340714136ec943232de88b1a0076c001331958c3e9`.

The verifier fetches live Firebaserules releases/source, complete v1/v2 Functions
configurations and revisions, project IAM policy and bucket IAM policy. Pagination,
unreachable regions, API failures, policy/config drift, missing review evidence, active
account processing and conflicting destructive workers fail closed. It requires the
server-only `social_media_control/deployment` manifest described below. It does not
create or approve that manifest. An always-true callback is unsafe in production.

## Concrete reference fence

`createSocialReferenceFence({controlDb, databases, bucket, deploymentReady}).run(jobId,
async (assertFrozen, deleteObject) => {...})` transactionally acquires the default-only
`social_media_control/active` barrier. Candidate Firestore rules gate **writes only**,
across all Firestore client paths. Original Storage ownership and immutable-upload
rules remain unchanged; independent native object creates may continue. Reads continue unchanged. A competing job cannot
steal the barrier. Every delete first persists exact-generation and metageneration
conditions under `social_media_deletion_attempts`. The default barrier releases only
when every attempt for the job is settled. No lock expires on a timer.

A network failure with an unknown outcome keeps writes frozen. Retrying that same job
reissues only the already-authorized conditional request and settles on success,
404 or 412. If it cannot settle, writes stay blocked and the job remains unresolved;
manual recovery must investigate the generation/attempt, never clear the lock blindly.
This means deployment requires an operational recovery procedure before activation.

`prepare-rules.cjs` mechanically wraps every **Firestore** write predicate in
`socialMediaWriteAllowed()` while retaining existing predicates and all read
authorization. For Storage it validates the exact original hash and returns unchanged
source. Generated local `firestore.candidate.rules` and unchanged
`storage.candidate.rules` are review inputs, not active configuration. Regenerate after integrating any other rule work; review exact hashes.
Do not deploy these candidates over unrelated newer rules. A broader `allow` added
later must also carry the guard because Firebase allow rules combine with OR.

## Queue, retention and honest status

Delete triggers queue minimal owner/scope/reference data from the before snapshot.
An Admin or VIP deletion still uses the original content owner for provenance.
Edit triggers queue only detached attachment paths. Author avatars and ordinary text
are not treated as deletion candidates. Orphan inventory runs hourly with a durable
folder cursor; server object `timeCreated` enforces 48 hours before orphan processing.
No parent or draft document is expired by this lifecycle.

The worker holds the reference fence for parent/protection checks, bounded scans of
both databases, metadata validation and conditional deletion. A restored parent wins.
Shared references (including private-message text), reports, evidence, legal/retention
holds, quarantined hashes, unknown provenance, object changes, unknown attachment
references, incomplete scans and unavailable readiness are retained with reasons.
Historical approved account-deletion proofs do not grant this lifecycle permission.

Unknown references anywhere in the bounded inventory conservatively retain candidates;
legacy/external attachments may therefore block automatic deletion until reviewed.
Inventory limits (200 candidates per job, 2,500 reference documents, 20 seconds per
reference scan) produce unresolved status, never silently truncate a successful cleanup.
At most 20 Storage pages are scanned when finding a deleted parent's metadata links.
Generation-unqualified/unlinked legacy files are retained and cannot be attributed to
a parent merely from a URL or filename. Current/noncurrent or soft-deleted historical
bytes are not claimed purged; bucket versioning and actual retention/holds cause holds.
Soft-delete recovery is tracked separately, as described below.

Statuses are `queued`, `retained`, `recovery_pending`, or `complete`, with unresolved path/reason pairs and
retry backoff. Complete means every **identified candidate** was deleted or already
missing, not that every historical byte or unclassified object is gone. Retry delivery
is idempotent by event/scope or orphan object-generation key. Private chat is untouched.

The existing native deletion UI must say:

> Item removed. Media cleanup is pending; protected or shared files may remain.

A successful content-delete acknowledgement must never claim media deletion finished.
The queue is server-only; adding resident status access later requires a scoped callable
or a sanitized owner-readable projection, not direct access to the job records.

## Local verification

`node --test functions/socialMediaLifecycle.test.cjs functions/socialMediaLifecycleReadiness.test.cjs functions/mediaCleanup.test.cjs`

`FIRESTORE_EMULATOR_HOST=127.0.0.1:18197 node --test security/social-media-lifecycle/emulator.test.cjs security/social-media-lifecycle/rules.emulator.test.cjs`

The tests use disposable `demo-*` Firestore projects on an explicit loopback emulator.
Storage conditional requests are an in-memory adapter, not production or a live bucket.
Firestore candidate rules are actually compiled/exercised. The coordinated Auth/Firestore/Storage
emulator run also compiled the unchanged Storage candidate and checked approved versus pending/denied
access. Provider soft-delete recovery behavior, live authoritative readiness/IAM/writers are
**not verified by these tests** and remain rollout prerequisites.

## Normal active deletion with seven-day recovery

A positive `softDeletePolicy.retentionDurationSeconds` permits normal active-generation
conditional deletion. No bucket policy is changed, no recovery generation is forcibly
deleted and no restore API is called. Before the request, the leased job durably records
path, exact generation/metageneration and the policy's expected recovery deadline.
After deletion it reads the generation through the installed SDK's supported API:

`bucket.file(path, {generation}).get({softDeleted: true})` returns `file.metadata`.

The authoritative `softDeleteTime` and `hardDeleteTime` are persisted in the job's
`recovery` array. The active file can be gone while the job remains `recovery_pending`.
On retries, that same generation is checked, rather than treating an active-name 404
as final proof. A record becomes `verified_expired` only when its previously observed
hard-delete deadline has elapsed and both the generation-qualified soft-deleted GET
and the normal generation-qualified metadata GET return 404. A still-visible recovery
object, unknown generation/deadline, API permission error or inconsistent response
remains unresolved. A crash lasting past the entire recovery window may require
manual evidence review if the authoritative deadline was never observed.

Multiple images persist progress independently before each request. A partial/network
failure preserves exact-generation intent; the existing fence settles uncertain
requests under the same lock before retrying. Ordinary `recovery_pending` does **not**
keep the write barrier locked for seven days: only genuinely uncertain in-flight delete
requests do. A restored or replaced active generation is retained with `object_changed`.
`deleted` counts active removals, never recovered-copy purge. `complete` still refers
only to identified candidates, with verified recovery expiry where applicable.

## Approved deployment manifest schema

No approved manifest is included or written. An owner-approved review must populate
`social_media_control/deployment` only after source/IAM/fence review. The verifier
requires all of the following; missing values fail closed:

* `version: 1`, `ownerApproved: true`, nonempty `approvalReference`.
* Every exact field/value in `functions/socialMediaLifecyclePins.json`.
* `reviewedAt` and `expiresAt` as epoch milliseconds or Firestore timestamps; review
  age and validity are limited to 24 hours. Expired approval stops new deletions.
* `functionInventorySha256`: `canonicalDigest(functions)` over full live v1/v2
  configurations, deduplicated by resource name and sorted by name.
* `projectIamSha256` and `bucketIamSha256`: `canonicalDigest` over the exact live
  policy responses (including etags), using requested IAM policy version 3.
* `writerEvidence` booleans: `externalWritersDisabledAndDrained`,
  `namedBackendWritersDisabledAndDrained`, `defaultWritersTransactionGuarded`,
  `privilegedObjectWritersGuardedOrDisabled`, `defaultOnlyMutationScopeReviewed`,
  `immutableNativeSocialUploadsVerified`, `storageFirestoreDocumentBudgetVerified`, all true;
  plus nonempty `sourceReviewReference` and `iamReviewReference` pointing to the
  reviewed deployed source/principal/scope evidence. These attestations must reflect
  actual coordination; inventories and hashes alone cannot retrofit missing guards.
* `writers`, keyed by **every** full deployed Function resource name, with exact
  `configurationSha256: canonicalDigest(function)`, reviewed `sourceSha256`,
  `namedWrites: 'none'`, and `mode: 'guarded_default_only' | 'non_reference' | 'disabled'`.
  Disabled mode also requires a reviewed `disabledFlag` beginning `TOWNLOOP_` whose
  live environment value is exactly `'false'`. Review must prove the source enforces it.

`canonicalDigest` is exported by the readiness module and sorts object keys recursively.
The verifier validates matching configuration/review receipts; the source review itself
must establish the guard behavior and associate its source hash with the observed
immutable build/revision configuration. No source review or IAM scope is invented.
Generic media/account reapers and global cleanup must remain explicitly disabled as
required by their reviewed flags. No account/global worker is rewritten by this work.

The dedicated identity additionally needs read-only `firebaserules.releases.get` /
`firebaserules.rulesets.get`, Functions list/get, project getIamPolicy and bucket
getIamPolicy access for authoritative verification, alongside earlier scoped data
permissions. Storage generation and soft-deleted metadata reads require appropriate
object-get access. It does not need bucket-policy mutation, restore, named-database
write permission, or a forced recovery-copy deletion capability.

## Storage two-document budget and immutable-generation proof

Firebase Storage rules permit only two unique Firestore `get`/`exists` document reads
per request. The original native social upload path already uses the approved profile
and linked parent. Adding `social_media_control/active` would require a third document
and reject otherwise valid uploads. No such lookup is present in this preparation.

Reference safety instead relies on the default Firestore fence and unchanged original
Storage semantics together:

1. Every client Firestore write is blocked while the scanner and conditional request
   run; reviewed privileged reference writers honor the transactional guard, and named
   writers are disabled/drained. New references cannot attach during deletion.
2. Native `feed/` and `marketplace/` uploads require an absent object and exact approved
   parent ownership. Client byte/metadata updates are forbidden. Creating an independent
   object does not mutate an existing referenced generation.
3. A concurrent delete/recreate at the same name creates a different generation.
   `ifGenerationMatch` and `ifMetagenerationMatch` ensure a request authorized for an
   earlier generation cannot remove the replacement. Privileged object writers must
   still be guarded or disabled under the reviewed readiness receipt.
4. New uploads arriving after an inventory page remain eligible for later orphan
   inventory, with the full 48-hour grace. Completion never claims all historical or
   unclassified files were inventoried. Existing owner/Admin direct Storage deletion
   rights remain unchanged; this lifecycle does not expand those rights.

`storage-budget.test.cjs` checks byte equality to the original reviewed rules/hash,
absence of the extra control lookup, create-only/update-denied semantics and the native
social-create function call graph's two distinct Firestore document paths. This is a
source-budget proof; Storage emulator access checks passed separately. Physical-device and production
Storage authorization checks remain part of a separately approved rollout.
