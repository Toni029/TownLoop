# TownLoop policy decisions — owner approval required

Prepared 2026-10-21 from local source. Status: DRAFT / NOT RELEASE APPROVAL. No console submission, deployment, OTA publication, or production-data operation is authorized by this document.

## Evidence and proposed disclosures

| Area | Source evidence | Decision before release |
| --- | --- | --- |
| Identity and contact | App name TownLoop; known community office phone 904-771-8839 | Confirm accountable operator, privacy point of contact and monitored request mechanism. Do not reuse Seeds4Clix branding as an assumed legal entity or invent an email. |
| Account/profile | `src/services/auth.ts`, native ResidentRegistration, Firestore users | Name, email, UID, address, optional phone/emergency contact, avatar, approval/role; app functionality and account management. Verify audience and staff permissions. |
| Social/Inbox | `native/src/social/Inbox.tsx`, social actions, marketplace chat services | Messages, optional shared contact details, posts, listings, comments and media. No end-to-end encryption claim. Verify reporting/blocking, moderation staffing and retention. |
| Maintenance/media | native workorders translator and components/media, mediaAuthorization | Tickets/comments, photos and selected community video, Storage paths. Confirm upload deletion/abandoned files and staff access. |
| Health/reminders | Baseline native HomeStore used AsyncStorage. Prepared native `localData/nativeStorage.ts` gates `protectedHomeStorage` on ExpoSecureStore capability and migrates validated data through verified chunked writes. Prepared web medication storage persists per UID in IndexedDB with AES-GCM and a nonextractable CryptoKey stored alongside ciphertext; DailyMedications offers explicit legacy copying/removal. | SecureStore requires a new binary; older APKs without the module retain AsyncStorage fallback, even with updated JS. Web saved entries survive refresh. Same-origin scripts can use the key; this is browser at-rest encryption, not a vault or XSS defense. Site-data clearing/eviction loses records. Legacy plaintext remains until separate confirmed removal; copying requires a verified durable write. Ordinary native sign-out preserves reminders. Verify migration, OS backups, deletion and all distributed versions. No cloud writes in these reminder stores; health content can still be uploaded elsewhere. |
| Translation | server/translation.ts, native workorders/translator.ts | Work-order text to Google Translate; Gemini fallback. Approve provider contracts/settings, disclosure, service region and retention. |
| Newsletter AI | native news/ai.ts and server/newsletterExtractor.ts | Editor PDF to server/Gemini; extracted content reviewed before applying. Verify temporary files/logs and provider training/retention settings; do not promise exclusion from training without evidence. |
| Device/services | native app.json Firebase/Expo dependencies; home/weatherModel.ts | Auth persistence, local settings, HTTPS service requests; Expo OTA and fixed-coordinate Open-Meteo weather. Audit release SDK network/logging/device identifiers. No unsupported analytics/ads absence claim. |
| Retention/deletion | Prepared accountDeletion callable validates recent verified authentication and confirmation, queues a restartable job and marks deletionPending. Worker supports owned social deletion only under explicit owner-approved collection policy; unresolved shared references stay on policy hold. | No approved schedule or live deployment evidenced. Approve collection decisions and shared-reference reasons; test identity versus media-cleanup status separately, logs/backups and processor deletion. Set processing owner and actual service target. Disabling alone is insufficient. |
| Legacy private history | H9 trusted cutover is prepared and gated on reviewed migration inputs/authorization | Do not infer that legacy histories have been migrated, uploaded, anonymized or purged. Verify scoped migration receipts, reconciliation and rollback before enabling the cutover. |

## Registration contract

New email/password registrations require an explicit unchecked-by-default checkbox accepting Terms and acknowledging Privacy. Canonical Firestore fields: `termsVersion: '2026-10-draft1'` and `termsAcceptedAt: serverTimestamp()` (Firestore timestamp, never client ISO time). Shared constants live in `src/data/legal.ts`. Web `signupUser` accepts optional `termsAccepted?: boolean` for caller compatibility but rejects anything other than true before Auth creation. Web Google sign-in requires acceptance only before creating a missing resident profile; it signs out and errors otherwise. It does not delete the Google Auth account. Existing profiles continue sign-in without invented acceptance records. Native first-Google-profile flow must obey the same contract. Rules must enforce new profile acceptance and protect its provenance on updates. Missing-profile email login does not silently create a profile.

Draft consent is for local implementation validation. Owner must approve final policy/terms and decide whether to replace draft version before release. Never retrofit acceptance timestamps onto existing users; approve a separate re-consent rollout. Hosted URLs are planned, not verified deployed: https://townloop.web.app/privacy.html, /terms.html, /delete-account.html.

## Health declaration recommendation (owner must submit)

Medication names, schedules and dose/taken controls remain health functionality even when local. Proposed declaration includes **Medication and Treatment Management**; review other available categories against the final shipped feature set. Do not choose “no health features” while medication reminders remain. Local-only data may fall outside collected-data reporting, but does not remove the health-feature declaration. Verify native new-binary protection versus older-APK fallback, persistent encrypted IndexedDB behavior and its same-origin/storage-eviction limitations, legacy import/removal, OS backup and any cloud path first. No medical-device, clinical, HIPAA, or regulatory-compliance claims are established. Confirm the in-app medical disclaimer and no emergency/critical-alert positioning.

## Release-blocking owner decisions

- Approve operator identity, verified contact and final public wording/effective date.
- Approve real retention schedule, deletion exceptions and request operations; verify both request surfaces and purge coverage.
- Confirm moderation policy, user/content reporting and blocking implementation, reviewer staffing and response handling. Terms alone do not satisfy UGC obligations.
- Approve provider contracts, AI retention/training configuration, permissions and production SDK inventory.
- Approve and submit accurate Data safety, Health apps, content rating and store listing answers after reviewing all distributed versions.
- Publish approved pages and verify unauthenticated public HTTPS availability; verify in-app links on device before release.

## Official sources checked 2026-10-21

- [Google Play User Data policy](https://support.google.com/googleplay/android-developer/answer/10144311): privacy disclosure/contact/retention and account deletion expectations.
- [Account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111): in-app and external request pathways and associated data.
- [Data safety guidance](https://support.google.com/googleplay/android-developer/answer/10787469): inventory off-device transmissions including SDKs; distinguish local processing and form exemptions carefully.
- [Health declaration guidance](https://support.google.com/googleplay/android-developer/answer/14738291): reminder functionality supports the proposed medication category.
- [UGC policy](https://support.google.com/googleplay/android-developer/answer/9876937): acceptance, objectionable-content rules and appropriate reporting/blocking safeguards.

This is a source-based engineering draft, not a legal determination or approved Play Console declaration.
