# Local pre-launch security batch — NOT DEPLOYED

Recovery checkpoint: `1529a92`. C1 Marketplace rules body is byte-for-byte preserved. C1's historical candidate/patches remain unchanged review artifacts; do not deploy an old C1-only candidate over this combined batch.

## Implemented scope

- **C2:** `security/storage.proposed.rules`; linked, bounded upload drafts in existing parent collections; create-only media with authentic uploader UID and parent authorization; private WorkOrder `gs://` references and authenticated native/web readers. Gallery/camera and newsletter paths retained. Existing data is not changed.
- **C3:** own/approved Admin/VIP private-profile reads; server-owned minimal `resident_directory`; both clients use projections for resident/Crew directory access; transactional current-source projection trigger and offline planner.
- **C4:** all Social mutations require explicit approval and canonical roles. Owner fields/snapshots immutable; comments append one authentic author entry, previous comments unchanged; actor-only reaction ledger with checked count delta; seller/Admin/VIP-only availability changes. Shared transactional clients retain form input on failures.
- **H1:** immutable Inbox history, canonical sender snapshots, exact UID/versioned friend memberships, actor-only read/hide cursors and no shared conversation deletion. Native/web/backend push policy updated together.
- **H2:** no alias/flag/email-derived privileges or inferred approval. Signup is a strict resident/unapproved allowlist. Residents cannot change role/approval. Existing approved Admin/VIP approval/role management remains limited to canonical roles; a manager cannot change their own role.

## Required migration/operational gates — no live reads or changes performed

1. Confirm actual databases and authorized community scope. Existing configurations target the default database; previously hosted web source/database differs and must be reviewed independently. Storage cross-service lookups explicitly target `(default)`, so do not apply this proposal to a named-database deployment without a separate compatible design.
2. Separately authorize a minimal metadata inventory and reviewed backfill. `security/plan-published-record-backfill.mjs` plans **only** `storageDraft:false` marker patches for explicitly reviewed published WorkOrder/social records with update-time preconditions; it never publishes drafts. Without this backfill new filtered queries hide historical records. No changes to ticket numbering/counters are part of a backfill. Conflicting legacy owner aliases must be reviewed before marking records published; new publications require all supplied UID aliases to agree.
3. Deploy/populate/verify the directory through the trusted `syncResidentDirectory` implementation after approval. `functions/tools/planResidentDirectory.cjs` is offline-only. Empty directory prevents friend selection/Marketplace seller validation. Ambiguous legacy roles or missing explicit approval require office review; never infer elevated roles.
4. H1 legacy friend membership requires trusted exact UID mapping plus `identityVersion:2`; email-only office/maintenance ownership needs authoritative UID mapping. `INBOX_MIGRATION.md` describes the hold. Do not stamp the marker on unchecked participant arrays, rewrite historical messages, or guess from names/sanitized aliases. This migration remains separately authorized work.
5. Review Storage object linkage via `security/plan-workorder-storage-migration.mjs`. Orphans/ambiguities stop the plan. Verify authenticated reads and web Storage CORS, including download/save paths, before changing live readers or revoking old tokens. Existing download tokens are bearer capabilities and **are not invalidated by Storage Rules**. Token revocation and public bucket/IAM access checks require separate approval; current social/newsletter bearer links also require an explicit privacy/delivery decision before claiming all files are private. Previously copied profile/contact/media data cannot be recalled from old clients.
6. Existing Social/service records may already embed private addresses/email/phone. New Social writes omit these, but this batch does not erase historical snapshots. Review any minimization/retention cleanup separately.

## Coordinated release, only after approval

- Review source scope and migration plans; confirm hosted-web baseline and runtime/channel cohorts. No push/build/OTA/rules/functions/hosting action is authorized by these files.
- Prepare matching indexes and trusted directory trigger/backfill plus reviewed metadata migrations first; validate aggregate results without exposing resident data.
- Coordinate web + all supported native runtime/channel clients with the combined Firestore and Storage rules. Old clients use incompatible full-directory queries, history-rewriting receipts and unlinked uploads; Preview OTA cannot reach Production or mismatched runtimes. Do not deliver the new clients alone before required backfills/rules: upload drafts and private-profile permissions need the matching implementation.
- A controlled maintenance/cutover window or staged temporary **restrictive** policy may be necessary. Deploy only the reviewed combined rule set, not unrelated historical proposals/functions; validate authorized actions and denied attacks with consent.
- Recover by disabling affected writes or using a reviewed restrictive policy and fixing forward. Never restore public chats/files, unrestricted profiles, mutable messages or alias-based privileges. Never clear or recreate resident data as a recovery action.

## Focused verification

`security/batch/batch.rules.test.mjs` uses only loopback Firestore emulator REST and mocked auth claims; it refuses non-loopback hosts. No Firebase accounts or live data are involved. Additional offline tests cover projection, canonical roles, Inbox backend policy, Social publication, and migration/URL handling. C1's completed 51 assertions were not rerun. Storage authorization proposal has focused source/link/planner checks; real authenticated Storage/CORS/IAM/device verification remains a release gate.

Native TypeScript passes. Full web TypeScript still reports pre-existing ErrorBoundary, newsletter and weather typing issues outside this batch; changed security/client files have no reported type errors. No native dependency/configuration changes were added: client changes are OTA-compatible within each matching runtime, with separate backend/rules/index/migration work. No new APK is required by this batch itself.
