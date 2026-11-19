# Disabled account-deletion staging — November 19, 2026

Owner authorized scoped production staging, not activation or resident deletion.
Source base: 51874c8 plus the locally implemented deletion changes listed in
SIMPLIFIED_WORKFLOW_2026_11_19.md. No push, OTA, Hosting publish, AAB or Play release.

## Exact additional repository edits in this release pass

- functions/accountDeletionJobEntry.cjs — fail closed before every event mutation,
  including receipt expiry, while staging flags are disabled.
- functions/accountDeletionJobEntry.test.cjs — disabled-event replay regression.
- security/account-deletion/SIMPLIFIED_WORKFLOW_2026_11_19.md — link original
  implementation evidence to this live staged-deployment record.
- security/account-deletion/STAGED_DEPLOYMENT_2026_11_19.md — this release record.

The previously prepared implementation files were deployed unchanged apart from that
small event guard; their complete grouped list is in SIMPLIFIED_WORKFLOW_2026_11_19.md.
Generated deployment configs were isolated under the ignored
.release/deletion-stage-20261119/packages/firebase.processing.json and
firebase.review.json, with source folders processing/ and review/. They deploy only
this record's eight explicitly filtered function names under work-order-retention.
Existing unrelated dirty workspace files were preserved. No commit or push was made.

## Deployed components

Firebase project: cc-livingcommunity-app. Existing Node22 runtime and compute service
identity preserved; no project/bucket IAM grants were added. Existing project Editor,
event receiver/invoker grants and bucket/default-object ACL permissions were inspected.
Per-object unusual ACL/ownership remains an explicit processing exception, not an assumed
permission grant. Existing private-event invocation protection is verified.

| Function | Revision | Region |
|---|---|---|
| requestAccountDeletion | requestaccountdeletion-00003-yab | us-central1 |
| submitAccountDeletionRequest | submitaccountdeletionrequest-00003-cop | us-central1 |
| getAccountDeletionStatus | getaccountdeletionstatus-00002-fuy | us-central1 |
| listAccountDeletionRequests | listaccountdeletionrequests-00002-vav | us-central1 |
| reviewAccountDeletionRequest | reviewaccountdeletionrequest-00004-muv | us-central1 |
| fulfillApprovedAccountDeletions | fulfillapprovedaccountdeletions-00008-pay | us-central1 |
| processAccountDeletionJob | processaccountdeletionjob-00001-lux | us-central1 |
| reconcileAccountDeletionUpload | reconcileaccountdeletionupload-00001-key | us-east1 |

All eight have TOWNLOOP_ACCOUNT_DELETION_ENABLED=false,
TOWNLOOP_SCOPED_DELETION_ENABLED=false and
TOWNLOOP_AUTOMATIC_ACCOUNT_DELETION_ENABLED=false.
The existing scheduler remains on its original five-minute schedule and identity;
its handler exits without authorizing work. New event triggers are installed, but
execution and receipt metadata pruning return without mutation while disabled.
The account policy receipt remains version 2, unchanged. No v3 policy is acknowledged.

The default account_deletion_jobs composite index (workflowVersion/status/autoDeleteAt)
is READY: projects/cc-livingcommunity-app/databases/(default)/collectionGroups/account_deletion_jobs/indexes/CICAgLiT6IEK.
Only database_cleanup_policies/current.referenceWriterRevisions and
functionInventorySha256 were conditionally refreshed to preserve cleanup compatibility.
Receipt update: 2026-11-19T19:22:44.140503Z. No cleanup activation flag changed.
No Firestore/Storage rules changed. New v3ReceiptExpiresAt TTL remains unconfigured.

## Verification

- Original implementation evidence retained: 120 distinct backend checks, 29 native
  checks, eight disposable Auth/Firestore/Storage emulator scenarios; TypeScript/lint.
- This staging pass: eight focused event/packaging tests passed, including a new test
  that disabled processing also prevents completed-proof metadata deletion.
- Actual deployed source archives were downloaded read-only and compared byte-for-byte
  to both prepared source packages (30 processing files, 13 review files). Processing
  includes deletionScopeRules.json and the complete local module dependency closure.
- Processing archive SHA256: 6011c53083a150e5abfa5c9b55c3c770df7baa6d3cf87893ceddbaad126769c3.
- Review archive SHA256: b848b9e3cfd147bd89f7c83ca7547b0b77de44de8d49e9fcef034dec0468eea6.
- Five live callable HTTP requests without authentication returned 401/UNAUTHENTICATED.
  No authenticated resident mutation or production functional deletion test was made.
