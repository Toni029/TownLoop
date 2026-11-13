# Focused deletion work — local only, November 13, 2026

No deployment, OTA, binary, IAM/rules/receipt update or production mutation occurred.
No cancelled registration/HMAC infrastructure, orphan scheduler or global cleanup
activation is restored. Native UI and confirmation behavior are unchanged.

## Post/listing deletion

Existing `mediaCleanup.cjs` contains the deleted-document triggers. Their new narrow
branch handles only default `marketplace_posts` and `discussion_feed`, under
`TOWNLOOP_POST_DELETE_MEDIA_ENABLED=true`. It defaults off. Keep the existing broad
`TOWNLOOP_MEDIA_CLEANUP_ENABLED` off; do not deploy/enable its draft, late-orphan or
cross-database reapers. The old broad retry path explicitly skips the new job kind.

`postMediaCleanup.cjs` reuses `media_cleanup_jobs` with event-idempotent jobs, per-job
leases, original-author identity from the deletion snapshot (including Admin/VIP
removal), safe media paths, exact original record/owner metadata, trusted upload
cutover, generation/metageneration conditions, per-file intent/progress and bounded
reference inventory. It never writes chats, profiles, newsletters or the named DB.
Explicit holds, moderation reports, shared/ambiguous references, replaced objects and
unqualified legacy metadata are retained with reasons. Partial Storage failures retry
via the existing deleted-document trigger's retry delivery; repeated delivery does not
repeat known completed removals. Ambiguous network outcomes are held rather than
fabricated as success. Google event retry retention is finite: a job still unresolved
beyond that window requires an authorized replay of that specific event/job, not a
broad reaper. No new Scheduler job is necessary for this implementation.

Active removal is distinct from the bucket's existing seven-day soft-delete recovery.
The job reports active_removed_recovery_pending, never complete physical purge merely
because the active file disappeared. Restoration or hard deletion is not performed.

### Mandatory unresolved safety gate — not activation-ready

The production adapter deliberately supplies NO `withReferenceProtection` callback.
A point-in-time reference scan plus conditional object generation deletion does not
prevent another record acquiring a reference during that interval. Generation checks
protect replacements, not newly added Firestore references. Current rules do not give
this narrow worker an authoritative exclusivity mechanism. Files therefore remain
`held/concurrent_reference_protection_required`, even if their metadata looks owned.
Tests use an explicit synthetic protected critical section; that is not production proof.

Do NOT enable the flag and claim media deletion is working. A separately reviewed,
small reference-write protection solution is required before activation. This work
neither adds another global write fence nor activates Database Cleanup to manufacture
that proof. Historical shared/unknown objects must remain retained. If a global fence
or broad writer migration would be required, stop for a scope decision instead of
silently reconstructing the cancelled architecture.

Existing triggers/retry worker returned404 on the inspected Gen2 endpoints; record
live scope/flags/rule hashes and sanitized ownership samples are in production-check.json.
No media deployment is currently approved. If the safety gate is resolved later, scope
release to cleanupDeleted_marketplace_posts and cleanupDeleted_discussion_feed and their
required helper source only. Event retry handles temporary failures without deploying
resumeMediaCleanup, expireMediaDrafts or cleanupLateOrphanMedia. Existing installed
Google Play/Preview clients already delete these documents: this is backend-only,
so no OTA, runtime override, new dependency or AAB is needed for the backend behavior.

## Existing account-deletion status and smallest correction

Fresh read-only checks: worker fulfillApprovedAccountDeletions ACTIVE, revision00005-kux.
All three existing account-deletion flags are true. Default4d1c… and Storage9aac… match;
secured named database is8493…. `deletion_policies/account` still acknowledges224a….
The worker checks this mismatch BEFORE claiming/querying account-deletion jobs.
Two approved jobs remain retention_pending/scoped_retention within their existing
60-calendar-day New York retention periods. No request, hold or deadline was changed.

The prepared account-receipt-correction.PROPOSED.json identifies the sole hash field
requiring separately approved acknowledgment. Do not alter the existing worker,
retention policy or rules just to bypass this mismatch. Before applying that correction,
verify current reviewer/audit authorization, holds and exact current production hashes
for those requests. Because all flags are already true, approval to acknowledge this
field is approval to allow automatic resumption on the next existing five-minute tick.
The60-day retention rule still applies; other reconciliation phases may resume earlier.
No live Auth identity or resident record was deleted to test this.

## Verification and limits

Focused unit tests cover both canonical collections, multi-photo/video deletion,
original owner under Admin/VIP deletion, partial Storage errors/retries, replacement
preconditions, shared links, moderation evidence, legacy/unknown files and private chat
reference preservation. Disposable Auth/Firestore emulator tests exercise actual live-
baseline role rules, durable held jobs/private-chat preservation, and the existing
scoped Auth-deletion step requiring both database completion receipts and60day retention.
The Storage delete adapter is synthetic; no physical phone or live Storage deletion is
claimed. Existing account worker/media and read-only global-cleanup tests are reused.

The first emulator attempt exposed an incomplete test policy fixture: the existing
worker correctly did nothing without its approved policy. The fixture was completed;
production authorization was not weakened to make the test pass.

No new secrets, identities, indexes, paid provider, registration service or scheduler
is introduced. Existing Functions/Eventarc retry, Firestore job/reference reads and
Storage metadata operations have ordinary usage costs if later deployed/activated;
full reference scans can become expensive, so activation still requires bounded scope.

Final local verification: 34 focused backend checks and3 Auth/Firestore emulator checks
passed. Conditional Storage deletions use a synthetic adapter. Root functions/index.cjs
exports only the two deleted-post triggers from mediaCleanup.cjs; its broad schedulers,
late-orphan and draft handlers remain unexported. Deletion is not activation-ready for
the reason above. No existing account-deletion source or policy was modified.

The canonical delete handlers cannot fall through to the old broad worker even when
its legacy flag is true; this was verified red/green. Fresh local package exports only
the two targeted triggers. All unrelated source/configuration remains unchanged.
