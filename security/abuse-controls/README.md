# Durable request controls and private media transition

Local preparation, November 11, 2026. Continues the confirmed findings in
`security/release/SECURITY_GAPS_2026_11_11.md`; this is not another audit.
**Nothing here has been deployed or activated.** No production data, IAM, rules,
policy receipts, tokens, signing credentials or billable services were changed.

## Controls prepared

Shared policy: `functions/abusePolicy.cjs`. Counters live in the existing
`safety_limits/{uid}` document, survive instances/restarts, and use Firestore
transactions for concurrent callers. Existing reporting/block fields are retained.

| Operation | Rolling minute / day |
| --- | --- |
| Discussion posts | 10 / 100 |
| Marketplace listings | 10 / 50 |
| Comments | 60 / 1,000 |
| Messages | 120 / 5,000 |
| Marketplace inquiries | 20 / 200 |
| Work Orders | 10 / 100 |
| Drafts / edits | 40 / 500; 60 / 2,000 |
| Likes / order updates | 120 / 5,000; 60 / 2,000 |
| Media / newsletter PDF reservations | 40 / 500; 4 / 20 |
| Translations | 30 / 1,000 |
| Expensive Inbox reads / management | 60 / 5,000 |
| Administrative decisions / cleanup previews | 30 / 1,000; 12 / 1,000 |

Analysis allows 12 new job generations per **10 minutes**, 60 per day.
Explicit retries of failed jobs count, retaining successful checkpoints; duplicate
active/completed requests and bounded automatic task retries do not spend another
generation. Media and PDF reservations each additionally cap admitted bytes at
1 GiB/day per user. These are abuse budgets, not project-wide billing hard caps.
Provider quotas, billing alerts and global spend controls remain separate approved
configuration work.

Actual message creation and administrative decisions charge atomically with the
authorized mutation; duplicate/idempotent sends and decisions are free. Read
receipts and leaving conversations remain available. No account-deletion worker,
retention policy or destructive cleanup engine is changed.

`src/security/abuseBudget.ts` pairs existing authorized client writes with their
quota update in the same transaction. Candidate Rules independently validate the
counter, server time, action and target, including direct SDK/REST attempts. One
counter proof cannot authorize several records. Server-controlled uploads, AI and
administrative counters cannot be edited by clients. Old clients are deliberately
not blocked until a separately approved coordinated enforcement cutover.

Safe errors report request limits and retry guidance without exposing resident
data or credentials. Network failures fail before the data write. Upload retry
tickets bind the same file/path/metadata and are not charged again while valid.

## Upload and private-file safeguards

`issueMediaUpload` verifies current identity, approval, revocation, parent ownership
or staff authorization, file size/type and exact category path. It creates a
server-owned reservation and projects it onto the parent. The Storage candidate
needs only its supported two cross-service reads: canonical profile and parent.
Generation binding prevents replay after a parent is deleted/recreated. The
trusted `completeMediaUpload` finalizer validates the actual object and consumes
the receipt, removing its parent projection without resurrecting deleted parents.
Strict Storage Rules forbid overwrites and delete/recreate replay of an issued
ticket. Shared/other-category paths cannot borrow another reservation.

`issueNewsletterUpload` independently verifies Admin/VIP, owner and size, preserving
the existing fast Firestore PDF transport, hashes, chunks and original bytes.
Complete retained uploads can still be reused without transfer or rewind.

Private images/video use current authenticated Storage reads to an account-scoped
temporary original-byte file/blob. Owned Firebase bearer URLs normalize to these
reads; denial never falls back to the public token URL. Close/account/token changes
cancel stale resolution and clean up temporary files. Access still depends on the
existing resource Rules. Historical Inbox attachments without trustworthy
membership/epoch mapping fail closed; no membership is invented.

**Readers-first transition:** proposed `tokenFreeMedia:false` intentionally keeps
existing feed/Marketplace upload reference behavior compatible with older video
players. After reader adoption is verified, separately enable token-free references
for new uploads. Work Order storage references remain compatible. Existing files
are not rewritten or deleted. Already copied bearer links remain usable outside
the app until a separately approved inventory/retirement/token-rotation operation;
already downloaded bytes cannot be recalled. This limitation is not eliminated by
the new reader. No production token rotation is included.

