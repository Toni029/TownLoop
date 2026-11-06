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

## Honest Storage limitation / activation blocker

Known candidate Storage namespaces are:

- Work Orders: `work_orders/{filename}`.
- Discussion: `feed/{filename}`.
- Marketplace: `marketplace/{filename}`.
- Historical newsletter files: `newsletters/{editionId}/document.pdf` and any
  explicitly referenced page images. Current native PDFs are Firestore chunks.

**This implementation deliberately does not delete Storage objects.** A stored
URL or root ownership field is not proof of exclusive use. Marketplace private
conversations can retain listing image references, and existing file-reference
writers lack a common atomic deletion fence. A reference scan alone has a race
with a new reference being written. Therefore any root with external media
references is held with its subtree, and the UI reports held media references
(not a fabricated count of physically verified files). Referenced/protected
newsletter editions also retain their linked roots. No shared file is purged.

The existing `cleanupDeleted_*` triggers could otherwise delete linked objects
indirectly after this manager deletes a root with no current media URL. The
activation guard checks the full Functions inventory and requires every generic
media reaper/trigger to be explicitly disabled. It refuses incomplete inventory,
enabled or unknown reaper state. **No existing reaper configuration is changed
here.** A reviewed exclusive-reference protocol and compatible suppression of
generic reapers are prerequisites for a complete media purge. This manager is
real selective Firestore deletion with explicit holds, **not a complete Storage
purge implementation or an activation-ready unrestricted reset**.

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
- Confirmation temporarily freezes client writes only to the selected root
  collections. Permanent per-root fences precede child-first batches of at most
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

## Prepared deployment — requires separate approval and remaining safeguards

1. Resolve the Storage/reference and generic-reaper blocker above. Do not disable
   unrelated live functionality or claim full Storage cleanup is implemented.
2. Coordinate the existing account-deletion worker default-rules pin and matching
   policy/receipt rollout. This candidate changes default rules SHA to
   `f8b5557e491b852a2ee2f755ac8020b3cbcb76817a4f8598c7f28c58c361d5d0`;
   deploying it alone could pause the existing account-deletion worker. **No
   worker pins or account-deletion receipts have been edited.** See `RULES.md`.
3. Provision a dedicated `townloop-database-cleanup` service identity with only
   required default Firestore read/write, Firebase Auth read/revocation checks,
   deployed-rules read and Functions-inventory read permissions. It requires
   no Auth deletion, Storage object deletion or named-database access. Review IAM
   scope explicitly; this document does not grant permissions.
4. Run `node security/database-cleanup/prepare.cjs`. It writes only ignored
   `.release/database-cleanup/`, with two exported functions:
   `manageDatabaseCleanup` and `runDatabaseCleanup` (one-minute scheduler).
   Destructive environment flag defaults to **false**. Main `functions/index.cjs`,
   root Firebase configuration and unrelated function codebases remain unchanged.
5. After separate approval, deploy only these functions and the coordinated
   **default-database** rules candidate. There are no new composite indexes:
   inventory uses paginated names and existing single-field queries. Do not select
   Hosting, Storage, the named DB, Gemini, notifications or unrelated functions.
6. An independently approved server-only `database_cleanup_policies/current`
   receipt must match exact project/database/rules/Storage pins and explicitly
   acknowledge the conservative media mode. The generated example is UNAPPROVED.
   Execution additionally requires the environment flag, current rules hashes and
   disabled generic media reapers. Preview/status/cancel do not authorize deletion.
7. Release the native UI through an approved compatible OTA; no new native
   dependency or binary is introduced. Confirm on physical Android and iPhone;
   automated checks are not physical-device verification.

No backups are activated or required by this package. A confirmed purge is
permanent, so an approved recovery arrangement is prudent before any future run.

## Local verification

Use only disposable `demo-*` projects and a loopback Firestore emulator:

```sh
FIRESTORE_EMULATOR_HOST=127.0.0.1:8189 node --test security/database-cleanup/engine.emulator.test.cjs security/database-cleanup/safety.test.cjs
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
