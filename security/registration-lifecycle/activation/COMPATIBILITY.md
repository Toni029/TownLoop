# Focused compatibility decision — November 13, 2026

## GO: disabled infrastructure preparation. NO-GO: admission/rules/destructive activation.

Fresh READ-ONLY verification in ../activation-readonly.json confirms:
- default rules 4d1c449fc847c8273efdee3b813d16a1e996dd0fdfc766e3cfb09c4ace8eb6d0
- named rules 8493ef2624b905208328f9ac7116dfe59e8349b1d24a8c3aa0883ceabd0da02d
- Storage rules 9aac5f82b7e31fef034b92340714136ec943232de88b1a0076c001331958c3e9
- deployed Gen2 account worker ACTIVE, revision fulfillapprovedaccountdeletions-00005-kux;
  Gen1 lookup404 is expected, not a missing Gen2 worker.
- account receipt default hash matches current4d1c…; named receipt still224a…,
  differing from deployed8493…. The existing worker fails before job processing.
No receipt, flags, worker, schedule, IAM, secret, rule or resident data was changed.

The proposed coordinated default hash is8bc7d56c0c3929aa641d90711a972b908c3af4e228d6b20f86eaf787d47e0b9b.
Changing rules alone would also mismatch the existing worker's default pin. This is
safe failure, not compatibility readiness. Storage candidate is byte-identical to live;
never redeploy it unnecessarily because media provenance pins release time as well as hash.
Named database rules/data stay unchanged.

## Local controls now prepared

API flag TOWNLOOP_REGISTRATION_API_ENABLED and destructive flag
TOWNLOOP_REGISTRATION_WORKER_ENABLED are independent, both defaultfalse. The worker
requires both true and the exact project. The former shared LIFECYCLE flag is ignored.
Media uses TOWNLOOP_SOCIAL_MEDIA_QUEUE_ENABLED for queue/inventory (no deletion), and
TOWNLOOP_SOCIAL_MEDIA_WORKER_ENABLED only for destructive tick. Both defaultfalse.
No new flag mutates existing account-deletion flags or policy receipts.

The shared assertReferenceWritesAllowed transaction guard now also reads the social
fence on default only. This covers existing guard call sites: Inbox group/private
creation/send/leave/legacy upgrade, membership/role changes, directory projection,
safety reports/reviews, media upload admission and newsletter budget/start/claim/output
commits. The registration service now reads the same guard inside its transactions.
Absent fence preserves normal behavior. Named calls do not read/write a social fence.
Privileged writers can put Storage links into text, so guarding only URL fields is unsafe.

## Outstanding mandatory gates (not falsely certified)

1. No reviewed live writer manifest exists. Local helper changes are not deployed proof.
   Each v1/v2 function/revision, external/import/Admin SDK writer and privileged Storage
   writer needs source/revision/IAM proof or explicit disable/drain. Existing account
   deletion, generic reapers, unclassified direct writes and retained legacy backend
   writers remain unresolved until reviewed, not presumed guarded. No existing service
   was disabled to satisfy this gate. Media readiness fails closed.
2. Registration introduces new server collections. Current accountDeletionPreflight
   treats unfamiliar collections as holds. Before enrollment activation, separately
   prepare/review classification and retention/identity handling for registration
   applications, audits, email locks, fences, cleanup jobs, reminders and worker state;
   do not silently whitelist UID-bearing data or drop evidence. Existing worker/policy
   is left intact. This blocks full admission activation, not inert deployment.
3. A matching worker/rules compatibility package and policy-approval sequence are
   still required for the8bc7… default pin. No receipt is generated/acknowledged here.
   Existing receipt's named mismatch must remain until separately authorized.
4. IAM custom-role/conditional bindings are exact proposals, not live grants verified
   by emulator. After approved provisioning use impersonated positive/negative checks:
   API Auth delete denied; worker Auth delete allowed only in disposable test phase;
   registration named writes denied; media named writes/private-prefix deletion denied;
   secret access denied to media and ordinary users. Code must constrain UID/path because
   Auth IAM and Firestore database IAM cannot enforce application-level ownership.
5. Real-phone verification and live IAM/Storage-generation probes require later approval.
   Provider soft-delete/recovery semantics are adapter-tested, not physically purged.

## Old installed versions and rollout

Disabled backend deployment changes no current endpoints or rules. Existing APK/AAB
versions continue working exactly as before. New client changes add callables but no
native dependency: OTA compatibility still requires each channel's exact runtime check.
New API behavior must pass tests before any OTA is published. API-disabled OTA would
break new registration, so do not release it in the initial infrastructure-only stage.
Existing approved profile reads/sign-ins remain unchanged by proposed admission rules.

Old clients that directly create profiles cannot register after the final strict rules
cutover. An OTA coverage/minimum-supported-signup decision is required first; never
claim indefinite backward signup compatibility or leave direct-create rules permissive
while enforcing abuse restrictions. Keep new denial controls off until strict rules and
compatible clients are coordinated. No retroactive expiration of legacy pending users.

## Authorized deployment proposal for the next approval

Only new identities/custom roles/conditions, the HMAC secret with two secret-level
accessors, two composite indexes and the two isolated disabled codebases. Exact functions:
submitResidentRegistration, manageRegistrationLifecycle, processRegistrationLifecycle;
queueSocialMedia_marketplace_posts, queueSocialMedia_discussion_feed,
resumeSocialMediaCleanup, inventorySocialMediaOrphans.
Every flagfalse at first deployment. Functions provisioning may create enabled schedules;
false code gates make them inert immediately, then pause all three and verify. Do not
include default/Storage/named rules, existing writer functions, the account worker or
policy receipts in this initial deployment selection. firebase.PROPOSED.json includes
rules for later review: use explicit --only functions:<codebase>,firestore:indexes with
a separately validated indexes-only selection/config, never a bare firebase deploy.

Later, after the gates above and separate approval: backend-compatible writer packages,
matching rule/worker sequence, registration policy trustedAuthAfter/cutover (new identities
only), OTA with runtime compatibility, physical tests, then separately approved small
cohort activation. Current worker selection has no tester allowlist: prepare one before
claiming a production test is limited to disposable jobs, or keep destructive tests in
emulators until a specifically approved live rollout. Do not synthesize historical dates.

## Emergency stop

Set destructive flagsfalse and pause their schedules; leave API/queues available if safe.
Changing env requires scoped redeployment, so pause schedules as the immediate stop and
wait for in-flight invocations to settle. No flag retroactively cancels a running delete.
Inspect/reconcile uncertain generation-qualified Storage attempts before releasing any
social write fence. Never clear it blindly; it can temporarily block default writes.
Never restore permissive rules or change account policy to force progress. Keep a forward-
compatible client release available: rolling OTA back to direct-create-only signup can
break signup under hardened rules. Auth deletion is not reversible; Storage recovery is
subject to the existing7-day policy and requires separately approved restore action.
