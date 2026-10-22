# H3–H7/H9 local launch batch — NOT RELEASED

Recovery: `1529a92` retained; checkpoint `1bb97d7` preserves the full prepared C1–C4/H1/H2 batch before this work. No production data was read or changed, no live migrations/cleanup ran, and nothing was deployed/pushed/published/built.

## Prepared implementation

- Account/Profile deletion UI uses typed confirmation and recent provider reauthentication. Server verifies token revocation and auth age, creates an idempotent durable job, and freezes account writes. Worker leases, inventory receipts, approved policy gates and bounded phases support recovery. Public deletion-request page is prepared, not hosted. See `DELETION.md` for supported policy actions and limitations.
- TownLoop-specific draft Privacy/Terms, versioned registration acceptance, in-app links, Data Safety and Health declaration checklists. These drafts require operator approval; they are not submitted declarations.
- Approved authenticated reporting for posts/listings/comments/users; server-derived author identity, deterministic deduplication and persistent quotas. Server-only block records enforce bidirectional private friend/Marketplace send denial. Existing history/receipts stay accessible. Office/maintenance service channels remain available. Admin/VIP moderation queue can resolve/dismiss reports or explicitly remove reported Social content; it cannot silently delete reported accounts. Moderation actions are recorded on the protected report; a second reviewer cannot overwrite its closed decision.
- Native medication/reminder and Firebase Auth storage migrates to verified SecureStore chunks on a capable new binary; original plaintext is removed only after verified migration. Older APKs remain usable with a privacy upgrade warning. Browser health records have per-account persistence and an explicit legacy-copy/removal flow. Health disclaimers preserve existing tracking controls. See `LOCAL_DATA.md` for security limits and device checks.
- Media cleanup is server-driven and retryable, requires reviewed policy plus trusted server-created provenance, uses linked record metadata and generation preconditions, and protects parent ID reuse with server tombstones. Legacy/ambiguous files are held, never guessed/deleted. Work Order number reservations and audit records are not removed.

## Release blockers / owner decisions

1. Approve actual operator/contact, final policy/terms/version, processor disclosures, retention and deletion exceptions. No arbitrary retention schedule was invented. Authorize moderation staffing/response process. Submit reviewed Play declarations separately.
2. Approve account shared-history decisions and media cleanup policy/cutover after C2 provenance review. Retain vs remove/anonymize choices must be explicit. Unsupported anonymization/time-based policies stop the job for review; they are not silently interpreted as permission to erase history. Account identity deletion and media completion are separately tracked.
3. Prior C1–C4/H1/H2 migration, database, hosted-web source and older-client rollout gates still apply. No superseded C1-only candidate should overwrite combined rules.
4. Build a new native binary for SecureStore and backup exclusions after approval; validate migration, reauthentication, backup/restore and OS/device behavior on real devices. Updating package/config changes the fingerprint; publish compatible updates only to the intended runtime/channel after authorization. Do not blindly publish this whole snapshot to older APKs.
5. Publish/verify public policy, Terms and deletion URLs; configure/deploy only reviewed functions, rules/indexes and controlled migrations together. Native Google sign-in remains unconfigured from before this batch; native Google reauthentication requires provider configuration or the secure web route. Existing email/password flows are supported.
6. Prove real end-to-end deletion, associated-file recovery, reports, blocking, and native secure storage in an authorized staging/device workflow before claiming launch readiness. Focused mocks/emulator tests do not prove live IAM/CORS/credentials or Play approval.

## Security verification and release scope

Focused launch Firestore emulator tests cover consent, private peer blocks, receipt/history preservation, office access, report access, tombstones and deletion freezes. Offline tests cover deletion/media policy and recovery, moderation validation/deduplication, secure-storage migration/backup configuration and legal acceptance. Previous completed C1 tests/audits were not repeated. Native TypeScript and source syntax checks are used; unrelated existing web type errors remain outside this batch.

No automatic recovery may restore public chats/files, unrestricted profiles, mutable message histories, or self-assigned privileges. Fail closed and fix forward. All live account/content/media operations and deployment steps require separate explicit approval.
