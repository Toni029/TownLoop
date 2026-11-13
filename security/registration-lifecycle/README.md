# Registration and social lifecycle — local preparation only

November 13, 2026. Branch native/expo-migration. Nothing in this implementation was
pushed, deployed, published or activated. No production profiles, identities, media,
policy receipts, rules, schedules, IAM, auth providers or named databases were changed.
The global Database Cleanup implementation remains read-only/disabled for destruction.

## Registration protocol

`submitResidentRegistration` uses verified non-revoked Firebase Auth and the actual
Auth user record. It never trusts a requested role, email, approval or timestamp.
Server timestamps establish a 14 × 24-hour pending duration. A transaction creates
`registration_applications/{uid}`, a pending `users/{uid}` projection, and a keyed
email enrollment lock. Concurrent/repeated submissions reuse this application.
A separately approved server policy's Auth-creation cutover prevents enrollment of
older bare Auth identities as if they were new applications. Missing policy/HMAC or
unset enablement fails closed. New Google intake retains its existing blank-address
behavior; existing Google profiles are not overwritten or resubmitted.

Admin/VIP `manageRegistrationLifecycle` validates canonical approved roles inside
the decision transaction. Approval requires pending state and a deadline still in
the future on every transaction attempt. Ordinary/abuse denials require an enumerated
reason and explicit confirmation. They atomically make approval/access ineligible,
set the pending profile's approved=false terminal state, and queue scoped cleanup.
Only confirmed abuse denial writes a seven-day email restriction. It starts at the
server's committed decision time, not the eventual Auth deletion time. Duplicate
calls do not restart the deadline. Restriction comparisons use strict expiresAt>now,
so expired records cannot extend enforcement while physical cleanup awaits a run.

Email normalization is trim/NFC/lowercase, without guessing Gmail alias ownership.
Keys are HMAC-SHA256 using TOWNLOOP_REGISTRATION_EMAIL_HMAC in Secret Manager; records
contain no raw email/full registration. Do not rotate the key without a coordinated
restriction migration. The public API is authenticated and only enrolls the caller;
there is no public arbitrary-email availability/restriction lookup. An expectedUid
session guard also prevents accidental submission under a switched app account.

Admin-only restriction review returns opaque references/reason/times. Early override
requires confirmation and a documented reason, which is audited. VIP cannot review/
override restrictions or promote a surrogate Admin through the prepared direct-write
rules/UI. Existing approved profile edits and other legitimate permissions remain.

## Expiration, reminders and cleanup

`processRegistrationLifecycle` is an opt-in hourly schedule with bounded pages,
three scheduler retries, transaction-backed decisions and six-minute cleanup leases.
Due day-7/day-12 reminders are durable/deduplicated manager-only records, displayed
as **in-app Admin/VIP registration-panel reminders**, not email or new background
push. No new delivery category/provider was added. Expiration is enforced by the
approval API exactly at day14 even if the hourly worker is delayed. Pending accounts
never have protected community access in either case.

Only protocol1 pending applications can expire. Approved accounts and undecided
legacy profiles are never automatic targets. The cleanup worker verifies terminal
application/fence state, current Auth creation time and keyed email before touching
Auth, disables/revokes/deletes that exact identity, then transactionally removes only
its pending profile/directory projection/application/reminders/email lock/fence.
Auth failures keep access ineligible and queue retry; an unknown partial result is
reconciled on retry. Identity replacement/email mismatch, approval, account-deletion
fences, legal/evidence/retention flags or related reports hold cleanup for review.
No conversations, work orders, newsletters, media or other users' records are erased
by this worker. Admin sees bounded queued/retrying and needs-review cleanup counts (up to 100 jobs per summary).
Pending applications and active restriction lists have explicit Load more pagination,
including restrictions sharing the same expiry time.

Minimal decision/override audit records have a **proposed 30-day** expiry, completed
cleanup receipts seven days; explicit evidence/legal holds are preserved. These are
new proposed operational retention settings for rollout approval, not existing legal
requirements. Expired restriction records are swept without extending enforcement.
Physical deletion/reminder processing is eventual/hourly and capacity-bounded; the
access/approval/restriction deadlines are not extended by that timing.

## Existing pending accounts / migration

No retroactive expiry, timestamp substitution or mass purge is prepared/enabled.
The staff list labels old profiles legacy with unknown submission time and no automatic
expiry. A canonical legacy resident can still be approved through the new guarded API
if Auth/profile identities match and no restriction/deletion fence applies. Legacy
staff-role ambiguities require individual review. Legacy denial cleanup is deliberately
blocked until a separately approved migration review establishes provenance/holds.