## App Check monitoring preparation

See `native/modules/townloop-app-check/README.md`. The optional local Android Expo
module supplies genuine Play Integrity tokens to the existing Firebase JS SDK and
custom authenticated transports. Enforcement remains **OFF**. Old binaries, iOS,
offline/attestation failures retain monitoring-compatible behavior. No debug
provider, fabricated successful token or client secret is introduced. Refresh is
foreground-only; the native provider does not run a duplicate refresh loop.

A **new AAB in the next planned native release** is required. Autolinking and JS
behavior are locally checked; Gradle compilation, Play signing SHA-256 association,
Play Integrity linkage, metrics and actual phone attestation still require approved
build/configuration/device verification. An OTA cannot supply this native module.

## Future coordinated deployment — approval required

1. Read-only preflight: verify project `cc-livingcommunity-app`, region `us-central1`,
   current rules/worker hashes and actual deployed function codebase ownership.
   Do not guess labels or use a blanket Functions deploy. Retain safe rollback
   artifacts; never restore permissive legacy named-database rules.
2. Deploy only required request-control backend changes: `manageInboxConversation`,
   `translateWorkOrder`, `reviewAccountDeletionRequest`, `issueMediaUpload`,
   `completeMediaUpload`, `issueNewsletterUpload`, and `newsletterApi`.
   Existing `runNewsletterAnalysis` task implementation, extraction prompts,
   notification triggers and destructive workers are unchanged.
3. Cleanup preview needs the separate quota gateway and private read-only inventory
   described in `functions/databaseCleanupQuotaGateway.IAM.md`. Keep the inventory
   identity read-only. Provision the dedicated gateway identity only with approval;
   deploy `readOnlyDatabaseCleanupInventory` privately, verify actual Cloud Run URI
   and invoker IAM, then replace public `previewDatabaseCleanup` with the gateway.
   No alternate public inventory alias may bypass quota. Neither creates purge jobs.
4. Coordinate candidate native `(default)` Firestore and compatible Storage Rules,
   plus `control.PROPOSED.json`, with adopting clients. **These future rules change
   the hashes checked by account-deletion safeguards.** Separately prepare/approve
   matching compatibility and receipts before deployment; this task does not
   acknowledge receipts, pause/resume workers or authorize deletions. Named legacy
   rules remain unchanged. Root/live rule files were not edited.
5. Release adopting readers and the next planned App Check AAB. Verify old Preview
   and Play clients, uploads, account switching and revoked access. Monitor App
   Check before considering enforcement; no enforcement approval is implied.
6. Only after adoption and compatibility checks, separately approve `enforceWrites`,
   required media reservations, strict Storage Rules and `tokenFreeMedia` cutover.
   Otherwise old writers would be rejected. Never weaken membership/role checks to
   accommodate obsolete clients. Keep safely compatible rollback controls.

`prepare.cjs` produces local scoped artifacts only, with no deployment config or
schedules. Existing packagers include shared quota modules. Exact deployment
codebase ownership and least IAM must be verified before later release. The direct
`google-auth-library` declaration promotes the already locked 10.9.1; no dependency
installation or tree upgrade was performed.

## Verification and limits

Focused synthetic tests cover concurrent instances, persistent quotas, atomic
client proofs, idempotency, safe errors, upload reservations, revoked media access,
retained PDFs, analysis generations/checkpoints, App Check failure/lifecycle paths,
and private inventory gateway separation. Paired **real local Firestore/Storage
emulators** pass 16 synthetic allowed/denied scenarios, including direct bypass,
pending users, counter replay, normal Work Order numbering, PDF completion,
two-lookup Storage limits and upload replay. No live destructive test was run.

TypeScript and targeted lint are checked separately. Tests do not establish live
IAM, Play attestation, existing attachment token retirement or physical Samsung/
iPhone behavior. The installed app and production backend remain unchanged until
the separately approved coordinated release.
