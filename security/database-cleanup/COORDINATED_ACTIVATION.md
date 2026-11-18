# Coordinated cleanup activation

The bulk engine remains request-driven: only a verified approved Admin can
preview, confirm the exact plan with `DELETE SELECTED DATA`, advance, resume or
cancel that job. No cleanup scheduler or automatic purge is introduced.

## Coordination and recovery

`database_cleanup_control/active` is the shared transactional admission record.
The account runner acquires an opaque `accountDeletionOwner` before any job work;
cleanup confirmation checks that same record before setting
`referenceWritesBlocked`. Preview/cancellation updates merge rather than erase
the other engine's owner. Account acquisition rejects an active cleanup barrier.
These transactions serialize both race directions. The account runner's owner
has no timeout: a crash, hard function timeout or uncertain provider failure
cannot expire into a simultaneous purge. Successful, fully awaited invocations
release only their own owner. Failures retain the owner and require privileged
reconciliation; do not manually clear it until the invocation has stopped and
any uncertain Storage operation has been reconciled. Existing cleanup deletion
intents/barriers similarly remain fenced until resolved or safely cancelled.

The account function must advertise coordination version 1 AND its reviewed
revision must be pinned in the complete cleanup inventory receipt. Setting the
environment marker alone cannot satisfy the receipt. Unknown worker versions,
unreachable inventories, drifted revisions and active account processing remain
fail-closed. Generic/narrow automatic media reapers remain disabled.

## Historical ownership and account approval

Receipt version 3 pins both the live restrictive rule hashes and the ORIGINAL
approved Storage provenance hash/date. The media policy and historical upload
metadata are never rewritten. A guard-only rules release does not reset the
ownership cutover. Account-rule compatibility still requires the independently
approved account policy to match every live Firestore hash; a cleanup receipt
cannot acknowledge or override that policy, approvals, holds or 60-day deadlines.
The existing account receipt remains unacknowledged during this rollout, so no
resident deletion requests resume. Account execution flags remain as before and
the original five-minute schedule is restored after deployment. A later,
separately authorized account-policy acknowledgment can use the new coordination
without disabling the bulk manager.

## Scoped deployment and rollback

Use the existing reader endpoint's codebase `database-cleanup-preview`, replacing
its handler with the real engine and dedicated `townloop-database-cleanup`
identity. It has Firestore entity mutation/list/read, Auth READ, rules/function
metadata READ and bucket/object read/list/delete permissions; no Auth deletion,
secret access or IAM administration. Retain the reader identity separately.

Prepare guarded writers from exact deployed source archives with
`prepare-guarded-writers.cjs`. Only transaction-entry guards are added to directory,
moderation, membership and compiled newsletter transactions. Extraction prompts,
models, payloads, secret version and existing workflow code remain unchanged.
The already-guarded current Inbox compose function is not redeployed. Deploy only
the exact exported functions, never the old package's whole function inventory.

Deploy coordinated account worker and guarded writers first, cleanup disabled,
then reviewed default Firestore/Storage rules. Never alter named deny-all rules.
Only after exact deployed revision/hash/IAM checks may the narrow feature flag
and matching owner-approved v3 receipt be applied. No job is submitted for
verification. Role/confirmation/destructive tests use disposable emulators.

To disable new cleanup admissions, set its feature flag false. Do not remove
barriers, roll back guarded writers/rules or restore a non-coordinated account
worker while any confirmed job, owner or unresolved Storage intent exists.
Restore only a verified safe configuration after draining/cancelling work. Never
restore vulnerable named-database rules. The original deployment configurations,
rule sources and redacted verification records are retained locally in ignored
`.release/cleanup-full-activation/`; private configuration snapshots are not
committed. No production data is restored or deleted as part of rollout.

## Production release record

Verified 2026-11-18T02:09:52.143Z in `cc-livingcommunity-app`. Permanent Admin-only
cleanup is enabled for all four category keys: `workOrders`, `discussion`,
`marketplace`, `newsletters`. Feature flag true; owner-approved safety receipt v3
matches the complete deployed function inventory and writer revisions.

| Component | Active revision |
| --- | --- |
| Cleanup callable | `managedatabasecleanup-00005-moc` |
| manageInboxConversation (unchanged) | `manageinboxconversation-00006-cag` |
| syncResidentDirectory | `syncresidentdirectory-00002-wam` |
| fulfillApprovedAccountDeletions | `fulfillapprovedaccountdeletions-00006-juf` |
| newsletterApi | `newsletterapi-00007-pib` |
| reviewSafetyReport | `reviewsafetyreport-00002-pen` |
| revokeInboxGroupMemberships | `revokeinboxgroupmemberships-00002-nox` |
| runNewsletterAnalysis | `runnewsletteranalysis-00004-yeq` |
| submitSafetyReport | `submitsafetyreport-00002-how` |

Default rules: `ee68e66da3e7e4e55546e77790ca674ca4c550e1ea816aa54b5902dfaded3c42`.
Storage rules: `06d24519f84deb79f2cd6d24248f1ac45242e841cdd69d2ac56a5b3ee4fcbdae`.
Named deny-all rules unchanged: `8493ef2624b905208328f9ac7116dfe59e8349b1d24a8c3aa0883ceabd0da02d`.

Original Storage cutover remains `2026-10-23T12:57:03.246Z`. Both account and
media policy documents are semantically unchanged. The account schedule is
restored to ENABLED, every five minutes; its pre-existing unacknowledged account
receipt continues to hold processing. No account requests were resumed or
accelerated. The two retained requests and their 60-day deadlines are unchanged.

Verification: 17 focused unit checks and one selected-category synthetic
Auth/Firestore/Storage emulator scenario, including a real acquisition race,
protected/shared media, role rejection, exact confirmation, retry and category
isolation. Production read-only configuration checks pass the same receipt/rules/
revision gates, and the actual callable rejects unsigned requests with 401.
Cleanup job inventory remains empty. ZERO production cleanup jobs submitted or
executed; ZERO resident documents or Storage files deleted by this rollout.
No Firebase Auth users were modified. No new cleanup schedule, secrets, native
dependency, OTA, APK/AAB or GitHub push was created. Existing Google Play request/
response contract is unchanged; physical-phone testing was not performed.

Protected, retained, shared or unverifiable historical files/records remain held
and explicitly reported. Recovery generations/backups and external-provider
copies are not claimed erased. The real deletion path was tested only with
synthetic emulator data, as authorized.
