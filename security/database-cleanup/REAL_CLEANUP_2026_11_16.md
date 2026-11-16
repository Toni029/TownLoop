# Real selected-category cleanup — local implementation, November 16, 2026

Supersedes the read-only native release mode and the new-identity/scheduled-worker
instructions in older README/READ_ONLY_PREVIEW notes. No production data changed,
cloud deployment, push, OTA or binary build occurred.

## Implementation

Native now calls manageDatabaseCleanup rather than previewDatabaseCleanup. All four
checkboxes still start unchecked; exact root/nested document counts and file scope
precede a second screen and exact DELETE SELECTED DATA confirmation. Current approved
Admin authorization is checked server-side. VIP, Crew and Residents cannot execute.

The existing engine performs real conditional Storage deletes and child-first
Firestore transaction batches, leases, durable cursors, idempotent confirmation,
operator audits, cancellation and explicit Resume after errors. Final inventory
reports residuals; completed_with_holds never means a full purge.

No new scheduler or service identity. The sole callable advances at most four
bounded steps per request for the requested job only. Existing foreground status
refreshes drive progress. A failed request can be retried and account/screen changes
stop client advancement. Keep the screen open; closing does not lose the job but
stops further batches after any in-flight request. Another approved Admin can reopen
its selection and continue/cancel safely. The global write barrier can remain until
that happens; the UI discloses the temporary read-only maintenance period.

The callable reuses the existing Firebase runtime identity. Its real IAM permissions
must be approved/verified before release; this change provisions no identities or
permissions. The read-only identity is not silently granted delete permission.

## Exact scope

- workOrders: work_orders and descendants (all statuses), embedded/subsequent Crew
  media and responses, plus work_order_numbers reservations and descendants. Known
  protected orders protect their linked number record. Missing/invalid reservation
  linkage remains held. Shared allocator counters remain system configuration and
  are not reset; cleanup must not restart numbering or touch resident accounts.
- discussion: discussion_feed, posts and descendants; embedded comments/reactions.
- marketplace: marketplace_posts, marketItems and descendants. Listing summary
  thumbnails in canonical Marketplace chats are cleared and listingDeleted set;
  messages/private attachments are untouched. The same chat helper is reused, with
  existing-parent retirement allowed only under the confirmed cleanup barrier.
- newsletters: newsletters (current, all editions/drafts and chunks), completed
  newsletter_analysis_jobs, proven isAiExtracted + newsletterId community_events
  and community_highlights including nested RSVP responses/embedded attendees.
  Manual/unlinked activities and the independent Home calendar remain unchanged.

Storage inventory uses the existing work_orders/, feed/, marketplace/ and
newsletters/ namespaces. Social/Work Order files require trusted immutable upload
metadata and the approved provenance cutover. Canonical newsletter PDF ownership
requires exact edition/document.pdf path, PDF MIME type, generation/metageneration,
correct bucket, matching root/pointer and an unfenced external-reference scan.
The current pointer does not claim a second copy of its edition PDF. Confirmed,
unheld newsletter roots in the same deletion plan may share that edition file;
protected edition dependencies propagate across roots.

The existing global reference-write barrier, matching default/Storage rules and
pinned guarded server writers are required throughout deletion. This is the existing
bulk engine's protection against the per-record race, not a newly invented cleanup
architecture. Both database reference inventories remain read-only except existing
server-only cleanup controls. Named resident documents/deny-all rules are untouched.

## Retention and incomplete scope

Bucket soft deletion/versioning does not block removal of an ACTIVE file. Historic
or recovery generations are reported separately when inventoried; they are not
purged or claimed erased. Current Firebase recovery, backups and external Gemini
copies remain subject to their policies. No retention policy is disabled.

Explicit legal/evidence/Storage holds, protected Work Order retention (including
existing retentionVersion:1 30-day completion policy), reported records, private
chat attachment references, ambiguous ownership, orphan files without trustworthy
association, unsupported newsletter media and active Gemini analysis remain held
and counted. One blocked attachment protects its root. Bounds fail visibly rather
than authorize incomplete inventories. System cleanup receipts/fences/audits and
numbering counters are preserved. This is not a promise to erase all backups,
provider copies, orphan files, retained records or private history.

## Required release approval — nothing activated

1. Scoped existing manageDatabaseCleanup callable using databaseCleanupEntry.cjs;
   no runDatabaseCleanup schedule. prepare.cjs packages the callable and helpers
   locally with TOWNLOOP_DATABASE_CLEANUP_ENABLED=false.
2. Existing reviewed default Firestore and Storage bulk-cleanup rule candidates;
   named deny-all unchanged. Coordinate any separately prepared rule candidates
   rather than silently overwriting them. Exact hashes remain in databaseCleanupSafety.
3. Existing server writers must honor the barrier and match the complete pinned
   inventory: manageInboxConversation, revokeInboxGroupMemberships,
   syncResidentDirectory, submitSafetyReport, reviewSafetyReport, newsletterApi,
   runNewsletterAnalysis and monitorInboxRetention if deployed. These are existing
   compatibility prerequisites, not new features or providers.
4. Existing runtime IAM must cover scoped Firestore operations, named read/control
   operations, Auth identity READ, rule/function metadata verification and bucket
   list/get/delete. No Auth deletion, new service identity or secret is introduced.
5. Matching approved database_cleanup_policies/current safety receipt and the
   narrow TOWNLOOP_DATABASE_CLEANUP_ENABLED flag. Generic/narrow automatic media
   reapers must be safely quiescent during bulk cleanup. Current account-deletion
   safety gate is deliberately unchanged: if its worker is not proven quiescent by
   the existing gate, activation remains blocked. Do not pause, resume, deploy or
   acknowledge that worker under this implementation approval. A safe resolution
   requires a separate release decision; do not bypass the gate.
6. Matching native Production release. These changes add no native dependency; use
   an OTA only after confirming the installed runtime. Do not bundle unrelated
   prepared native modules or override fingerprints. Otherwise obtain separate
   approval for a binary. No publication was attempted here.

## Sole verification

One scenario in functions/databaseCleanup.selected.e2e.cjs passed using disposable
Auth/Firestore/Storage emulators. It compiled the real bulk candidate rules and
performed actual synthetic object/document deletes (no fake delete adapter).
A metadata-only facade maps the disposable bucket into the allowlisted test scope;
no requests target production. A synthetic approved policy/guarded environment
represents the deployment prerequisites; no live IAM/function-inventory health is
claimed. Emulated soft-delete policy tests active-removal admission, not real backup
expiry or provider erasure.

Verified single and multiple category selections, exact preview and phrase rejection,
Resident/Crew/VIP denial, confirmed write-barrier rejection of a new profile reference,
Storage failure/Resume without lost progress, root/descendant/number-record deletion,
original/Crew photos and video deletion, newsletter PDF/chunks/AI/event/RSVP/highlight
removal, current-pointer deduplication, Marketplace chat continuity without previews,
manual activity/account/private Inbox preservation, protected evidence and ambiguous
file retention, truthful completed_with_holds. One scenario passed, zero failed.
No additional suite, production purge or physical-phone verification was performed.
