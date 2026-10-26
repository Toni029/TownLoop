# Completed local processing protocol 3 — October 26, 2026

Not deployed or activated. No resident records/files were read, changed or deleted during tests.
One read-only Firebase Rules configuration check was performed; no message/photo/profile data.
Existing backups, bearer tokens, six quarantined files, Hosting and database selections unchanged.

## Implemented

- `accountDeletionScoped.cjs`: separate durable scope jobs in default/named databases, bounded
  inventory/redaction/private-data phases, exact Auth UID checks, scope-local media outboxes,
  independent completion receipts, post-private-data reconciliation and crash-safe receipt replay. Auth deletion waits for BOTH.
  Existing V2 retention planner is reused, not replaced. Missing or conflicting identity stops.
- Explicit second Admin processing authorization is separate from Admin/VIP request approval.
  Request approval remains held. New operational callables are independently packaged without
  deletion engines or schedulers. Self-authorization and VIP processing authorization are denied;
  VIP's existing request-review permissions are unchanged.
- Disable/revoke only AFTER explicit processing authorization, verified scope write controls and
  policy approval. Wait at least 65 minutes after successful revocation (one-hour ID-token
  lifetime plus margin) before scoped mutations. The current named rules FAIL this prerequisite.
  [Firebase session lifetime](https://firebase.google.com/docs/auth/admin/manage-sessions).
- Human exceptions pause the root; `needs_review` is excluded from automatic processing queries.
  Admin panel shows metadata-only exceptions and scope errors, with server rechecks. No UI can
  assign ownership, waive an exception, or mark unresolved data complete. Verified external
  corrections can resume safely; content is never returned to the exception UI.
- Shared content retains others' records/messages, removes only verified authored data and
  anonymizes supported maintenance fields. Scoped pseudonyms use per-record keyed hashes; the
  request/scope keys and minimal receipts expire in the ordinary 60-day phase. Permanent Work
  Order number reservations remain. Incoming/outgoing block references, device tokens, profiles,
  matching completed media receipts and stale authorization projections are handled explicitly.
- Media hashes are extracted without storing URLs/tokens/bodies. Reviewed C2 rules prove new
  securityVersion=1 native links belong to default-database parents; activation must verify their
  exact rules hash/cutover. Named/historical objects need exact server-approved scope, owner,
  request, generation/metageneration and finite-expiry proofs. Unknown files remain human-review
  exceptions. All six approved quarantine hashes are hard exclusions, even if a policy omits them.
  File deletion preconditions check generation AND metageneration. No files/tokens changed now.
- Cleanup-only device credentials: registered with verified Firebase Auth, secret held in existing
  protected native storage, only its hash on the server. Registration closes transactionally once
  processing is authorized. Signed-out/revoked clients can check their credential without relying
  on an expired Auth session; it grants no private-data read or deletion authority. Confirmed
  deletion/disable/revocation clears only that UID. Offline failures, expiry and unknown responses
  never erase records; durable cleanup retries and coalesced foreground checks prevent lockups.
  Capability expiry is finite (up to 60 days, capped at the original request deadline on processing).
  Supported after enrollment; unenrolled or very long-offline devices cannot be remotely erased.
- Admin-only notification payload/HTTP dispatch and bounded claim expiry verified with fixtures.
  VIP excluded, role/Auth/device rechecked, daily claims suppress repeats. No real push was sent.
  Actual push delivery still requires Admin device enrollment and Firebase/Expo credentials;
  the installed APK does not yet include a notifications registration library. Do not enable the
  scheduler and mistake accepted fixture sends for real-phone delivery.

## Concrete live activation failure — newly verified, not a repeated audit

Named website database rules hash:
`29ea681048a0218295555da03caf21c0d8e625a722347e808feeb92cc101fdc0`.
It still publishes unconditional read/write for maintenance/office/resident/Marketplace chats;
its Social modification clauses also lack a universal authentication guard. Disabling/revoking a
resident cannot freeze anonymous writes. Protocol 3 hard-rejects that known hash even when a
policy checkbox says verified. No rules or website changes were made.

`tools/verify-deletion-write-freeze.cjs` is a read-only release gate comparing BOTH live Firestore
rules and Storage rules to explicit reviewed candidates. No policy writes, deployments or migrations.
A future compatible named-database security/client rollout requires separate owner approval.
Do not swap databases, replace the site with an unverified build, skip a scope, or flip proof flags.

## Deployment dependencies — NOT execution approval

1. Resolve named-site anonymous writes with reviewed client/rules compatibility and an approved
   publication scope. This is required before any deletion activation, not a checkbox decision.
2. Non-worker backend package: `firebase.deletion-operations.json`, exactly
   registerAccountCleanupDevice/checkAccountCleanupProof/listAccountDeletionExceptions/
   recheckAccountDeletionException/recheckAccountDeletionScope/authorizeAccountDeletionProcessing.
   Keep all processing flags false. Existing five review callables need only matching status/
   capability responses; review-only packaging still imports no deletion engine.
3. After backend verification, separately approve the JS client protocol opt-in
   `extra.accountCleanupProofProtocol=1`; it is ABSENT/disabled now. Admin exception/processing
   buttons also remain hidden until the backend explicitly advertises availability. These core
   changes use existing SecureStore/JS dependencies, not a new native dependency.
4. Separately approve scoped worker/media and membership-bridge deployments, still disabled;
   verify read-only rules hashes, exact trusted cutover/proofs and existing indexes. Per policy,
   `scopeWriteFreezeVerified` and `scopeRuleHashes` must cover both reviewed databases and
   `tokenDrainMs >= 3900000`. Historical proofs bind exact request/object generation and expire
   by the original deadline. No broad file migration or bearer-token revocation.
5. Only then explicitly approve processing/expiry flags and a bounded, independently reviewed
   request. Env gates: TOWNLOOP_ACCOUNT_DELETION_ENABLED, TOWNLOOP_SCOPED_DELETION_ENABLED,
   TOWNLOOP_MEDIA_CLEANUP_ENABLED, TOWNLOOP_SCOPED_MEDIA_CLEANUP_ENABLED. All remain off.
   Device proof/expiry and optional Admin monitor have separate gates; do not activate a scheduler
   implicitly. Monitoring delivery needs the actual enrolled Admin devices/new native support.

Exceptions retain original deadlines and escalate; no arbitrary denial or indefinite automatic
retry. Unknown ownership is preserved, never silently called complete. The 60-day limit and
existing provider-log legal-review issue remain unchanged; no 400-day application retention.

## Verification for this checkpoint

41 focused backend tests, 10 native cleanup/session tests and 8 selected existing engine tests
passed; native TypeScript passed. Fixtures cover two independent databases, interrupted second-
scope progress, held processing, exception pause/recheck, proof expiry/revocation/account isolation,
exact media generations, quarantine exclusion, Admin-only HTTP payload and receipt expiry.
The Storage-empty completion in cross-database tests is a fixture, not a live file inspection.
No Android/phone launch or real push delivery is claimed. Existing broad audits/51 rule tests
were not repeated. Unrelated Marketplace styling and untracked docs remain outside this commit.

Operational activation also requires verifying the existing service account can access both scoped
databases and the necessary Auth methods. No IAM roles were granted or broadened here. Permission
or schema failures pause for explicit human repair/recheck; transient failures remain retryable.
