# Database Cleanup Manager — LOCAL, NOT ACTIVATED

This package is not deployed, does not run a production purge, and does not
change existing account-deletion workers, receipts, rules, Storage, Auth, Inbox,
notifications, Gemini, backups, or the named legacy database.

## Investigation

The former native Admin Portal card named `discussion_feed`, `marketplace_posts`
and `work_orders`, but its confirmation callback only threw
`Mock cleanup requires an explicit allowlist of verified mock document IDs.`
It had **no deletion implementation**. The retired website helper also returns
failure/zero counts. The native card is replaced; the retired website is untouched.

## Explicit default-database scope

| Checkbox | Roots eligible for the confirmed plan | Dependencies / exclusions |
|---|---|---|
| All Work Orders | `work_orders/{id}` | All nested documents; embedded comments/photos are part of the root. Preserve `work_order_numbers`, counters and unrelated records. Completed `retentionVersion:1` records remain held until their existing 30-day retention has elapsed. |
| All Discussion Feed Posts | `discussion_feed/{id}`, historical default alias `posts/{id}` | All nested documents and embedded comments/likes; preserve reports, evidence, Inbox and resident records. |
| All Marketplace Listings | `marketplace_posts/{id}`, historical default alias `marketItems/{id}` | All nested documents and embedded listing comments. **Never delete `marketplace_chats`, its messages or participant histories.** |
| All Newsletters, including their RSVP Events and Pinned Highlights | `newsletters/{id}`, including `current`, drafts, nested PDF `chunks`; `newsletter_analysis_jobs/{id}`; proven edition-linked `community_events/{id}` and `community_highlights/{id}` | Derived event/highlight must have `isAiExtracted:true` and a verified matching `newsletterId`. Manual content is skipped. Ambiguous AI attribution is held. Active queued/running/retrying Gemini work is held. Preserve the Home recurring calendar and all independent activity schedules. |

Every eligible root is enumerated recursively (including missing parents with
live subcollections). Depth >8, >1,000 containers per root, or an oversized
manifest stops inventory and disables confirmation instead of hiding uncounted
documents. Large collections are paginated and final residual counts are also
checkpointed. PDF payloads are excluded by field masks during inventory and
deletion transactions; original bytes are never decoded, compressed or copied.

All `users`, Auth identities, profiles/directory, medication/checklist data,
Inbox/group memberships, notification settings, report/audit evidence, deletion
policies/jobs and the legacy named database are outside the target allowlist.
Related push metadata and ID reservations are intentionally retained rather
than guessed to be exclusively owned. Existing navigation checks must tolerate
content that was removed; no notification delivery implementation changes here.

## Storage scope and exclusive ownership

| Category | Candidate Storage paths | Ownership handling |
|---|---|---|
| Work Orders | `work_orders/{filename}` | Enforced native `securityVersion:1`, collection/record/uploader metadata and approved upload cutover required. |
| Discussion | `feed/{filename}` | Same provenance checks; historical `posts` ownership must match that root exactly. |
| Marketplace | `marketplace/{filename}` | Same checks; any reference from Marketplace chats or other records protects the file and parent listing. |
| Newsletters | `newsletters/{editionId}/document.pdf` and referenced page images | Historical Storage metadata does not prove exclusive ownership: hold explicitly. Current native PDF chunks are Firestore documents and can be purged with the edition. |

A read-only preview inventories current, versioned and soft-deleted objects,
exact bytes, generations, category, ownership status and hold reasons. Native
Admins can expand paginated token-free object paths before final confirmation.
The manifest digest is part of the confirmed plan. No PDF contents are modified.
Missing metadata/files, orphans, unknown external references and unproven
historical files remain held. One blocked file protects its whole Firestore root.
An otherwise unprotected category with only proven exclusive current native
files can be fully removed; a historical newsletter Storage file cannot be
promised a complete purge without separate trustworthy ownership evidence.

The reference scanner checks all root collections and descendants in both
Firestore databases, including private messages, profiles, reports and free-text
URLs. It excludes only the owning default-database subtree and server-only
cleanup manifests. PDF chunks are projected without loading their binary data.
Scans fail closed at 2,500 documents/20 seconds, 1,000 files per category or
1,000 manifest files total. These safety limits can block large inventories;
they never silently authorize unscanned files. Ambiguous nested references,
excessively ambiguous punctuation and deep/oversized maps also fail closed.
No named resident documents are changed or deleted.