- New event runtimes are ready and have no public invoker grant. New-revision error
  log count: 0, as checked at staging. No monitoring loop.
- Both historical retention_pending/scoped_retention documents matched the preflight
  snapshot exactly, including December 27/29 deadlines and identity-deletion evidence.
- Account/media policy documents, coordination lock, all three rules releases, and
  unrelated function revisions/configurations were unchanged. No production cleanup,
  resident deletion, account-data mutation or historical migration was performed.
- One transient Cloud Functions control-plane 503 was retried successfully by Firebase;
  no credential, signing or IAM workaround was made.

Private operational snapshots, logs, generated configs and archives remain ignored
under .release/deletion-stage-20261119; no keys or resident content enter source control.

## Client and disclosure release is withheld

Google Play build 8e08c61b-a49b-4025-8aaf-20ac97dff94f, code 7, has native appVersion 0.1.0, channel production,
runtime d32dc5688ac21165ce8f8d8bdf6ec07b04b5bc93. The current prepared v1.0.0 native
configuration fingerprints to 82b2092610a49aeaf17fcead348c5af955640bad. These do not match.
No runtime override, OTA, new build or Google Play submission was attempted. The deletion
feature adds no native dependency; the already-prepared v1 candidate's native version/config
still requires its separately approved final AAB. No claim that a phone received anything.

The new 30-day client/public wording is not accurate as the active policy while staging
is inactive. Therefore the proposed screens/disclosures remain staged, not published.
Distribute only through a coordinated candidate/policy cutover, or first make inactive
policy presentation explicitly accurate. Old clients' ordinary login/uploads are unchanged;
old Admin clients must update before they can submit generation-bound v3 review decisions.

## Activation boundary and exact next approval

Conditional GO for the completed disabled backend stage; NO-GO for real-account
activation until client compatibility/distribution and the following cutover are approved.

1. Authorize one final signed Android 1.0.0 candidate AAB using remote signing (expected
   next code 8; verify uniqueness), without Production promotion. Resolve safe inactive
   client wording before distributing it, then perform Samsung acceptance.
2. Recheck the exact current hashes, writer receipt, index, private triggers and queue
   immediately before activation. Inventory any intervening legacy pending submissions;
   do not silently migrate or accelerate them. Historical December jobs remain excluded.
3. Separately approve the v3 policy receipt/effectiveFrom/verified-coverage fields,
   matching account/scoped processing flags and automatic-timeout flag, NEW-FIELD-only
   receipt TTL, and accurately dated client/public policy cutover. Never activate the
   UNAPPROVED template directly or enable TTL on legacy retentionDueAt/expiresAt fields.
4. Only newly created v3 generations follow immediate approval and 30-day authorization;
   original requests/deadlines are not retroactively rewritten. The 65-minute security
   drain and ownership/evidence holds remain. Authorized cleanup is not instant erasure.
5. Rollback before processing: keep these flags false, retain fences/proofs and jobs,
   and hold policy/client cutover. Keep the verified package; do not restore the known
   broken missing-manifest worker or permissive rules. After activation, disabling flags
   stops new starts/retries but does not undo an in-flight deletion; quiescence must be
   verified before changing execution state. Auth/record/file erasure cannot be undone
   by code rollback. Any data restoration requires a separately approved recovery plan.

## Minimal Android launch checklist

1. Finish the existing individual post/listing/authorized Work Order media cleanup
   rollout: upload prerequisites are active, but individual media-delete flags remain
   false; do not activate global cleanup or delete demonstration content as a substitute.
2. Verify/deploy the existing newsletter draft-discard backend path against retained PDF
   data, keeping publishing separate. No Gemini redesign or unrelated cleanup activation.
3. Samsung acceptance on the final candidate: startup/login, role permissions, uploads,
   Inbox/notifications, News/PDF/Gemini, Work Orders, and the new deletion review/status UX.
4. Owner verifies Play Console Production access/testing eligibility, listing/screenshots,
   Data Safety, Health Apps, content rating/adults-only/Child Safety, public deletion/privacy
   URLs and a pre-approved Resident reviewer login. These Console facts are not certified here.
5. Build/verify the separately approved signed v1 AAB, then obtain separate approval for
   Play submission/promotion. Any final demonstration-data purge needs its own confirmation.

Backups/PITR or a new monitoring SDK are separate operational choices, not newly invented
mandatory Play requirements. No new audit or unrelated implementation was started.
