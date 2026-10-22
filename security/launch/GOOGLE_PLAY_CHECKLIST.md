# TownLoop Google Play release checklist

Status: BLOCKED on owner decisions and verification. Prepared 2026-10-21. Unchecked items are not completed by the local code changes. See [policy decisions](POLICY_DECISIONS.md) for evidence and official sources.

## Public documents and access

- [ ] Owner approves TownLoop-specific privacy and terms; confirm operator, privacy contact, retention, deletion and final version/effective date.
- [ ] Deploy approved `public/privacy.html`, `terms.html`, and deletion request page. Confirm https://townloop.web.app/privacy.html, /terms.html and /delete-account.html work without authentication or geography restriction on a physical device. Local files and planned URLs are not publication evidence.
- [ ] Confirm Privacy/Terms links from native sign-in, registration, Account and web authentication; check external browser opens and return path.
- [ ] Test unchecked consent rejection, accepted signup server timestamp, missing-profile Google consent and preservation of existing-user sign-in. Rules must reject forged/missing new-profile acceptance. Do not silently mark legacy users as accepted.

## Data safety worksheet — proposed inventory, not submitted answers

Review every currently distributed build and SDK, not just this checkout. Verify exact Console categories, purposes, collection/sharing definitions and service-provider exceptions before saving answers.

| Candidate type | Code-observed flow | Purpose / unresolved answer |
| --- | --- | --- |
| Personal information | Name/email/UID/address, optional phone and emergency contact, account role/approval | Account management, app functionality. Confirm required versus optional fields and third-party contact classification. |
| Photos/videos and files/docs | Selected attachments, avatars, newsletter PDFs -> Firebase Storage; editor PDFs -> AI server/Gemini | App functionality. Verify SDKs, provider terms and sharing exemption eligibility. |
| Messages / other user-generated content | Inbox conversations, community posts/comments, listings, maintenance text | App functionality. Google translation/Gemini can receive maintenance text. Verify audiences and deletion. |
| Health information | Prepared native protectedHomeStorage uses Expo SecureStore only when supported by the installed binary; baseline/older APKs use AsyncStorage. Prepared web persists per UID in AES-GCM encrypted IndexedDB with a nonextractable CryptoKey stored with ciphertext; explicit legacy copying preserves plaintext originals until separate confirmed removal. | Do not mark off-device collection solely because reminders exist. Refresh retains saved records; same-origin scripts can use the key and site-data clearing/eviction can remove records. Audit backups, new-binary migration, older versions and health content uploaded elsewhere before deciding. |
| App activity, device IDs, diagnostics | SDK, Firebase Auth, server/hosting and Expo update requests need production audit | Do not guess no collection. Capture actual SDK/network/logging behavior, identifiers, retention and purposes. |

- [ ] Review encryption in transit and all endpoints in the final artifact; do not claim end-to-end encryption.
- [ ] Verify required/optional collection and any ephemeral processing against Google's definitions; no assumed exemption for AI or service providers.
- [ ] Approve retention schedule, actual deletion process and data-retention exceptions; verify deletion across Auth, Firestore, Storage, associated records, logs and backups as applicable.
- [ ] Test prepared in-app and public web account deletion requests without requiring app reinstall. Verify recent authenticated-session checks, confirmation, deletionPending write restrictions, job retries and handling owner. No live service is established by local code.
- [ ] Approve explicit collection policies for owned social deletion and any retained shared references with reasons. Verify policy holds for unknown/shared history; separately verify identity completion, media jobs and local-data cleanup. Do not report all data erased while cleanup or policy decisions remain pending.
- [ ] Verify H9 trusted private-history cutover approval, scoped inputs, receipts and reconciliation. Do not claim existing histories migrated solely because migration tooling is prepared.
- [ ] Finalize provider/AI retention, training, regions and contracts before making policy promises. Submit owner-approved Data safety answers and matching public text.

## Health and medical functionality

- [ ] Complete Health apps declaration. Proposed feature: **Medication and Treatment Management** while medication schedules/taken controls remain; owner reviews other categories. Do not select no health features simply because reminders are local.
- [ ] Verify accessible in-app disclaimer: personal reminder aid; no diagnosis/treatment; professional medical advice for decisions; no emergency or critical-dose reliance. Verify actual reminder/notification capabilities and listing claims.
- [ ] Verify the new APK contains Expo SecureStore before claiming protected native storage; test validated migration, failure preservation and explicit local deletion. Older APKs without the module continue AsyncStorage fallback; OTA alone cannot add it.
- [ ] Verify new web reminders persist per UID across refresh through encrypted IndexedDB; verify AES-GCM writes and nonextractable keys. Disclose same-origin script access and site-data clearing/eviction limitations; do not call it a vault or XSS protection. Test legacy copying only after a verified durable write and separate confirmed removal; no silent legacy purge.
- [ ] Audit local storage and OS backup behavior across shipped versions; avoid unsupported medical-device, HIPAA, FDA or clinical claims.

## User-generated content and permissions

- [ ] Require terms acceptance before new users can submit content. Approve prohibited-content rules, moderation ownership, report handling and appeal process.
- [ ] Verify functioning, clearly labeled in-app report-content, report-user and block-user paths appropriate to social content and one-to-one messaging. Code draft terms are not proof of implemented moderation.
- [ ] Inspect final merged Android manifest. Remove unnecessary broad media/storage permissions; verify system picker and camera-denial behavior. App config alone is not sufficient evidence.
- [ ] Complete content rating/target audience, store listing, app access review credentials and any permission declarations against the final binary.

## Owner release record

- [ ] Record accountable approver, approval date, reviewed build/runtime version, final policy version, public URL checks, Console submissions and test evidence.
- [ ] Resolve all open rows in POLICY_DECISIONS.md before build distribution/production release. No deployment, OTA, store submission, or approval is performed by this checklist.