Confirmation temporarily blocks **all client writes**, including uploads,
through prepared default Firestore and Storage rules. Reads and existing role
checks remain intact. Guarded server writers transact against the matching
control in their own database. The cleanup service places/removes a server-only
control in the legacy database too; its deny-all rules remain unchanged.
This temporary app-wide read-only period is necessary to prevent sharing a file
between exclusivity verification and object deletion. It is disclosed in the UI.
Generic media reapers and account-deletion execution workers must be explicitly
disabled and quiescent before activation. No live flags are changed here.

Each file delete has a durable transactionally claimed intent bound to the job
lease and exact generation/metageneration. GCS deletion uses both preconditions.
Lost responses are reconciled without deleting a replacement or counting twice.
Cancellation drains outstanding intents before unlocking writes. A sealed
finalization phase prevents lease takeovers from creating new intents during
barrier release. Unresolvable requests keep the job paused and writes blocked
for explicit Admin/operator recovery; never manually clear controls to bypass
an unresolved intent. Holds/version changes in remaining descendants are
rechecked before retrying a claimed operation. Already deleted data cannot be
restored by cancellation. A final inventory reports residual files and records.

Bucket versioning, soft deletion, retention, object holds and retained historic
generations prevent a complete physical-purge claim. This code does not disable
retention policies or erase retained versions. Shared/evidence attachments and
private Inbox/profile files are never selected for object deletion.

## Confirmation, jobs and safeguards

- Four independent unchecked checkboxes; no user-supplied document paths or
  collection names are accepted. Strict canonical `role:admin`, `approved:true`,
  non-disabled/non-revoked/non-deletion-pending identity is checked server-side.
  VIP and master-email overrides cannot execute cleanup.
- Preview changes only server-only cleanup metadata. Exact category/root and
  nested-document counts represent the scanned versions, not a promise that
  the live database cannot change before confirmation. New/changed records are
  preserved and residuals reported, rather than silently added to authorization.
- A separate confirmation step requires exact `DELETE SELECTED DATA` and the
  server plan hash. Repeated confirmation/request IDs are idempotent. One global
  job lock prevents overlapping cleanup scopes; other approved Admins can recover
  an abandoned active job by previewing the same category selection.
- Confirmation temporarily freezes all client/reference writes as described above. Permanent per-root fences precede child-first batches of at most
  100 deletions. Versions, canonical authorization, new report evidence, retention
  flags and active newsletter analysis are checked again in transactions.
- `newsletters/current` is a reusable pointer: its permanent fence becomes
  `descendantsOnly:true` after completion/cancellation. Future legitimate pointer
  publishing is allowed after unlocking, while stale `current/chunks` writes
  remain denied. All other root fences remain permanent. Generated events/highlights share
  the old/new edition fence instead of making one unique rules read per item;
  this preserves atomic publication of more than 20 generated news records.
  The backend writes that parent fence before any derived deletion. Edition-specific
  `newsletter_draft_cleanup` tombstones stop old upload/analysis retries.
- Each deletion batch and its cursor/counters commit atomically. Worker lease
  ownership prevents duplicate processing. Transient failures pause, with manual
  resume. Changed/protected partial roots become holds. Cancellation stops at the
  transaction boundary and releases the collection lock while keeping root
  fences; already deleted documents cannot be restored.
- Reports in `moderation_reports` are retained. Any matching report protects its
  root. Nested legal/evidence/unknown retention flags protect the whole root.
  Proven related newsletter roots inherit preview-time edition holds. A report
  created after some earlier batches cannot restore records already removed;
  subsequent batches stop and retain remaining evidence.
- Accurate counters distinguish actual documents deleted, root records held,
  remaining selected documents, failed operations (cumulative, including recovered
  failures), and held media references. A residual scan prevents a false full-purge
  completion. Hold reason codes are stored without resident content.
- Minimal server-only `database_cleanup_audit/{jobId}` records operator UID,
  initiating Admin UID, selected categories, timestamps and outcome/counts. Job
  manifests contain paths/versions/reason codes, no resident text, PDF bytes,
  attachment URLs or tokens. Do not mistake these receipts/fences for leftover
  resident content; they are deliberately outside the purge.

## Controlled deployment prerequisites — NOT activated

The implementation is prepared locally, but is **not ready for an uncoordinated
functions-only deployment**. Separate approval and production preflight are needed:

1. Inventory/review every deployed server writer and alias, scheduler and external
   service using Admin credentials. The receipt pins the full function inventory
   plus exact guarded writer revisions; unexpected drift blocks execution.
   Required guarded deployments: `manageInboxConversation`,
   `revokeInboxGroupMemberships`, `syncResidentDirectory`, `submitSafetyReport`,
   `reviewSafetyReport`, `newsletterApi`, `runNewsletterAnalysis`, plus
   `monitorInboxRetention` if deployed. Named-database variants need the guard too.
   No Gemini extraction algorithm or notification-delivery logic is changed.
