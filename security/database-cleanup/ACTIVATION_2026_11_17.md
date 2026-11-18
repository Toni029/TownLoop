# Database Cleanup activation — 2026-11-17

**Historical preview stage — superseded by the completed [coordinated activation](COORDINATED_ACTIVATION.md#production-release-record).**

## Outcome

Restored the installed app's `manageDatabaseCleanup` endpoint in
`cc-livingcommunity-app`, `us-central1`, using the existing stateless read-only
implementation and existing `townloop-cleanup-preview` service identity.
Revision: `managedatabasecleanup-00003-sec`; codebase: `database-cleanup-preview`.
The old service was absent (404), rather than an Android runtime problem.

This deployment deliberately does NOT activate permanent cleanup. It exports one
callable, imports no purge engine, has no scheduler, creates no jobs or controls,
and rejects every non-preview action server-side. Runtime IAM has only the
existing custom preview-reader role, no direct bucket grant and no project parent.
No IAM, rules, policy receipt, account worker, resident document or file was changed.

The preview includes all four current category roots, including Work Order number
reservations and Marketplace conversation descendants. Marketplace conversations
are explicitly held candidates: this read-only inventory does not certify their
listing attribution or media exclusivity. Ordinary Inbox roots are never scanned.
All file metadata is presented as held, not as deletion-authorized inventory.
Counts are live observations, not a transactional snapshot. A live verification
exposed repeated document reads and per-root report queries exhausting the time
budget; masked list snapshots are now reused and reports fetched once per request.
Retained chunk traversal now uses at most four concurrent metadata reads, without
downloading PDF content or increasing the existing inventory/time limits. Oversized inventories
fail rather than present partial results as complete.

The current native client already calls this exact endpoint and supports
`readOnly:true`, `enabled:false` responses with no confirmation hash. No OTA or AAB
was published. Confirmation cannot proceed on this response. Physical-phone Admin
preview verification is still required; do not equate an unsigned 401 with a
successful signed-in Admin preview.

## Permanent activation stopped at existing prerequisites

- Current default rules SHA-256:
  `4d1c449fc847c8273efdee3b813d16a1e996dd0fdfc766e3cfb09c4ace8eb6d0`.
  Bulk candidate pin is
  `ee68e66da3e7e4e55546e77790ca674ca4c550e1ea816aa54b5902dfaded3c42`.
- Current Storage rules:
  `9aac5f82b7e31fef034b92340714136ec943232de88b1a0076c001331958c3e9`.
  Bulk candidate pin is
  `06d24519f84deb79f2cd6d24248f1ac45242e841cdd69d2ac56a5b3ee4fcbdae`.
- Named deny-all rules remain
  `8493ef2624b905208328f9ac7116dfe59e8349b1d24a8c3aa0883ceabd0da02d`.
- `fulfillApprovedAccountDeletions` remains revision `00005-kux`, with all
  existing deletion enable flags true. Its separate receipt block is not proof
  of explicit quiescence required by the bulk-cleanup gate. No pause, receipt
  acknowledgment, invocation or resume was performed.
- No cleanup policy receipt, active control or queued cleanup jobs existed in
  preflight. Post-deployment job inventory remains empty.

The full gate therefore cannot pass. Do not fabricate a receipt using current
rules hashes, relax the gate, or grant destructive rights to the preview reader.
Use the existing Marketplace release plan for a separately coordinated full
activation: prove a controlled account-worker maintenance pause safe (including
in-flight work), deploy matching guarded writers and compatible reviewed rules,
provision least-privilege destructive runtime IAM, verify exact deployed revisions,
then approve the matching receipt/flag. Preserve account retention and its receipt.
A maintenance pause would defer eligible account deletions; it must not shorten
retention or cause automatic resumption. Report the current job consequences before
making that change. No cleanup scheduler is needed by the current request-driven
bulk engine. Future full handler deployment must reuse the existing function's
codebase (`database-cleanup-preview`) rather than accidentally create a duplicate.

## Verification

Nine focused read-only tests passed: approved Admin gate; Resident/Crew/VIP and
pending rejection; every job action rejected; nested/category counts; manual News
preservation; no duplicate reads of masked inventory snapshots; source has no
mutators/purge imports; 81-chunk nested inventory with at most four simultaneous
metadata reads. One existing all-category
Auth/Firestore/Storage emulator scenario passed, including actual synthetic media
and document deletion, retry, ownership/hold protections and unrelated-data checks.

Production management checks confirm the endpoint ACTIVE and unsigned callable
requests rejected with 401 UNAUTHENTICATED. Pre/post rules hashes and account-worker
revision/flags match; cleanup jobs remain absent. Zero cleanup jobs were submitted
or executed and zero resident records/files were deleted by this rollout.
Raw deployment and read-only verification artifacts are local under
`.release/cleanup-activation-preflight/` (ignored; no secrets committed).

Production read-only inventory completed for each category using the existing
operator's read credentials and the same inventory logic (not an impersonated
resident session or a signed-in callable test):

| Category | Firestore documents | Storage generations inventoried |
| --- | ---: | ---: |
| Work Orders / number reservations | 21 | 16 |
| Discussion | 14 | 6 |
| Marketplace / conversation candidates | 12 | 15 |
| Newsletter editions, chunks and derived data | 877 | 1 |

These are observations, not purge eligibility. Existing operator credentials could
not impersonate the preview runtime identity (403); no impersonation IAM grant was
added. Its deployed reader permissions were checked, but an actual signed-in Admin
phone/callable preview remains the final end-to-end check. No authentication token
was issued for another user during verification.
