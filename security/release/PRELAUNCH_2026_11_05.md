# TownLoop prelaunch stabilization — 2026-11-05

**NOT READY for public launch.** Baseline `7709e00`, native branch
`native/expo-migration`. One coordinated source, dependency and regression pass;
current cloud rules/recovery metadata checked read-only. No live resident records
were read or changed. No deployment, push, OTA, binary build, migration, new
telemetry or cleanup activation occurred. The working startup video, uploader,
Gemini prompts, roles, notification delivery and published newsletter are untouched.

## Confirmed findings and disposition

| Priority | Finding | Disposition |
| --- | --- | --- |
| **P0** | **LIVE legacy named Firestore privacy/destruction exposure.** Any approved resident may read, replace or delete other residents' four chat types. Pending signups may list full profiles; other residents' Work Orders are readable. | Launch blocker. Requires separately approved, coordinated named-website client/rules remediation. No rules were edited or deployed. |
| **P1, fixed locally** | Discussion Feed inline comments use a native FlatList without the existing focus-aware scroll context, leaving focused inputs covered by the keyboard. | Reuse the existing scroll component within FlatList, preserve virtualization/ref/callbacks, reserve measured Send-button space and actual Android keyboard obstruction, bound multiline input height. The same Comments component covers post details and listing comments; Send reservation uses its measured height, including accessibility scaling. Other existing focus-aware forms benefit from the shared obstruction calculation. |
| **P1 safety check, fixed locally** | Three primitive-valued JSX guards failed the existing native-text regression check, including legacy comment reply controls. No device crash was reproduced. | Boolean guards in comment reply controls and the optional dialog-header leading node. Existing native-text regression check now passes. No visual redesign. |
| **P1, patched lock only** | Functions resolves body-parser 2.3.0; GHSA-27r3-jxmh-p828 describes compressed-body decoding crashes before app authorization. | Pin compatible 2.4.0 in Functions npm override/lock; one package entry changes. No install or backend deployment. Installed/deployed parser is not claimed updated. |
| **P1, unresolved dependency gate** | Expo Router reaches query-string 7.1.3 and decode-uri-component 0.2.2, affected by malformed-input quadratic decoding advisory GHSA-qr28-fpjm-wq7f. Device impact not reproduced. | Do not force 0.5.1: its ESM default export breaks the existing CommonJS caller even on an ordinary URL. Requires a supported compatible router/query-string repair or reviewed adapter plus deep-link testing. Native dependencies remain unchanged. |
| **P1, recovery/operations** | Both Firestore databases have PITR disabled, one-hour version retention, no scheduled backups and database deletion protection disabled. Remote mobile crash reporting is not configured. | Explicit operator recovery/isolated-restore plan, deletion reconciliation, monitoring and alert response required. No backup/telemetry settings changed; manual exports were not inventoried. |
| **P1, release gates** | Public policy source remains unapproved/obsolete; iPhone signing/APNs/device proof is absent. | Resolve owner/store gates below before launch. Android success does not establish iOS readiness. |

### Exact deployed rules evidence

Named database:
`ai-studio-cclivingv27-5fc1a0f6-cd75-4964-8c9e-e219a265f7bb`, rule SHA-256
`224a64b96335d0b4b4e3d6ab72e12d8d640ae46d2b0aca0654741d7dc156e7e2`,
byte-identical to `security/account-deletion/firestore.website.candidate.rules`.
Chat exposure is at lines 110–123, profiles 34–35, Work Orders 81–84.
Default SHA-256:
`4d1c449fc847c8273efdee3b813d16a1e996dd0fdfc766e3cfb09c4ace8eb6d0`.
Storage SHA-256:
`9aac5f82b7e31fef034b92340714136ec943232de88b1a0076c001331958c3e9`.

Only the Rules API and database/backup metadata were read. Synthetic emulator
requests using these exact snapshots prove named allows versus default denials;
no real chat/profile reads or destructive live probes occurred. The default
snapshot separately passes membership-epoch, prejoin-history and leave-revocation
checks. Source canonical role/approval checks are preserved across sensitive
Inbox, notification, newsletter and account-deletion handlers.

Do not deploy root `firebase.json` casually: its rules target differs from the
currently deployed consolidated default candidate. Do not copy native rules over
the named website wholesale. First establish its actual supported client contract,
exact participant identities and private-profile projection, prepare focused
rules/client changes, emulator-test all four roles and historical conversations,
then request a separately reviewed rollout. Ambiguous legacy membership must fail
closed or await review, never infer access from names/email aliases.

## Verification and coverage

