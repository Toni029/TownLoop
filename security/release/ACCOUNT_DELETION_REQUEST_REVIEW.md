# Account deletion — approved local policy implementation

Prepared locally only. No resident records/files were read or changed; no policy was imported, no worker enabled and no service deployed. The pending Marketplace layout change is outside this release scope.

## Approved policy

See `account-deletion-policy.APPROVED-LOCAL.json`. Independent Admin/VIP review within 3 community business days (Monday–Friday, America/New_York); unresolved requests escalate after 7 calendar days. Approval targets personal-data processing within 7 calendar days. The original request anchors the maximum 60-calendar-day ordinary retention window. Delay, retries and review do not restart clocks. No holiday calendar is configured.

Verified requests cannot be arbitrarily rejected: the implementation only closes documented requester withdrawals without deletion. Legal/security delays require a reason, case reference and finite review date within the original 60-day window. The policy does not authorize indefinite legal holds. Any legal requirement beyond this scope needs a separate specific, expiring policy decision.

## Implemented and held

- Existing verified, recently reauthenticated request endpoint and deterministic duplicate prevention remain intact.
- Backend canonical Admin/VIP checks and transactional independent decisions; no self-approval. Decision and escalation receipts are durable and bounded.
- Status APIs and native/public UI expose dates, documented delay/withdrawal reasons and escalations. The hourly escalation worker records an office-queue escalation only; it is disabled by default and sends no external notifications.
- Canonical v2 processing uses bounded inventory pages, durable per-record receipts, transactions, generation-safe media cleanup infrastructure and the existing scheduler lease. Interrupted phases retry; `failed` jobs remain eligible and visible.
- Deletes owned social parents, only the resident's verified-UID comments on other parents, private profile, device tokens, blocks and Firebase Auth. Other residents' records/keys are not erased. Medications/checklists are local in the inspected implementation, rather than a newly invented server collection.
- Anonymizes owned Work Orders to minimal maintenance/ticket fields; never deletes permanent number reservations. Recalculates surviving crew-resolution indices when removing a resident comment.
- Redacts verified-UID chat identity/message fields without copying or exposing another participant's text. This is redaction, not a claim that old document IDs or all unstructured mentions are irreversibly anonymous.
- Shared minimal audit projections and account inventory/review receipts have bounded 60-day expiry. Withdrawn-request receipts expire without deleting that user's account.
- Exact linked media deletion remains policy/cutover/generation gated. Detached Work Order media requires the parent still be server-redacted. The six quarantined objects remain unlinked and excluded; no token revocation or file changes were performed.
- Native client clears both protected and legacy account-specific reminders/caches only after authoritative server deletion evidence. Late queued home writes are blocked in that app session. Offline/revoked-token errors and normal sign-out are not deletion proof and do not erase data.

## Why activation is still held

The local candidate deliberately sets `identityCoverageVerified`, `mediaCoverageVerified` and `databaseScopeVerified` false; v2 approval/processing readiness requires all three. No new live investigation was performed to assert those proofs.

1. Legacy name-only/UID-missing references cannot be safely matched by this UID inventory. Free-text newsletter/highlight references and unsupported schemas remain `needs_review`, never complete. Their resolution must be verified before activation.
2. Removed-comment attachments, avatar files and pre-cutover media need proven exact ownership/link cleanup. Unknown records must not be declared deleted; quarantine remains an explicit preservation exception requiring independent resolution.
3. Verify the named hosted-web database's personal-data scope independently. This worker targets `(default)` only and must not imply erasure from another database. No database selection or Hosting was changed.
4. Client cleanup is verified on a live server deletion flag or Firebase `auth/user-not-found`. A long-offline device whose session is revoked before that proof arrives cannot be claimed remotely erased. Legacy unassigned browser reminder data also needs an ownership-safe cleanup path. Existing browser clear helpers are not proof of a deployed cleanup flow.
5. Assign staffed office escalation ownership/alert delivery and configure the separate 60-day backup lifecycle. The queue is not a guarantee that a person acts on it.

`TOWNLOOP_ACCOUNT_DELETION_ENABLED`, `TOWNLOOP_MEDIA_CLEANUP_ENABLED` and `TOWNLOOP_DELETION_REVIEW_MONITOR_ENABLED` remain off by default. Deployments, metadata proof/migrations, worker activation, account/file deletion, policy publication, Hosting changes, OTA and APK builds remain unauthorized by this local preparation task.

## Staged review-only release (supersedes approval/queue coupling above)

Stage 1 records approval as `approved_held` with `review.processingAuthorized=false`.
It does NOT queue or authorize deletion, even if retention proofs or worker flags are true.
A future separately approved processing-release action must verify all proofs and explicitly
promote a reviewed job; no such action is exposed by this release. Do not manually flip flags
or edit jobs to bypass these gates. Approval still starts the existing completion-target clock;
holds do not extend the original deadlines. Do not leave this stage operating indefinitely.

### Exact release scope — requires separate owner approval

Project `cc-livingcommunity-app`, region `us-central1`, Firestore `(default)` only.
Prepare `.release/deletion-review` with `node functions/tools/prepare-deletion-review.cjs`.
This deterministic artifact contains only the review module, pure policy/deadline helpers,
bootstrap and existing dependency manifests. It cannot load the deletion/media engines or a
scheduled worker. Never use a broad codebase deploy with this reduced export set, and never
accept a prompt to delete other functions.

