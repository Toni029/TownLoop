# Final policy decisions and deployment gates — October 26, 2026

Local preparation only. No live data queries/writes, new backups, scheduler activation, token
revocation, rules, Hosting, native builds, push or OTA publication in this task.

## Approved decisions

Operator: **Seeds4Clix**. Supplied support email: **support@seeds4clic.com**. Owner must confirm
this exact spelling, ownership, monitoring and privacy/deletion handling before public publication.
No business address, legal entity form, jurisdiction or policy effective date is invented.

- Admin/VIP can review; neither can self-approve. Automatic alerts are **Admin only**, never VIP.
- Review: 3 business days, Monday–Friday America/New_York, no holiday calendar. Escalation:
  7 calendar days. Completion target after approval: 7 calendar days. Original deadlines persist.
- Ordinary retained/redacted records and application audit receipts: maximum 60 days from the
  request. This is not a reason to defer ordinary deletion. Processing remains inactive.
- Backup changes deferred. `backup-schedule.PROPOSED.json` is marked DO NOT APPLY.
- Six quarantined attachments remain preserved, excluded from all automatic cleanup. Other
  ambiguous identities/media stay `needs_review`; no ownership inferred from omissions.

## Admin-only automatic delivery — prepared, not activated

`accountDeletionMonitor.cjs` is isolated from the deletion engine. It records existing durable
request receipts and invokes `accountDeletionAdminAlerts.cjs` only with BOTH monitor and Admin
alert flags explicitly true. No website, rules or resident-facing UI change is required to prepare it.

Dispatcher queries canonical Admin profiles, requires approved true and no deletion flag,
rechecks role/device ownership transactionally and again before delivery, and confirms Auth is
not disabled. VIP/Crew/Resident are excluded. Existing Expo device registration is reused;
no new email destination or support-email subscription is assumed. Payload is a generic Admin
Reports prompt, with no request ID, resident name, content, photo, URL or token in logs.

Bounded pages: 50 Admin profiles, 20 registered devices per Admin per scan. A deterministic
per-device/local-day claim suppresses repeated scans. An ambiguous network outcome is not
blindly retried; later daily reminders are permitted. `accepted` means accepted by Expo, not
confirmed device delivery. Without registered devices there is NO successful notification.
Fresh canonical role checks reduce stale-role exposure; they cannot recall a notification
already delivered while the user was authorized.

The isolated entry/package/config contain ONLY this scheduled monitor and pure retention/alert
helpers, never review request endpoints, deletion/redaction engines or media cleanup. Deploy
ONLY `functions:escalateAccountDeletionRequests` with `firebase.deletion-monitor.json`, after
approval; never a broad functions deployment. Keep both flags false. Deployment creates scheduler
infrastructure, so it is not authorized by this local-preparation task.

**Activation gates:** approved Admin device registration/client support is not yet delivered or
phone-verified. Prepare/approve compatible registration and a synthetic Admin-only push test;
verify current role/device mappings without reading resident content. Delivery claim documents
have only state, creation and 60-day expiry (daily identifiers are hashes, no raw UID/token).
Before activation separately approve and verify expiry enforcement for collection group
`deletion_review_deliveries` on `expiresAt`; no TTL/cleanup configuration was activated. Firestore
TTL is asynchronous, so it alone cannot guarantee erasure at an exact instant: apply a bounded,
verified operational expiry process if a strict maximum is required. No 400-day receipt extension.
Existing Cloud Monitoring template remains disabled/no channels; do not attach a generic office
or VIP destination. Role changes are enforced by app delivery, not a static email list.

## Supported offline cleanup and limits

Stage 1 already published account-scoped cleanup retries/authenticated readers; publication
metadata is in `stage1-publication.json`. EAS was rechecked, not merely inferred from Git history.
Actual installation still needs owner confirmation. Source `bfb1a85`, Android Preview runtime
`d6f09b9023171c8bdabd4a8e1da0b41223dff3b9`.

A further local correction completes each successfully cleared account independently: one older
locked account cannot prevent sign-out of a different, confirmed deleted current account. Completion
failure keeps durable proof for retry. Exact UID checks prevent signing out a switched account.
Only authoritative server deletion/disable proof permits clearing. Offline, cached flags and expired
tokens do not. No removal of active residents' medication records merely because they are offline.

Remaining: if Auth loses the user before authoritative deletion proof arrives, a reviewed finite
cleanup-only proof/receipt protocol is still needed. Historical unowned device/browser caches
remain excluded. Existing UID-scoped storage isolates account switching, but there is no claim of
remote erasure on an offline phone or that unknown legacy data has a verified owner. Do not mark
this gap complete or enable destructive processing because retry tests pass.

