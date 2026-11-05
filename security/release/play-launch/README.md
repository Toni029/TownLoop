# Android launch preparation — November 5, 2026

**Public launch: NOT READY. Internal testing: prepared, with signing/configuration
and artifact gates below.** This is a focused continuation of the existing audit,
not another feature audit. `verification.json` records read-only evidence. No
cloud configuration, policy receipt, resident data, deployment, build, publication
or GitHub push changed. Only Android Production build preparation changed locally.

## Deletion receipt: ready for separate, informed approval

Read-only checks at approximately 20:17 UTC found **two approved jobs**, both in
`retention_pending` / `scoped_retention`, with identity-deletion receipts. Both pass:

- Exact UID-to-request binding and independent canonical approved Admin/VIP reviewer
  with an enabled Firebase Authentication identity.
- Matching persisted approval audit and automatic-processing authorization receipt.
- Valid request/review times, original policy reference and protocol 3 authorization.
- Stored retention deadline equal to the worker's original-request-plus-60-calendar-days calculation.
- Valid completion receipts for both databases, completed scope receipts with the
  original expiry, and bound preflight receipts with no recorded holds.

There are **zero** pending reviews, recorded inventory holds, unresolved linked
media jobs or retention finalizations due now. One linked media job is complete.
Both deadlines are at least **51 whole days away** in this snapshot. No resident
identity, content, per-person dates or document identifiers are retained here.

This verifies recorded evidence, not the absence of every possible new report or
late-arriving object, and is not legal sign-off. Existing evidence/provenance/shared
reference checks and the six-object quarantine remain required. Already-authorized
jobs skip automatic authorization's initial reviewer check in the worker; this
pass independently checked their current reviewer and original audit records.

Fresh metadata confirms ACTIVE worker `fulfillapprovedaccountdeletions-00005-kux`,
the same identity/configuration, ENABLED five-minute scheduler, named pin `8493ef...`,
default pin `4d1c449f...` and Storage pin `9aac5f82...`. The account receipt still
pins named `224a64...`; both policy documents remain unchanged. The intentional
hash mismatch stops the runner before the job query. Native rules, Storage sync
and Admin/VIP review functions remain unchanged.

**Acknowledgment can start mutation-capable work immediately.** Retention expiry
does not become due immediately, but lease bookkeeping and late-media reconciliation
run before the retention wait. Reconciliation can delete a newly completed eligible
upload under its existing provenance/reference safeguards. Future valid approvals
can also begin account deletion automatically. Do not describe receipt acknowledgment
as merely unpausing a harmless timer. No worker/adapter was invoked for this check.

There is no confirmed recorded-data blocker to requesting separate receipt approval.
Before an authorized acknowledgment, repeat only the narrow drift/queue check and
obtain explicit acceptance of those automatic effects. Keep this hold until then.
Never change retention/reviews/flags or restore permissive rules as part of that step.

## Recovery: reuse the existing guarded plan

Fresh metadata for `(default)` in `nam5` and the named database in `us-east1` confirms:
PITR disabled, version retention `3600s`, no backup schedules and database deletion
protection disabled. Storage has **seven-day soft deletion**, with no versioning
reported; this is not an independent backup of Auth, databases or all media.

Reuse `../blocker-prerequisites/recovery.plan.json` and its guarded `recovery.cjs`:
seven-day PITR, daily backups retained seven days, weekly Sunday backups retained
28 days, for both exact databases. Five focused tests pass, including no cloud
access by default, rejected placeholder approvals and drift/duplicate protection.
Separately propose database-resource deletion protection; it does not stop document
or account deletion. Nothing was applied. The prior backup deferral remains in force.

