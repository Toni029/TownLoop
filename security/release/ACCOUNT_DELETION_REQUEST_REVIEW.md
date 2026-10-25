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
