# C2 execution gate — prepared, NOT deployed

Target: `cc-livingcommunity-app`, existing `cc-livingcommunity-app.firebasestorage.app` bucket. No file bytes, object names, tokens, Auth users, resident documents, Hosting or cleanup workers are changed by this preparation.

## Completed metadata check

25 objects checked; 10 Work Order attachments lack linkage. **4 unique default-database parent references are proven; 6 have no top-level parent proof.** The named database has no Work Order reference records. Three named-database profile UIDs also exist in the default database; their named approvals are pending, so no approval is inferred from that database. Names, phone numbers, addresses, message/comment bodies and photo bytes were not requested. Private snapshot/plan are outside Git, mode 0600. The manifest digest binds the exact reviewed plan. URLs in generated plans are converted to token-free object identities.

The six objects may be unused or referenced in embedded resolution comments. They are NOT declared orphaned or deleted. Firestore cannot safely flatten arbitrary embedded comment arrays through our existing field projection. Resolving those six requires separate approval for a bounded in-memory attachment-URL extraction from comment/revision arrays (no text displayed or retained), or an owner-provided attachment-only reference export. Do not activate strict historical Work Order reads while needed links remain unresolved.

## Minimal coexistence implementation

Storage Rules can read only default Firestore, with at most two document lookups. Native version-1 uploads/readers retain their default-profile plus immutable-parent authorization. The unchanged hosted client cannot supply parent IDs, so its legacy upload format has a separate create-only path: authenticated approval, exact uploader UID, allowed folder/type and 25 MiB bound. Overwrites are explicitly denied. A current default profile is authoritative for overlapping UIDs, including immediate pending/revoked denial. Named-only approvals are projected by the single new `syncHostedStorageMembership` trigger to the server-only default document `storage_web_authorization/policy`; no profiles/accounts are copied or modified.

The policy is denied to all Firestore clients by the already-deployed catch-all rule. The trigger reads role/approval/deletion flags only and preserves the global cutover. Source read timestamps prevent stale retry events overwriting newer projection states. This projection is asynchronous; named-only revocations depend on healthy trigger delivery, so monitor its retries. Source named-role/approval authorization is hash-pinned; any drift stops activation.

Legacy owner reads trust uploadedBy ONLY for objects created AFTER the strict-rule cutover. Historical publicly writable uploadedBy is never identity proof. Initialize compatibility only after strict rules are published, with a server timestamp; until then old-format web uploads fail closed. Newsletter authorization uses canonical native or projected web Admin/VIP, never the descriptive uploader name. No web bundle/database switch is required. A brief legacy-upload maintenance interval during cutover is expected; keep forms/drafts for retry.

## One scoped execution approval, after references are resolved

1. Approve attachment-only extraction for the six unresolved objects; replan from complete references, holding ambiguous matches. No photos or message text are displayed/persisted. Alternatively supply that reference export. Existing offline planner rejects guessed/ambiguous parents.
2. Approve metadata-only linkage writes for proven objects. `apply-backfill.mjs PRIVATE_PLAN --apply --approve PLAN_SHA256 --receipt PRIVATE_RECEIPT` uses an existing operator OAuth access token in `TOWNLOOP_METADATA_ACCESS_TOKEN`, never in arguments/logs. Use the approved cutover window to pause attachment/parent edits while applying. Firestore and Storage have no shared transaction: a failed post-write parent check may occur AFTER a metadata patch; stop, reconcile partial successes and replan—never assume a failed run wrote nothing. Both parent updateTime and object generation/metageneration are checked; patch merges all existing metadata, preserves tokens, and replay is a no-op. Partial approval requires explicit `--approved-partial`; six held objects block full cutover. No media bytes are fetched or written.
3. Deploy ONLY `functions:work-order-retention:syncHostedStorageMembership` using `firebase.release-backend.json`. Do not deploy all functions or any cleanup worker. Confirm the named-database trigger is ACTIVE.
4. Once the linkage receipt has zero held records (or separately reviewed disposition), deploy ONLY Storage using `security/c2/firebase.c2.json`. Preserve all Firestore/Hosting/named-database rules. Standard Firebase Storage-to-default-Firestore lookup permission must be enabled if not already present; no broad operator IAM expansion.
5. `activate-web-access.mjs --activate --approve PLAN_SHA256 --receipt PRIVATE_RECEIPT` verifies the deployed Storage source, named authorization rules and bridge health before creating the server-only policy with a trusted server cutover timestamp. It changes no source profiles. It never resets an existing cutover. If an upload starts before activation, fail closed and retry after activation.
6. One focused post-deployment rule/endpoint check; no real uploads/deletions without separate consent. Prefer fix-forward or read-only restricted recovery, never restore public access.

## Existing URL limitation

Existing token URLs remain bearer capabilities. Securing Storage SDK access and preventing anonymous uploads does **not** revoke those URLs. The current task explicitly excludes token revocation; do not claim every old link is private. Backfill preserves every token/URL and all bytes. C2 does not activate account deletion, orphan cleanup or media retention.

## Local verification

Focused planner/apply tests cover unique/missing/conflicting parents, idempotency, preserved tokens/metadata, parent/object preconditions and canonical web roles. Storage+Firestore loopback tests cover native owner/Crew access, denied strangers/anonymous uploads/overwrites, named-only legacy upload/own read, pre-cutover forged uploader denial, manager-only PDFs and revocation priority. Only synthetic data is used; no Firebase Authentication accounts are created. No APK or website build is needed.
