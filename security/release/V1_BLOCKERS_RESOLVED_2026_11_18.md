# v1.0 remaining-blocker release — November 18, 2026

Scoped continuation of `fdd7dad`; no repeat security audit. Firebase project `cc-livingcommunity-app`.

## Completed

- Registered the owner-supplied Google Play App Signing SHA-1 and SHA-256 on the existing `com.townloop.app` Firebase registration. Existing upload/Preview registrations and certificates retained. Firebase returned the matching Android OAuth client. Updated the ignored production client configuration and existing EAS Production `GOOGLE_SERVICES_JSON` file variable. No keys generated/replaced.
- Play SHA-1: `18:6C:F1:51:3B:29:A5:8E:E9:02:DC:F3:38:81:56:E2:92:8B:BD:67`.
- Play SHA-256: `52:C8:D2:43:BA:88:4C:0E:2F:D3:76:E3:4E:F3:D2:15:15:8A:F2:38:CA:1F:F7:4F:A7:43:C5:EB:1A:9A:25:E2`.
- Deployed prepared durable per-user request budgets for messaging, translation, newsletter admission, upload reservations, account-review mutations and cleanup requests. Composed the reviewed atomic-write quota rules onto the currently deployed cleanup guards; retained parent locks, historical provenance and Storage two-document authorization structure. Direct chargeable client writes require valid atomic quota proofs; uploads require server-issued reservations. Token-free media rollout remains false; no historical download tokens rotated.
- Updated both deployment compatibility receipts to exact current rules. Preserved original media provenance cutoff, worker identity, five-minute schedule, three enable flags, 60-day retention, independent approvals and cleanup coordination.
- Account preflight now recognizes current server-owned cleanup/routing/config collections without treating every account as an unknown-schema exception. Any reference to the deleting UID still holds the account for disposition; unknown collections remain held. No metadata erased.
- Both existing jobs had independently verified approvals, no preflight holds, completed database scopes, no active leases, no matching late-uploaded files and future deadlines: December 27 and December 29, 2026. No other account-deletion jobs existed. Owner explicitly authorized automatic processing after these checks; no worker was manually invoked. Existing jobs remain retention_pending in post-deployment verification.
- Play Integrity provider now requires device integrity/Play-recognized app verdicts for successful monitoring tokens. Auth, Firestore and Storage enforcement remains UNENFORCED. No debug bypass or new native dependency.
- Existing Gemini server-side secret produced HTTP200 for a harmless synthetic request using the existing fallback `gemini-3-flash-preview`; no resident content sent, billing/key/model chain changed, or full newsletter reanalyzed. API health remains 200; anonymous Inbox/upload calls return 401. Newsletter task/extraction code was not redeployed.

## Deployed revisions

- `issueNewsletterUpload` → `issuenewsletterupload-00001-nix`.
- `issueMediaUpload` → `issuemediaupload-00002-pox`.
- `manageInboxConversation` → `manageinboxconversation-00007-vuj`.
- `reviewAccountDeletionRequest` → `reviewaccountdeletionrequest-00003-ciq`.
- `fulfillApprovedAccountDeletions` → `fulfillapprovedaccountdeletions-00007-gok`.
- `translateWorkOrder` → `translateworkorder-00002-lel`.
- `newsletterApi` → `newsletterapi-00008-kad`.
- `manageDatabaseCleanup` → `managedatabasecleanup-00009-teg`.
- `completeMediaUpload` → `completemediaupload-00002-mus`.

## Rules and receipts

- `cloud.firestore`: `8d105d51885783e5b98993ca185d0ac968abf4d1eb423f53d78710e78dcc9047`; `ed3d7ce9-9461-4bda-9e2f-c570dfa57525`.
- `cloud.firestore/ai-studio-cclivingv27-5fc1a0f6-cd75-4964-8c9e-e219a265f7bb`: `8493ef2624b905208328f9ac7116dfe59e8349b1d24a8c3aa0883ceabd0da02d`; `b9930259-e74c-4438-8c50-facadabfd8a5`.
- `firebase.storage/cc-livingcommunity-app.firebasestorage.app`: `b844e570c4e44c8abb8961d934bf3d8393ae97b3ae2408d5cf7828dcb80f80b5`; `a4249983-d23a-40d0-9a45-332ed5f0ec58`.

Cleanup compatibility receipt updated at `2026-11-18T21:26:50.971965Z`. Named database deny-all rules unchanged. Default/Storage release hashes and both receipts verified after deployment. Cleanup write lock released. No cleanup job started; no resident deletion invoked as testing. Automatic scheduling may now process only independently approved eligible requests under the existing policy.

## Focused verification

- 17 Node tests passed for account preflight/runner, compatibility and durable budgets.
- 16 paired Firestore/Storage emulator scenarios passed using the composed current rules: normal writes, direct bypass, pending accounts, counter replay and upload reservations.
- 5 production Firebase/signing configuration tests passed; production config validates after refresh.
- Read-only cloud verification confirmed matching live rules, valid cleanup receipt/writer inventory, active functions, unchanged free-tier billing and two retention-pending jobs.

## Binary, device and owner actions

- No client JS changed, so no OTA needed for this backend/configuration release. Installed Play version 7 was built November 17 after the November 11 quota hooks and November 17 App Check Gradle fix. Its Production runtime remains `d32dc5688ac21165ce8f8d8bdf6ec07b04b5bc93`. No runtime override or incompatible update published.
- Final version 1.0.0 configuration remains `com.townloop.app`, target/compile SDK36, remote EAS signing, store AAB, production channel. Read-only EAS counter still 7: next automatic allocation expected 8; owner must confirm 8 unused in Play Console. Refreshed native Firebase file and version 1.0.0 must receive their genuine newly computed fingerprint on the separately approved AAB.
- Physical Play-installed Google login, genuine Play Integrity token metrics, ordinary media uploads and normal posting/messaging still require a short phone acceptance pass. No Samsung/iPhone test claimed.
- Owner must finish/confirm Play production access, listing/screenshots, Data Safety, Health Apps/medication declaration, Social child-safety/content rating, reviewer access, public legal/deletion links and geographic availability before public promotion. No Play Console submission performed.
- Actual API restriction: unpaid Gemini terms prohibit sensitive/confidential/personal input and require paid service for API clients available in EEA/UK/Switzerland. Owner approval does not change provider terms. Keep newsletter input compliant and confirm geographic distribution; no billing or content-redaction redesign was introduced. Sources: https://aistudio.google.com/docs/terms and https://firebase.google.com/docs/app-check/android/play-integrity-provider.

Ready for owner authorization of one v1.0 release-candidate AAB, subject to the stated device/Console/provider conditions. No binary built, GitHub pushed, Hosting changed or public release promoted.