2. Separately approve a maintenance window and suppression of existing generic
   media reapers and account-deletion execution workers. Verify no in-flight
   invocation or processing job remains. Keep account-deletion policy receipts
   unchanged until their own coordinated rollout is approved. Do not rely solely
   on an empty job query to prevent a new worker starting later.
3. Coordinate default/Storage rules with existing deletion-worker hash safeguards.
   Prepared default SHA:
   `3f4a221d543783499b0b0cd53369f2177f6137fb5d3f8446137309f6ac941360`.
   Prepared Storage SHA:
   `06d24519f84deb79f2cd6d24248f1ac45242e841cdd69d2ac56a5b3ee4fcbdae`.
   Named deny-all stays
   `8493ef2624b905208328f9ac7116dfe59e8349b1d24a8c3aa0883ceabd0da02d`.
   No account-deletion pins/receipts or live rules were edited. `RULES.md` records
   candidate provenance and emulator commands.
4. Provision the dedicated `townloop-database-cleanup` identity with reviewed
   least privileges: default Firestore cleanup writes, both databases read,
   named cleanup-control writes only where IAM permits, Auth identity read,
   rules/Functions inventory read, bucket metadata/list/get/delete. No Auth
   deletion permission. Evaluate any coarse Firestore IAM grant explicitly;
   application allowlists constrain mutations but are not IAM resource scoping.
5. Prepare with `node security/database-cleanup/prepare.cjs`. Output is ignored
   `.release/database-cleanup`, isolated exports `manageDatabaseCleanup` and
   `runDatabaseCleanup` (one-minute scheduler), environment **false**, unapproved
   version-2 receipt. No new composite indexes are required.
6. After approval, deploy guarded writers first, coordinated default/Storage
   candidates next, disabled isolated cleanup functions next. Verify backend
   health, native auth/reader/uploads and denials with the barrier absent. Do not
   deploy named rules, Hosting or unrelated codebases.
7. Review bucket policies, approved media provenance cutover receipt and complete
   function inventory. A separately approved `database_cleanup_policies/current`
   must match pins, revision map, inventory hash, mode
   `exclusive-generation-fenced-v2`, and disabled-reaper acknowledgment. Only
   then may the cleanup environment flag be enabled. No purge is implied by
   deployment: an approved Admin must preview, select and type-confirm a job.
8. Release the native manager additions via separately approved compatible OTA;
   no new native dependency or APK is needed. Test on physical Android/iPhone.
   Emulator success is not physical-device or production verification.

No backup, IAM permission, live policy, worker configuration, production data,
rule, function or deployment has been activated or changed by this task.

## Local verification

Use only disposable `demo-*` projects and a loopback Firestore emulator:

```sh
FIRESTORE_EMULATOR_HOST=127.0.0.1:8189 node --test security/database-cleanup/engine.emulator.test.cjs security/database-cleanup/storage.emulator.test.cjs security/database-cleanup/safety.test.cjs
FIRESTORE_EMULATOR_HOST=127.0.0.1:8189 node --test security/database-cleanup/rules.emulator.test.mjs
node --import tsx --test native/tests/database-cleanup.test.ts native/tests/admin-menu.test.ts native/tests/admin-animation.test.ts
node security/database-cleanup/prepare.cjs
```

Engine tests cover Admin/VIP/Crew/Resident/pending/disabled/revoked boundaries,
selection isolation, genuine nested deletion, missing parents, two-party job
recovery, typed/hash confirmation, duplicate requests/concurrent workers,
partial failure/cancel/resume, 100-document checkpoints, reports introduced at
the deletion boundary, existing retention, active Gemini, protected newsletter
dependencies, manual/Home exclusions, changed/new records, and deployment gates.
Rules tests compare against the pinned prior default rules and verify selected
locks, permanent fences, metadata denial and unchanged read/role boundaries.

Storage tests use actual synthetic Firestore emulator records with an in-memory
conditional-generation object adapter, including named-database references,
shared Inbox/profile/evidence files, missing metadata, generation changes,
object/bucket retention, stale leases, lost responses, cancellation and sealed
release. They do not exercise real GCS deletes. The separate paired Storage
runtime emulator test verifies actual candidate-rule compilation and upload,
metadata/update/delete denial, including a pre-barrier resumable session.
Server writer barrier and newsletter-job emulator tests verify transaction
conflicts and safe resumable job behavior. No real resident data is used.