Recommended separate migration: a read-only aggregate inventory, identity and hold
verification, then manual decisions or a prospectively approved fresh review period
with notice. Do not use client createdAt or a guessed Auth creation date as a historical
application submission timestamp. Do not remove a previous approved identity merely
because its profile is missing. No migration has run and no live applicants were read.

## Rules and cost safeguards

Candidates derive from exact live default rules (not the weaker abandoned root rules),
preserving account-deletion protections. Profiles and registration control records
become server-owned for creation/review; direct role/approval bypasses are rejected.
Approved-user role changes require Admin. Registered users cannot alter lifecycle
fields or approve themselves. Pending/denied profiles are approved=false atomically,
so protected Firestore/Storage access is denied without adding extra lookups on every
Inbox request. Storage candidate is byte-identical to live9aac…: adding new fence
lookups to profile+parent checks would exceed Storage's two-document access budget.
Explicit social legal/evidence/retention holds block direct deletion/editing of the
two canonical collections. Moderation removal also respects explicit holds locally.

Email/Google Firebase Auth identity creation still happens before admission. A direct
Auth API caller may create an unused identity; it cannot create a profile, obtain
approval or access protected community data. Truly blocking before Auth creation
requires a separately approved Identity Platform blocking-function rollout. Google
currently lists the first 50,000 monthly active email/social users at $0, then tiered
MAU charges; blocking-function compute and other services can still incur charges.
No upgrade/provider/billing change was made. Existing Firebase Functions, Firestore,
Storage, Scheduler and a new HMAC secret have ordinary usage costs; no paid messaging
provider was introduced. A cost/service approval is needed before provisioning.

Known inherited limitation: old Firebase bearer download URLs already possessed by
someone may bypass authenticated Storage rules. These changes prevent fresh authorized
access and preserve cleanup provenance, but do not rotate old download tokens, erase
previous downloads or falsely solve that separate private-media transition.

## Exact deployment preparation — approval and coordination required

1. Review `production-preflight.json`: legacy client deny-all unchanged; default and
   Storage hashes captured. Existing media cleanup triggers/schedules and registration
   lifecycle exports were not found in the inspected Gen1/Gen2 inventory. Media policy
   already has an approved trusted-upload cutover, but that is not activation proof.
   The registration HMAC secret metadata returned404; do not assume it exists.
2. Provision a fresh high-entropy HMAC key only after approval; grant secret access
   to the dedicated `townloop-registration-api` and `townloop-registration-cleanup`
   identities. API requires Auth user reads and default Firestore operations; cleanup
   additionally needs Auth update/revoke/delete. Use least-privilege reviewed roles,
   not the existing broad default Editor identity. No identity/IAM was created here.
3. `node security/registration-lifecycle/prepare.cjs` produces an isolated disabled
   artifact exporting only submitResidentRegistration, manageRegistrationLifecycle,
   processRegistrationLifecycle. `firebase.PROPOSED.json` is not an instruction to
   deploy yet. Provision/review the two composite indexes, worker schedule, policy
   Auth cutover and rollout flags. Functions default disabled and verify project.
4. Coordinate reviewed default rules with the separate social write fence and every
   relevant privileged writer. The social scoped package is prepared separately;
   exact exports: queueSocialMedia_marketplace_posts, queueSocialMedia_discussion_feed,
   resumeSocialMediaCleanup, inventorySocialMediaOrphans. See its readiness/IAM/hold
   prerequisites. No new Storage rules are technically needed because its candidate
   equals live; still verify exact hash/provenance before activation.
5. **Do not deploy the new default rules in isolation:** account-deletion workers pin
   security rule hashes. A separately reviewed compatibility sequence is required to
   preserve those safeguards without acknowledging/resuming their policy receipt.
   Neither worker nor receipt was modified under this task. Named rules must not change.
6. Plan a short registration cutover/upgrade window. Deploy compatible endpoints first,
   then the coordinated server-only admission rules, approved policy/secret/flags and
   compatible Production/Preview client releases. Old approved sign-ins remain valid;
   old binaries lacking callable enrollment cannot register through a direct-write
   fallback after hardening. Never weaken rules to preserve that old signup path.

No new native dependency/configuration was added: changes are JS/TS and backend/rules.
A compatible Production/Preview OTA can carry native UI/client changes; confirm each
installed channel/runtime at release. No new AAB is inherently required by this work.
No device testing, real reminder sending, production Auth deletion or media deletion
is claimed. Physical Android/iPhone signup/Google, staff confirmation/keyboard,
restricted/expired handling and refreshed list tests remain before release.

Sources (checked November 13, 2026):
- https://firebase.google.com/docs/auth/extend-with-blocking-functions
- https://cloud.google.com/identity-platform/pricing
- https://firebase.google.com/docs/rules/rules-behavior
