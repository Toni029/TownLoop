# TownLoop security/privacy release candidate RC1

**Authoritative release handoff, 2026-10-21.** Supersedes any earlier instruction to replace the hosted website. Code/configuration is consolidated locally; deployment is NOT authorized and policy decisions remain pending. Preserve `fb8c146`, `1bb97d7`, `1529a92` and all previous checkpoints. This handoff does not start another development batch.

## Release boundary

- Include the completed native/shared security, privacy, moderation, deletion preparation, technical fixes, and existing UI/media/PDF improvements on `native/expo-migration`. Prior verification is reused in `verification.json`; no broad audit/build is repeated.
- Default Firestore backend only: `cc-livingcommunity-app/(default)`. Hosted `townloop` website and named database `ai-studio-cclivingv27-5fc1a0f6-cd75-4964-8c9e-e219a265f7bb` are explicitly EXCLUDED. No Hosting deployment configuration is supplied for this release.
- Preserve current Android package, Firebase project, EAS project, signing setup, database IDs and data. Do not uninstall, clear app data, reset counters or rewrite conversation/message history.
- `firebase.coordinated.json` contains reviewed Firestore/indexes/Storage candidates. `firebase.release-backend.json` at repository root preserves the existing Functions codebase and uses the audited npm lock instead of the stale alternate pnpm resolution. Deploy only named approved exports; do not use blanket `firebase deploy` or `--only functions`.
- Public policy/deletion request pages remain prepared source. Because Hosting is excluded, approve a separate static-only publishing target or an approved separately scoped page publication; do not replace the existing site's index/bundle/database. Verify URLs before enabling the public release.

## Owner decisions before deployment

1. Approve `RETENTION_APPROVAL.md` by category, final operator/contact/Privacy/Terms/consent version, shared-history/account deletion exceptions, moderation staffing and Google Play disclosures. `retention-policy.UNAPPROVED.json` is inactive and must stay so until signed off.
2. Approve scoped default-database metadata verification/backfill and a controlled cutover/old-client upgrade window. Approve backups and handling of held identities/files; no private data inspection or migration is authorized yet.
3. Prove shared-bucket compatibility with the unchanged hosted website before global Storage activation. If proof is unavailable, HOLD Storage deployment; native database isolation does not isolate that bucket. Do not bypass with public rules. Approve legacy download-token revocation separately.
4. Provide/approve native Firebase app configuration for Crashlytics, telemetry policy and Cloud Monitoring alert recipients/budget. `MONITORING.md` and its fragments are prepared; modules are not yet installed/active. Existing native Google option is intentionally hidden. Previous push client work remains deferred at `recovery/push-preparation-f31dc54`, not active in this candidate; restoring it needs explicit scope/configuration and must not be silently cherry-picked with obsolete security code.
5. Approve unresolved production-relevant advisories after the targeted compatible patches in `DEPENDENCIES.md`. No incompatible Expo upgrade or unverified cross-major override is proposed. This is a known launch gate, not a clean vulnerability claim.

## Minimum coordinated deployment sequence

### Stage 0 — approve and freeze

Approve the exact RC scope, decisions above, maintenance/upgrade communication and deployment stages. Local checkpoint may be created now; GitHub push waits for approval. Once approved, push that exact checkpoint. Never include `.env`, signing/Google credentials, resident exports, local plans or diagnostic logs. Freeze one immutable source/environment for native runtime computation, build and OTA.

### Stage 1 — reversible backend preparation

After explicit access/deployment approval, capture restricted backups and fresh live-rule exports for the DEFAULT database. Compare live drift to `candidate-manifest.json`; merge legitimate unrelated changes, never overwrite silently. Install reviewed indexes and wait for readiness. Deploy only non-destructive directory/moderation/block functions; deploy the secured translation update only if approved. Provision a separate HTTPS newsletter API with durable private PDF storage; do not replace Hosting.

Commands below are prepared actions, NOT executed:

```sh
firebase deploy --project cc-livingcommunity-app --config security/release/firebase.coordinated.json --only firestore:indexes
firebase deploy --project cc-livingcommunity-app --config firebase.release-backend.json --only functions:work-order-retention:syncResidentDirectory,functions:work-order-retention:submitSafetyReport,functions:work-order-retention:setUserBlock,functions:work-order-retention:reviewSafetyReport
```

Do not deploy/start account-deletion, media-cleanup or draft-expiry workers yet. Preserve any already-running approved 30-day Work Order worker; verify its existing state under the separately approved deployment session, do not redeploy it incidentally. Do not deploy notification triggers without an approved working push client/credentials. Prepared Functions use default data; no named-database counterpart is added.