| Area | Evidence and limits |
| --- | --- |
| Home | Existing weather/date, medications, checklist, recurrence, local storage and account-isolation tests included in the native pass. No live weather request or device persistence claim. |
| News | 35 focused server checks pass across retained-PDF integrity, analysis errors/checkpoint processing, authorization and Work Order API authorization. Native PDF transfer/recovery/reader/zoom/RSVP/highlights checks included. Existing real November analysis evidence is retained; no new Gemini inference or PDF upload performed. |
| Social / Marketplace / Work Orders | Existing photo-first, upload/recovery, permissions, completion, queue, comments, gallery and list tests included. Keyboard measurement tests simulate both OS boundaries; not physical device tests. |
| Inbox / notifications / deletion | One emulator pass: 59/60 checks passed; the failure was a stale positive signup fixture missing current consent. That fixture now sends the existing terms version and REQUEST_TIME receipt; the targeted batch-only rerun passes 11/11. Exact-live-rule probes independently exercised 30 cross-database attack outcomes and 10 Inbox visibility/leave outcomes. No push sent or deletion worker invoked. |
| Broad native regression | One run: **386/396 passed**, zero skips. Follow-up only on changed/failing areas: keyboard, native text guards and current inline deletion contract pass (11/11); explicit Babel plugin resolution passes; approved-Crew fixture corrected. The remaining historical profile-actions and Social gallery fixtures were aligned with current server-confirmed leave, UID read-cursor, profile-proposal and inactive notification-hook contracts: targeted reruns pass 9/9 and 2/2. The approved-Crew fixture passes 2/2. Every originally failing native test was verified in a focused follow-up; the entire 396-case suite was deliberately not rerun. This is not a device/end-to-end claim. |
| Types / lint | Native TypeScript passes on the final source. Whole native lint reported **49 errors / 31 warnings**, predominantly existing React compiler/ref/effect rules. No broad suppression, startup rewrite or speculative cleanup performed. This pass does not claim clean lint. |

Existing tests were reused; only confirmed defects and stale fixtures at the
reviewed seams were changed. The initial mock failures did not establish runtime regressions; the fixture
repairs preserve authorization and lifecycle assertions rather than weakening production behavior. Do not weaken app security or
restore superseded messaging protocols merely to satisfy old mocks.

### Dependency scope

Collectors ran once for native, Functions and isolated newsletter locks, without
installing packages or executing package lifecycle scripts. Direct versions checked:
50 / 3 / 5; none had a reported direct advisory. Baseline flagged exact transitive
entries: 15 / 3 / 1 among 1159 / 276 / 269 registry-verified transitive packages.
These are bounded advisory results, not proof all dependencies are safe or all
transitives execute in Metro. GitHub lookup/rate limits reduce maintenance coverage.
RE2JS/UUID findings require usage prerequisites not demonstrated in TownLoop;
compiler/signing-tool advisories are grouped review backlog, not asserted app exploits.
The alternate Functions pnpm lock still has the old parser; release with the
reviewed npm lock via a configuration that excludes pnpm, or reconcile it separately.

Primary advisories:
[parser](https://github.com/advisories/GHSA-27r3-jxmh-p828),
[decoder](https://github.com/advisories/GHSA-qr28-fpjm-wq7f).

## Owner, release and physical-device gates

1. Resolve the P0 named-database exposure with a coordinated, separately approved
   rollout; preserve messages, evidence and native default protections. An OTA
   cannot repair server rules. Existing bearer Storage URLs remain capabilities
   until a separately approved retirement; rules cannot revoke previously shared
   URLs. Six quarantined attachments remain untouched. Stage B permanent Inbox
   cleanup must remain gated until its separate rules/worker review.
2. Approve accurate Privacy/Terms/deletion pages, operator contact/effective date,
   Gemini/translation disclosures, moderation process, Play Data Safety and health
   declarations. Source pages still contain draft text and obsolete processing
   statements. Deletion processing has a later activation receipt; do not repeat
   historical claims that all workers are disabled. No processing flags changed.
3. Confirm paid Apple team access, bundle ID, APNs credentials, provisioning and
   physical iPhone distribution. Google OAuth registrations are present for both
   platforms; do not repeat old missing-OAuth findings. Resolve Apple's
   [login-service rule 4.8](https://developer.apple.com/app-store/review/guidelines/#login-services)
   through an equivalent qualifying option or a documented applicable exception.
   No iPhone/APNs build or delivery is certified by source configuration.
4. Complete release-environment/signing and final APK/AAB/iOS artifact checks:
   fingerprint/channel, included native modules/patches, signing continuity,
   Production OAuth certificates, Android target/API/page-size compatibility,
   actual merged permissions, and store testing/reviewer access. Do not infer
   Production readiness from Preview files or bypass runtime mismatches.
5. Test on an authorized small/large Android and physical iPhone: short/long/large-font
   comments, Send visibility, keyboard height/orientation changes, modal comments,
   sign-in and other key inputs; photo selection/cancel/error; PDF zoom/reopen and
   interrupted transfer; account switch/offline/resume; role and blocked-user flows;
   all four push categories foreground/background/closed, permission denial,
   badges and authorized taps. Use fixtures/test accounts; deletion only in an
   isolated approved environment. Preserve startup appearance and cold-launch behavior.
6. Validate recovery and monitoring before widening release: known-good artifacts
   per runtime/channel, safe fix-forward/OTA rollback, isolated database restore
   reconciled with deletion tombstones, actionable alerts without private content.
   OTA rollback cannot reverse backend writes, rules or deleted data.

## Required release operations — all awaiting approval

- Keyboard, Send sizing and boolean-guard changes are shared Android/iOS JS:
  compatible Preview OTA suffices for installed native capabilities; verify the
  target APK fingerprint before publication. No native dependency changed here.
- Parser lock correction requires a separately approved scoped Functions
  redeployment and verification of its uploaded dependency resolution. The
  isolated newsletter lock already has patched parsers; do not redeploy it just
  for this patch. Never use a blanket Functions deployment that might change
  notification/deletion workers.
- Named website security, backups/monitoring, public policies and iOS signing
  need explicit scoped decisions/actions. No Production/Hosting changes were made.
- Unresolved decoder remediation may change the native runtime depending on the
  compatible solution. No APK/iOS build is authorized by this report.
