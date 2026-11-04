# Unpublished newsletter PDF cleanup — local only, disabled

Owner policy: explicit **Discard uploaded PDF** removes an unpublished upload;
otherwise an abandoned upload becomes eligible after **24 hours without activity**.
An hourly sweep processes eligible drafts (normally within 24–25 hours). A failed
analysis is retryable during that window and does not delete the PDF immediately.
Closing the uploader or choosing another PDF leaves the older draft for expiry.

## Implemented scope

- `discardNewsletterDraft`: authenticated, canonical approved Admin/VIP only,
  checks account revocation. UI clears the upload only after server confirmation.
- `cleanupAbandonedNewsletterDrafts`: default-database hourly sweep, disabled by
  default, at most 25 eligible manifests per invocation. Metadata inventory is
  separate from PDF contents; no chunk bodies are read by cleanup.
- Both use the same transaction/fence mechanism and retry partially completed
  jobs. Current/published editions and any edition referenced by another
  newsletter record are excluded. Future/active writes reset the age using
  Firestore-assigned document updateTime, never client-provided dates.
- Active native review renews activity every five minutes while foregrounded.
  The analysis backend also renews it before reconstruction, including requests
  from older clients. The existing published newsletter is never replaced here.
- A private, server-owned `newsletter_draft_cleanup/<id>` fence prevents older
  clients from writing chunks, recreating the draft or publishing its ID after
  cleanup claims it. This small non-PDF record remains after the PDF chunks and
  manifest are purged. It contains no PDF, title, filename, email or resident UID.
- Chunk deletions are bounded transactional batches. Publication references are
  rechecked in each transaction; concurrent publication and cleanup cannot both
  win once the reviewed fence rules are deployed. Retries are idempotent.
- Only known native Firestore PDF manifests (`uploading`/`uploaded`) qualify.
  Historical parentless uploads, unknown schemas, inconsistent manifests,
  additional subcollections and externally stored/shared attachments fail closed.
  No Storage object is deleted or guessed at: the current native uploader stores
  PDFs exclusively as Firestore chunks. Legacy Storage objects require verified
  exclusive ownership/reference review separately. All six quarantined files stay
  untouched. Previously published archives are preserved.

## Approval and deployment dependencies — do not activate out of order

1. Read the fresh live **default** Firestore rules. Apply only the reviewed fence
   with `firestore-fence.cjs <snapshot> <output>` and review its diff. Do not deploy
   the repository's whole rules file blindly: other live changes must be retained.
   The patch refuses an unexpected newsletter block. Deploy and verify this narrow
   default-database patch only after approval. No named database or Storage rules.
2. Provision the dedicated identity
   `townloop-newsletter-cleanup@cc-livingcommunity-app.iam.gserviceaccount.com` with
   the approved Firestore data access scoped/conditioned to `(default)` where
   supported. No Storage, Gemini secret or named-database access is needed. Verify
   IAM before activation; never grant Editor/Owner to make deployment pass.
3. Prepare with `node security/newsletter-cleanup/prepare.cjs`. The isolated
   `firebase.newsletter-cleanup.json` exports only the discard callable and the
   hourly draft cleanup handler; it reuses the existing pinned Functions lock.
   Deploy that codebase disabled. No root function codebase, account deletion,
   conversation cleanup, notifications, Gemini secret or website changes.
4. Deploy only `newsletterApi` with the activity-renewal/PDF-discard check. Its
   writes still forward the signed-in manager's ID token and obey default rules.
   No new IAM permission or secret change is needed for that function.
5. After rules and backend verification, explicitly approve activation with BOTH
   `TOWNLOOP_NEWSLETTER_DRAFT_PURGE_ENABLED=true` and
   `TOWNLOOP_NEWSLETTER_DRAFT_FENCE_VERIFIED=v1`. Defaults do no deletion. Do not
   mistake a deployed disabled schedule for active destructive cleanup.
6. Release the compatible client subset for discard, activity and expiry wording.
   This is JavaScript-only; validate the installed runtime and exclude unrelated
   native Google configuration changes from an old-runtime OTA. No new APK is
   intrinsically required by this feature.
7. First inspect a read-only eligibility inventory against current records before
   the first destructive run. Do not automatically classify legacy orphan PDFs
   as failed uploads merely because the current pointer references another ID.

No production data was modified; no cleanup, schedule, rules, IAM, function, OTA
or build was deployed/activated during implementation.

## Focused verification

With the disposable local emulator at `127.0.0.1:8897`:
`FIRESTORE_EMULATOR_HOST=127.0.0.1:8897 node --test security/newsletter-cleanup/emulator.test.cjs`

Tests exercise real transactions and rules for Admin/VIP/resident authorization,
24-hour eligibility, recent activity, published/reference protection, ambiguous
orphans/additional records, restart after interruption, concurrent discards,
repeat requests and old-client resurrection/publication rejection. All accounts
and PDFs are local fixtures, not live Firebase users or resident data.