After approval, deploy ONLY:

```sh
firebase deploy --project cc-livingcommunity-app --config firebase.deletion-review.json --only functions:work-order-retention:requestAccountDeletion,functions:work-order-retention:submitAccountDeletionRequest,functions:work-order-retention:getAccountDeletionStatus,functions:work-order-retention:listAccountDeletionRequests,functions:work-order-retention:reviewAccountDeletionRequest
```

Keep existing service identities, invocation configuration, endpoint names, revoked-session
checks, recent request reauthentication and canonical Admin/VIP authorization. Old request
payloads remain supported; no resident migration or rules change is required. The existing
`account_deletion_jobs` status/lastAttemptAt index must be READY before queue verification;
it is already in `firestore.indexes.json`. If absent, deploying that index alone requires
explicit approval; do not deploy all indexes/rules incidentally.

Then publish the reviewed native request/status/review UI to **Preview only**, verifying the
installed APK's exact runtime at publication. These changes add no native dependency and
need no APK. Publish from a clean release snapshot excluding the unrelated Marketplace
layout change. The public page's held-status label is prepared locally only: no Hosting
release is included. Existing hosted submissions keep the same callable protocol, but public
status publication requires a separately approved website change.

Essential deployment gates: confirm existing destructive/scheduled services remain disabled,
confirm only these five functions in the deployment diff, verify anonymous rejection and
mocked role checks, then office/resident acceptance with owner-authorized use (no synthetic
resident accounts or real deletion submissions). Stop on failure. Recovery is a reviewed
request-only version with all processing held; never restore an automatic deletion endpoint,
public data access, or broad permissions. Do not roll these five functions back to a version
that queues approvals for processing. No live deployment or runtime verification was done
in this local preparation.

### Automatic-processing blockers and prepared resolution boundaries

- **Exact source scopes:** native targets `(default)`. Existing hosted web bridge identifies
  `ai-studio-cclivingv27-5fc1a0f6-cd75-4964-8c9e-e219a265f7bb` in
  `functions/storageWebAccessPolicy.cjs`. Current local web configuration defaults to
  `(default)` but supports a build-time database override; it is not evidence that the hosted
  site moved. Shared project/Auth/bucket does not prove duplicate profile/record ownership.
  The current engine touches default only; neither database may be declared fully erased
  until scope is proven. Do not switch the hosted database.
- **Minimum future read-only proof:** separately approve server-side projections of exact
  UID ownership fields, participant IDs/identity version and document identifiers across the
  two known databases. Compare in memory, emit aggregate coverage/unclassified counts only.
  Never fetch message/comment arrays, names, content, addresses, URLs or photos. Nested
  legacy identities that cannot be projected safely stay unclassified; require narrower
  separate authorization before examining them. No scan was executed here.
- **Legacy/media:** use only proven canonical UID/parent links. Unknown records stop completion
  with `needs_review`; no name-based inference. Keep the four proven links and six quarantined
  legacy files as previously approved. Six-file preservation is an explicit unresolved exception,
  not proof of private bearer URLs or permission to retain arbitrary files indefinitely.
  Removed-comment media, avatars and pre-cutover objects need verified scope/links before activation.
- **Local cleanup:** existing focused tests cover authoritative online deletion proof, cached
  flags/offline errors (preserve data), UID-specific clearing and account switching. After an
  offline period, an active client clears when it receives server deletion proof. A client whose
  Auth session is already revoked may never obtain that proof. This remains a blocker; neither
  a mocked test nor sign-out proves remote erasure. Hosted-web authoritative cleanup and legacy
  unassigned browser data remain unverified; do not erase another account's caches.
- **Backups:** existing approved period remains 60 days; no new duration decision is needed.
  Before activation verify/configure each scoped database's managed backup expiry and every
  restricted export bucket/copy: all object versions, soft-delete windows, retention locks,
  legal holds and replica/export copies must be inventoried. Ensure the effective expiry is
  documented, restrict restore access, and reapply deletion receipts after restore so backups
  cannot resurrect deleted accounts. These settings were not inspected or applied here.
  Any lock/provider retention exceeding the approved window requires an explicit exception,
  rationale and actual expiry; never claim the live policy is active from this document.
- **Alerts:** existing monitor now prepares a distinct three-business-day `review_due` receipt,
  seven-calendar-day escalation, delayed-review and processing/retention-overdue receipts.
  It remains default-off and is absent from the Stage 1 artifact. No external email/push
  delivery is configured. Owner must designate the staffed office reviewer/escalation contact
  and delivery route before separately approving alert activation. Monday–Friday/New York
  remains the current business-day definition; holidays are not modeled.

### Owner approvals still needed

1. Stage 1 five-callable deployment, approved-code GitHub push and compatible Preview OTA
   (no rules/Hosting/worker activation). No need to approve retention periods again.
2. Minimum metadata-only cross-database coverage verification as described above, or trusted
   existing receipts proving that scope; no migration/deletion approval is implied.
3. Staffed escalation owner/notification route; separately approve applying verified 60-day
   backup expiry configuration. Any real retention exception requires its own reason/expiry.
4. Destructive activation remains a later approval only after ownership, local-client proof,
   media coverage, backups and review/processing deadlines are demonstrably satisfied.