Activation needs approval of costs, backup-specific retention, authorized recovery
operators and the restore drill. PITR history fills from enablement, not retroactively.
Backups omit rules/TTL and do not protect Auth or Storage bytes; preserve reviewed
rules/indexes/TTL, native releases and the signing key separately. Restore into an
isolated new database, reconcile deletion/access-fence evidence across both scopes,
verify roles, and only then consider an approved cutover. Never resurrect erased
profiles, Auth identities or device tokens. Block cutover if deletion evidence is
insufficient. Verify actual backup success and a restore drill before public launch.
[Firebase recovery](https://firebase.google.com/docs/firestore/disaster-recovery),
[PITR](https://firebase.google.com/docs/firestore/use-pitr).

## Monitoring: prepared, not installed or activated

Reuse the existing single-provider Sentry proposal in
`../blocker-prerequisites/sentry.proposed.json`; it supersedes the historical
Crashlytics fragment. Current native diagnostics/error boundary remain local-only.
Do not install both providers or migrate Firebase Auth/Firestore. Owner must choose
the organization/project, region, retention/access, payload controls, budget and
privacy/consent handling. A build-only symbol-upload token must never be public.
No replay, screenshot, view hierarchy, tracing, resident identity, form state or
content collection is proposed. Native and JS payloads need separate review.

`monitoring.proposed.json` prepares the existing Cloud Logging/Cloud Monitoring
signals for newsletter API/background analysis, messaging, four push categories,
review/deletion and Storage sync. It is an **inactive specification**, not a ready
import or deployed alert. It supplies the real public health endpoint, thresholds,
privacy limits and expected deletion-hold handling. Verify exact service labels and
existing alerts before activation, and approve a monitored recipient. No private
data probes or automatic destructive remediation are allowed. Native SDK integration
requires a new binary and an approved synthetic crash/symbolication test; a telemetry
OTA cannot add native crash capture. Backend alerts need separate cloud approval.
[Expo Sentry](https://docs.expo.dev/guides/using-sentry/).

## Android AAB preparation and remaining gates

- Identity: `com.toni029.townloop`; EAS project
  `9f970d26-beed-44d6-a590-9dcdc00e85de`. Production uses `store`, `app-bundle`,
  Production environment/channel, fingerprint runtime and remote auto-increment.
- Fixed locally: explicitly use the existing **local** signing credentials, matching
  Preview's verified certificate, instead of defaulting to a nonexistent remote key.
  Private key-entry presence, store-password/integrity and certificate validity were
  checked without printing secrets. No key was generated, uploaded or signed with.
- Fixed locally: Android Production explicitly uses the verified public newsletter
  API origin. HTTPS health identity and unauthenticated capabilities HTTP401 pass.
  No Gemini secret belongs in app configuration. All resolved iOS and Android
  Preview/development profiles compare unchanged.
- **Cloud build gate:** read-only EAS project inventory has zero Production variables
  and zero remote signing sets. Link the existing verified `GOOGLE_SERVICES_JSON`
  client-config file to Production with separate configuration approval. The ignored
  local fallback validates here but must not be relied on in a clean cloud checkout.
  Account-shared variables were not inventoried. Preserve Preview variables and FCM.
- Current display version is `0.1.0`; owner must approve the first store version.
  Remote Android versionCode is **2**; auto-increment would produce **3 only if**
  unchanged before the next build. Do not reset the counter or use a previously used
  Play code. No code/version was incremented in this task.
- Installed RN Gradle catalog targets/compiles **API36**, min API24. Final AAB merged
  manifest, permissions, bundled native modules, notification icon, startup audio
  protection and 16-KB native library/packaging compatibility remain artifact gates.
  This configuration check is not proof that an unbuilt AAB passes them.
- Enroll/verify Play App Signing and register its **app-signing** SHA-1/SHA-256 with
  existing Firebase/Google Android OAuth configuration. The upload certificate is
  not necessarily the certificate signing Play-installed apps. FCM v1 has an EAS
  reference; no submission-service-account reference exists, but manual Console
  upload is an acceptable first route. No new service-account key is required now.
- Play and sideloaded installs may have different signing certificates; do not
  instruct testers to uninstall and lose local data without explaining that first.

For a later separately approved build, use the existing submit-once browser-opening
helper with Android/Production, no auto-submit or polling. Keep Production and Preview
updates separate. Do not build now. [AAB](https://docs.expo.dev/tutorial/eas/android-production-build/),
[versions](https://docs.expo.dev/build-reference/app-versions/),
[target API](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en),
[16-KB](https://developer.android.com/guide/practices/page-sizes).

## Owner listing/policy inputs

The app points to `https://townloop.web.app/privacy.html`, `/terms.html` and
`/delete-account.html`. All return HTTP200, **but Terms and deletion return the same
TownLoop SPA shell, not their policy/request pages**. Privacy serves a Seeds4Clix
policy, not proof of approval for the current native app. HTTP200 alone is not a
passed policy check. No Hosting or abandoned website was modified. Publish correct
native-support HTML pages at these URLs or approve replacement URLs separately;
the external deletion path must actually allow a request without reinstalling the app.

Owner must provide/approve:

1. Legal/operator details, monitored support/privacy/deletion/moderation contact,
   effective date, accurate Privacy Policy and TownLoop Terms. Local legal source
   still has draft acceptance version `2026-10-draft1`; changing/re-consenting it is
   a separate controlled release, never silently accept on residents' behalf.
2. Data Safety answers covering identities/contact details, chats/UGC, selected
   photos/videos/PDFs, device/push tokens and diagnostics actually collected by all
   distributed SDKs. Local medication storage alone is not off-device collection.
   Disclose Firebase/Expo and Gemini/translation processing, purpose/sharing terms,
   deletion/retention, existing Storage recovery and any newly approved backups or
   telemetry. Do not claim end-to-end encryption or immediate physical erasure.
3. Functional external and in-app deletion request pathways, original timelines and
   evidence/recovery exceptions. Receipt is currently held; do not claim ongoing
   automatic processing is operational until separately acknowledged and verified.
4. Store name/descriptions/category, intended audience/countries, ads declaration,
   content rating, Health declaration (medication/treatment management applies),
   staffed UGC report/block/moderation process and nonresident reviewer access.
5. Play developer identity/account type and creation date, Production access status,
   upload-key custody and App Signing certificate; 512×512 listing icon, 1024×500
   feature graphic and at least two current approved phone screenshots without
   private resident content. Review final merged photo/video permissions against
   Play policy; a one-off picker does not justify unnecessary broad media access.

[User Data](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en),
[deletion](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en),
[Data Safety](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en),
[Health](https://support.google.com/googleplay/android-developer/answer/14738291?hl=en).

## Internal test versus public launch

| Stage | Requirements still remaining |
| --- | --- |
| Play internal testing | Owner's verified Play account/app, controlled Production client file, approved one-time signed AAB, App Signing/OAuth certificate check, increasing versionCode, artifact validation, authorized tester list and role-safe accounts, then the device checklist. Internal-only apps are exempt from the Data Safety form; do not treat that as permission to ignore privacy/security or the app's broken legal links. Internal testing is limited to 100 testers. |
| Closed/public release | Complete accurate store/policy/Health/Data Safety declarations and functional external deletion path, consciously resolve the receipt hold, approve/test recovery and crash/ops reporting, pass device and Play prelaunch checks, establish staffed support/moderation and staged rollout/recovery. For personal accounts created after November 13, 2023, at least 12 continuously opted-in closed testers for 14 days and approved Production access are required; Preview or internal testing does not satisfy this. Check actual Console requirements for this account. |

[Internal track](https://support.google.com/googleplay/android-developer/answer/9845334?hl=en),
[personal-account testing](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en).

No physical Android/iPhone, Play prelaunch report, real crash alert, backup restore
or deletion execution was tested here. The existing keyboard/decoder fixes remain
in source; use the current signed candidate for device evidence, not an old Preview
APK. iPhone signing/APNs remains a separate launch track; Android checks do not
certify it. See `ANDROID_ACCEPTANCE.md` for the single focused Android pass.