## 400-day retention — NOT approved; specific legal basis not established

Official provider documentation confirms Google's `_Required` bucket keeps selected system
Admin Activity/System Event audit logs for a fixed 400 days. This is a technical provider default,
NOT evidence that a particular law requires Seeds4Clix to retain a particular resident record.
No jurisdiction-specific obligation or applicable statute was supplied/established. No generic
HIPAA, tax or financial-record rule is assumed to apply to TownLoop. The exception remains
**owner/legal review**, not a configuration change or application policy extension.

- Candidate provider records: control-plane administrative/system events, not resident chat/photo
  bodies. Actual log payloads and principals/IAM were NOT inspected; minimal-field/access
  compliance therefore is not claimed verified.
- Application receipts: retain only required decision/status/deadline fields and minimal audit
  evidence until ordinary expiry; never copy message bodies, photos or unrelated personal data.
- Proposed controls: project log-viewer access limited to designated operators, not resident app
  roles; no additional log exports or duplicate 400-day copies. IAM is unchanged and unverified
  here. Legal review must specify exact covered records, legal citation/jurisdiction, purpose,
  required fields, authorized viewers, retention anchor and mandatory expiry before any exception.
- Existing provider bucket remains unchanged; disclose its fixed retention honestly. If no legal
  basis is established, do not implement application 400-day retention. Escalate the provider
  constraint/contract and minimize app logging rather than promise it has been removed.

Sources checked October 26, 2026:
[Google log buckets](https://docs.cloud.google.com/logging/docs/store-log-entries),
[audit types and IAM](https://docs.cloud.google.com/logging/docs/audit).

Verified existing backup facts remain those in `verification.aggregate.json`: no managed Firestore
backups/schedules/PITR, one-hour version retention; restricted release-backup age-60-day lifecycle
(asynchronous, soft delete off); app Storage seven-day soft delete. No new scan or settings changes.
General provider logging 30 days is distinct from the fixed system-required bucket. No promise
that all historical copies or soft-deleted bytes are already purged.

## Minimum remaining sequence — separate approvals, no automatic execution

1. **Next safe Preview:** isolate just this account-cleanup completion correction onto published
   `bfb1a85`, push approved source, verify exact installed runtime, publish ONE Android Preview OTA.
   Do not publish full local HEAD: native expo-video source-build changes require a new binary.
   Test account switching/interrupted cleanup with fixtures, not real deletion requests. No backend
   dependency or scheduler activation for that JS correction.
2. **Admin escalation:** separately approve isolated monitor deployment with flags OFF; establish
   approved Admin device registration/delivery and 60-day receipt-expiry enforcement. Verify
   synthetic recipient exclusion/delivery. Then request separate scheduler/delivery activation.
   VIP review permissions remain. No generic office email or VIP notification channel.
3. **Deletion activation remains blocked:** per-account named/default database scope (shared Auth),
   unresolved embedded media/legacy identities, finite offline proof and verified media cleanup
   and receipt expiry. Keep all proof/processing authorization gates false. Reuse prior aggregate
   metadata; no further live identity scan was needed for these local changes. Approve a scoped
   processing release only once safeguards and staffed fulfillment are verified; approvals remain
   held and cannot trigger deletion now. Backups unchanged, not an added configuration gate.
4. **Legacy tokens:** finish separately approved native/web video/thumbnail/PDF reader coverage,
   hosted-client source/CORS compatibility and new-write cutover before an exact-object token
   retirement approval. Original website unchanged. Existing bearer URLs, including quarantine,
   are not private merely because SDK reads are restricted. No revocation authorized.
5. **Final binary/Play:** separate approval for ONE Preview APK with compiled startup audio opt-out
   verification and any approved manifest changes; original MP4/signing maintained. Then actual
   phone checks. Confirm support spelling/legal/policy/provider disclosures, operational deletion,
   signing, testing and Console declarations before separate Production AAB/Play approval.

Remote Git has curated Stage 1 `bfb1a85`; local branch also preserves unreleased native/backend
checkpoints. Reconcile via reviewed merge/cherry-pick without force-pushing or dropping either
history. Unrelated pending Marketplace styling and untracked docs are not included in this commit.

## Verification for this checkpoint

23 focused assertions passed: 4 Admin recipient/delivery checks, 4 monitor/deadline/held-approval
checks, 2 isolated deployment-artifact checks, 10 account cleanup/isolation checks, and 3
review-authorization/delivery-flag checks. Native TypeScript passed. Policy/contact and inactive
configuration assertions passed. All tests used synthetic in-memory data/local artifacts; no
notification was sent and no resident account/request/file was queried or modified. No new
phone/emulator test, native build or publication occurred. EAS and GitHub were read-only rechecked.
