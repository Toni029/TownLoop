# TownLoop submission worksheet — owner review, not submitted

Checked against official guidance October 25, 2026. Scope: actual app source, approved retained
work and read-only artifact/config checks; no new broad audit, Play Console access or submission.

## Submission gates

- **Deletion:** in-app and external request pathways are required; actual associated-data handling
  must operate. Manual Admin/VIP review can remain, but no arbitrary refusal/indefinite hold.
  TownLoop's 3-business-day/7-day/60-day targets are its policy, not Google-approved exceptions.
  Publish approved accessible HTTPS account-deletion page and privacy policy before submission.
  [Account deletion guidance](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en).
- **Policy:** operator identity, contact, actual collection/use/sharing, retention and deletion
  disclosures must be accurate. Privacy text should be public HTML, accessible without account
  access, linked in the app and Console; approve the placeholders in the existing drafts.
  [User Data](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en).
- **UGC:** preserve registration acceptance, reporting users/content, blocking direct contacts
  and active moderation; designate real reviewers and handling/appeal contact. Existing code/tests
  are reused; no new resident reports were filed as a test.
  [UGC requirements](https://support.google.com/googleplay/android-developer/answer/9876937?hl=en).
- **Health:** complete Health apps declaration; medication tracking fits Medication and Treatment
  Management. Keep accessible non-medical-advice/critical-reminder limitations and no unsupported
  medical accuracy or emergency claims. Local-only storage does not eliminate the health-feature
  declaration. [Health form](https://support.google.com/googleplay/android-developer/answer/14738291?hl=en).
- **Target/binary:** new phone submissions require API 36 from August 31, 2026; inspected Preview
  already targets 36. Preserve 16-KB support and retest the final binary; old APK packaging checks
  pass. [Target policy](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en),
  [16-KB guidance](https://developer.android.com/guide/practices/page-sizes).
- **Testing:** personal developer accounts created after November 13, 2023 need at least 12 testers
  continuously opted in for 14 days in a closed test before applying for Production access.
  Owner must confirm account type/date and Console requirements; Preview sideloading is not that
  closed test. [Testing](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en).
- **Signing:** a new Play app needs AAB/Play App Signing enrollment. Existing Production profile
  is AAB/production, Preview is APK/preview. Verify upload key versus Play app-signing certificate
  and reviewer access; never assume Play installs can update the sideloaded APK if certificates
  differ. No credentials or keys were changed.
  [Signing/upload](https://developer.android.com/studio/publish/upload-bundle?hl=en).

## Data Safety draft — source-based, owner must finalize all distributed-version answers

Yes: account creation (email/password; Google only on surfaces where configured). Deletion:
request mechanism exists, actual fulfillment gates remain; do not attest completed deletion yet.
HTTPS is used for Firebase; no end-to-end encryption claim. Review any separately hosted API's
production HTTPS and provider configuration before attesting all off-device traffic is encrypted.

| Console category candidate | Actual handling | Purpose / proposed required or optional |
|---|---|---|
| Personal info: name, email, user ID | Firebase Auth and profile/directory authorization | Account management, functionality; required account fields |
| Address, phone, other personal info | Residency, DOB, emergency-contact and profile details in Firestore | Community/account functionality; field-level necessity/third-party contact disclosures need owner confirmation |
| Messages: other in-app messages | Private/office chats in Firestore; authorized participants/staff | Communication functionality; optional feature use |
| Other user-generated content | Work Orders, posts, comments, listings, moderation reports, RSVPs | Functionality, safety/moderation; optional feature use |
| Photos/videos; files/docs | Selected media, avatars and newsletters; some PDF/translation workflows go to Google services | Functionality; optional uploads. Confirm provider processing terms before deciding sharing exemptions |
| Health information | Medication/checklist reminders remain in UID-scoped local storage; health-related uploaded content may go off device | Do not declare local reminders collected solely because they exist. Review actual feature inputs/health content and all versions; no blanket “no health collection” attestation |
| Device/other IDs; app activity/diagnostics | Firebase/Expo update/server requests and logs need provider-specific final classification | Security/updates; no advertising purpose assumed. Crashlytics/push client remain deferred, so do not claim active crash/push features |

Do not automatically mark “not shared”: Google's service-provider exceptions depend on actual
contracts/purposes, including AI/translation processing and user-directed sharing. Confirm provider
retention/training settings and exact SDK data guidance. No ads/payment/precise-device-location flow
is identified in this existing scope; that is not a universal “collects nothing” answer.
[Data Safety definitions](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en).

## Store and release inputs still needed

- Operator Seeds4Clix; supplied support email `support@seeds4Clix.com` monitoring must be confirmed before publication. No address or additional legal entity information is invented. Approve effective date and public privacy/deletion URLs.
- App name/descriptions/category, content rating, intended audience, ads/access declarations,
  Health declaration, Data Safety and a working reviewer-access arrangement approved by owner.
  Never create resident accounts for reviewers without authorization or use real resident data.
- Store icon 512×512, feature graphic 1024×500, at least two accurate phone screenshots. Capture
  a staged/approved nonresident environment with no private content; no screenshots generated here.
  [Asset requirements](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en).
- Apply the inactive permission fragment only in an approved new binary. System picker needs no
  broad photo-library access in the current flow; verify older-Android fallback and optional camera.
  Do not make new permission claims based solely on app.json or remove working features.

## Minimal final-device pass (no repeat audit)

1. Fresh-install online/offline cold launch and repeated reopen; exact MP4/neutral splash/fallback;
   background/resume and coexistence with other audio. Native opt-out must pass artifact gate first.
2. Existing Samsung successful/cancel/retry picker behavior remains confirmed by owner. One final
   smoke pass only if a NEW native build changes picker/permissions: Feed, Marketplace and Work Orders.
3. Account switching, all four roles, Inbox and request/review/status. Confirm approval stays held
   until separately approved processing. Use authorized synthetic fixtures, not real deletion jobs.
4. Confirm offline/disabled cleanup and interrupted retry with approved fixture data; protected
   storage migration; private images/PDFs; larger text/keyboard and the final health/policy links.
5. Play prelaunch report and applicable closed test on the actual signed AAB; inspect final manifest,
   16-KB packaging and crash results. No FPS or physical-device claim arises from TypeScript.

Production rollout: internal/closed test first, then owner-approved staged rollout with monitoring.
Halt rollout on a genuine crash/access regression. Use a higher-version-code corrective AAB and
runtime-matched JS update only where compatible; do not downgrade rules, restore public Storage,
resurrect deleted records or reuse retired bearer tokens as recovery. Default-off destructive
workers stay off until their separate safety gate and activation approval pass.

## Owner decisions applied October 26, 2026

- Automatic overdue notifications: canonical approved Admin only; VIP can review but is excluded
  from automatic delivery. Monitoring stays disabled. Review 3 business days, escalation 7 calendar
  days, processing target 7 days; ordinary retention remains a maximum of 60 days.
- Backups: changes deferred. Disclose existing verified settings, not proposed daily backups/PITR.
- No specific applicable legal basis established for an application 400-day exception. Existing
  fixed Google system audit retention is a provider constraint requiring owner/legal review,
  not authority to retain chats/photos or application receipts for 400 days. See POLICY_DECISIONS.md.
- Stage 1 Android cleanup/images OTA is actually published (metadata rechecked October 26):
  `01a17571-852a-7f02-a990-c6e3ee81677e`, source `bfb1a85`, runtime
  `d6f09b9023171c8bdabd4a8e1da0b41223dff3b9`. Phone installation remains owner verification.

Prepared protocol 3 adds cleanup-only device identifiers and server credential hashes for security/account-data cleanup, with finite expiry, protected native storage and no deletion authority. It is not active or published. Include the actual released protocol in Device/other IDs and retention answers when activated; no claim of offline remote erasure. Supported two-database execution and Admin exception rechecks are implemented locally; current named-database anonymous chat writes block activation. See PROCESSING_PROTOCOL3.md.