### Stage 2 — approved non-destructive migrations and reconciliation

Apply ONLY reviewed migrations in `MIGRATIONS.md`: directory projection; publication markers; exact legacy Inbox UID membership; verified Storage parent metadata. Keep IDs/content/files unchanged. Use version/generation preconditions, bounded batches, receipts and aggregate reconciliation. Ambiguities/conflicts stop the affected cutover. C1 itself needs no identity migration based on its completed 2/2 result. No cleanup, policy activation, token revocation or resident deletion is included.

There is no safe automatic migration of unresolved identities. Prepared offline planners do not grant live-write authority. Their approved inputs and execution receipts are deployment prerequisites, not another audit.

### Stage 3 — finalize and build ONE Preview APK

Supply approved native Firebase client files, integrate the reviewed Crashlytics fragment if included in this APK, and lock those native packages once. This is a bounded configuration step in the authorized build stage, not an Expo redesign/upgrade. Keep SecureStore, backup exclusions, all current native features, package/signing, Preview profile and fingerprint runtime policy. No fixed runtime string is copied from the old APK.

```sh
cd native
npm run build:preview
# After matching the resulting binary's runtime/environment and separate OTA approval:
npm run update:preview -- "Approved consolidated security release"
```

A new APK can contain all ACTIVE completed changes. Crashlytics is additional native setup; deferred push client is not currently included. Compatible signing must be verified by EAS/operator, not assumed from package name alone. Install over the existing app; do not uninstall or clear data. Older runtimes and Production clients will not receive a different-runtime Preview OTA. Announce/require their approved upgrade before strict-rule cutover; no source/config trick can make an incompatible APK receive it.

### Stage 4 — client/rules cutover, with data preserved

Use the approved maintenance/upgrade window if old and new schema contracts cannot coexist. Verify authorized new clients first against staging/reconciled data. Release the approved APK to the test group and compatible Preview OTA only, then activate the reconciled default Firestore candidate when the intended users are on compatible clients. Do not claim the rules and client publication are atomic; coordinate availability and retain drafts for retry. Old incompatible clients may receive permission errors and must upgrade rather than regain insecure access.

```sh
firebase deploy --project cc-livingcommunity-app --config security/release/firebase.coordinated.json --only firestore:rules
# Separate gate: ONLY after unchanged-website bucket compatibility and legacy-file access are proven:
firebase deploy --project cc-livingcommunity-app --config security/release/firebase.coordinated.json --only storage
```

Do not couple the two commands into an unconditional deploy. Rotate approved legacy file tokens only after authenticated readers work and website compatibility is proven. No Hosting or named-database deployment occurs. Validate participant-only chats, private profiles, role/ownership, upload/read/retry and retained drafts with approved test scope; never inspect resident messages to prove access control.

### Stage 5 — enable approved policies/monitoring and sign off

Only after category policies are signed off and supported end-to-end deletion is demonstrated: deploy explicitly approved deletion/media functions, publish approved policy documents via a separate reviewed operation and start workers. Unsupported anonymization or unavailable retention decisions remain held, not approximated. Activate Crashlytics collection only under the approved telemetry choice; enable Cloud Monitoring alerts and verify harmless test delivery. Preserve permanent ticket reservations, audit receipts/tombstones and retry state.

Production/Google Play/AAB promotion is a SEPARATE authorization after phone verification, remaining advisory decisions and public policy/Data Safety/Health declaration readiness. Preview/Production channels stay distinct; they do not isolate backend data. No Production update is part of this handoff.

## Recovery

Preserve restricted reads and deny writes using the prepared read-only recovery candidate if needed; pause privileged workers separately. Roll forward or republish only a security-compatible update for the same channel/runtime. Never restore public Marketplace/Storage access, old mutable-message rules, source counters, or an unrelated Hosting artifact. Backups require scoped restore approval. Device-local medication migration verifies the new encrypted copy before removal; do not use app-data clearing as rollback.

## Ready / held

RC source, rules/indexes snapshots, deployment configuration, migration contracts, retention proposals and monitoring fragments are PREPARED. Existing focused results are reused. No new tests/builds are needed merely to repeat those results. Deployability remains held on owner decisions, approved migration inputs/receipts, shared-bucket compatibility and native monitoring configuration. The next phase can be the staged DEPLOYMENT above once those explicit gates are approved; there is no authorization to execute them now.
