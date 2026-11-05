# Named website privacy repair — LOCAL, NOT DEPLOY READY

**Superseded rollout direction:** the owner has retired the original website.
Use `../native-only-firestore/README.md` for the named client-denial plan and
coordinated deletion-worker rules pin. Do not implement this folder's website
backport/grant provisioning just to retire the site. This candidate and its tests
remain historical local preparation, not deployed authorization.

Prepared against `9c0d5da`, exclusively for existing database
`ai-studio-cclivingv27-5fc1a0f6-cd75-4964-8c9e-e219a265f7bb` in
`cc-livingcommunity-app`. No default/native, Storage, Hosting, worker, notification,
policy or live resident records were changed. No deployment/migration/provisioning
was performed. The **live P0 exposure remains until an explicitly authorized rollout**.

## What is prepared

`firestore.named.rules` replaces only the named baseline's profile/private-record
boundaries, retains its deletion fence and unrelated community paths, and requires
approved canonical roles. Pending registrations can read only their own profile;
self-updates cannot set roles, approval, identity, flags or deletion markers. Approved
Admin/VIP retain target-account approval with immutable identity/fences and cannot
change their own role. Profile deletion is server-only. Legacy pending signup role
`''` and current `resident` remain unapproved; blank/alias roles never authorize access.
Optional consent fields must carry the existing version and server receipt; this
security repair does not declare the old hosted registration legally ready.

The public directory and exact-record mailboxes are server-written only. Their
producer must project allowlisted display fields / `{source,recordId}` respectively;
never copy whole user documents, contacts, messages or media into them. Client writes,
including Admin/VIP client writes, are denied. No projection was generated here.

Every formerly broadly writable private chat and Work Order requires a hidden
server-owned `legacy_record_authorizations/{source}/records/{recordId}` grant,
`status:'verified'`, exact `source`, `recordId`, and bound immutable `identity`:

- friend: `{participantIds:[exactUidA,exactUidB]}`; only those individually granted members;
- Marketplace: `{sellerId:exactUid,buyerId:exactUid}`; neither Admin nor VIP gains private access;
- Office/Maintenance: `{residentId:exactUid}` plus individually verified `memberIds`;
  current office/crew role is also required. Historical role-wide access is not proof;
- Work Orders: `{userId:exactUid}`; verified owner or current Crew/Admin/VIP queue access.

A trusted chat grant also carries server-reviewed `epoch` (1–32 URL-safe characters),
`historyLength`, complete `historicalMessageIds`, `memberIds`, reviewer/evidence
metadata; the record's server-set `authorizationEpoch` must match. Neither marker
alone nor client-owned identity fields establish membership. Unverified/changed
identities, missing grants, unknown memberships and missing epochs fail closed.
Former public writers may have tampered with identities **and message contents**.
A hash/UID consistency check cannot retrospectively authenticate that history.
Independent review must establish membership and preserve/hold uncertain evidence;
never manufacture grants from current client-writable fields, names or email aliases.

Clients can append exactly one new canonical-author message, with all prior messages
unchanged, or update only their own bounded `readBy`/`hiddenBy` watermark. Unread flags,
other readers' cursors, memberships, epochs and leave flags are immutable to clients.
New message IDs are `legacy_{epoch}_{authenticatedUid}_{priorMessageCount}`, checked
against the complete historical ID set; a separate stable `operationId` supports
acknowledgement-safe local retries. Historical-ID collisions are held, not rewritten.
Explicit `leftBy`, legacy service `sideLeft.resident/team`, Marketplace leave flags
and canonical role/approval loss revoke the applicable reader. Remaining parties
retain permitted history; sending toward a departed private/service counterpart is denied.
No chat deletion or client creation is allowed. Creation requires a reviewed named
server provisioner; there is no hidden fallback that grants history to new staff.

Work Order ownership/creation identity is immutable. Existing canonical Crew
completion, note/revision and manager-audited resolution handling reuse the **selected**
reviewed transition helpers, not native counters, storage drafts, database selection
or group schema. Ordinary owners cannot complete tickets or forge Crew notes. Client
creation/deletion remains disabled pending named provisioning/inventory integration.

`client.ts` is a small **unintegrated local backport adapter**, not a replacement site.
It explicitly selects the named database, loads the caller's canonical profile,
pages their server-owned mailbox, individually fetches attested records, appends
transactionally and records only the caller's read cursor. It rechecks account
switches and preserves history/retry acknowledgements. It cannot create grants,
new conversations or Work Orders, and it has not been published or device-tested.

## Exact original website compatibility

The public entry and the known original main bundle were downloaded as static bytes
only (never executed). Main bundle remains `/assets/index-C_3tBUcg.js`, SHA-256
`1dfd19fb7b3b4966a1595a18f0059c7263c4fa67dc69dd6886912b66ad5a55c5`,
matching the earlier Sept25 artifact. Exact source commit/build provenance is still
unavailable; `9a850f7` is a historical comparison, **not** identified deployed source.

| Operation | Original public bundle | Required coordinated backport / gate |
| --- | --- | --- |
| Database | Existing named database | Preserve exact named ID/origin; repository defaults to `(default)` and is not a drop-in site |
| Login/signup | Own UID lookup; fallback email query; pending blank-role signup | Own-UID reads remain; fallback email/full-profile queries must be removed; no auto-recreation of missing approved accounts |
| Resident directory | Full `users` subscription | Use reviewed server-owned public projection; manager-only private directory |
| Work Order list | Whole collection ordered by date | Use owner/staff exact authorized mailbox/individual reads; current repository owner queries alone do not satisfy attestation gating |
| Service Inbox | Email-derived record IDs, role-wide team queries | Preserve record IDs only after independent ownership review; exact mailbox IDs; individual reads; never parse an email-derived ID into ownership |
| Service send/read | Read-modify-write complete message arrays; Admin aliases as `vip`; shared unread flags | Canonical transaction adapter, epoch IDs, unchanged old history, own UID watermarks; requires recovered original source integration |
| Friend/Marketplace chats | No `resident_chats` / `marketplace_chats` references in this bundle; Message Seller was toast-only | Protect those named collections anyway; do not add a new website feature as a purported compatibility fix |
| Resolution/profile changes | Older unsigned comments/direct profile edits | Backport canonical Crew completion/proposal contracts or hold the affected action; no silent permission broadening |

Current repository web has canonical Inbox helpers, private/public directory split
and scoped Work Order queries, but uses default DB, newer UIs/protocols and different
service-worker caches. Building/publishing it would be a broader replacement, not
proof of original-site compatibility. Shared `src/` was deliberately left unchanged.

## Privileged rewrite / deletion prerequisite

**Do not provision ANY grant/mailbox or release client appends until this is implemented
and verified with the existing named deletion/redaction/restore workers.** Before
EVERY privileged history rewrite (including account deletion, media redaction,
retention, restoration or membership correction), atomically deattest/freeze the
grant (`status:'rewrite_hold'`) before changing bytes. Old epochs must never resume.
After the independent membership/evidence review, create a fresh unpredictable epoch,
reviewed complete current historical ID set/count, bound record marker and matching
mailbox; then explicitly re-enable. Failure/crash must leave the grant held. Restored
backups are isolated and deattested until reconciliation. Without this contract,
shrinking an append-only array could reuse a prior count/ID. Epoch rotation is a
requirement, not a claim current workers already implement it.

`legacy_record_authorizations` and `legacy_private_mailboxes` are NOT yet included in
the current deletion inventories, retention or completed-deletion reconciliation.
Integrate and test those scopes **before any provisioning**; preserve other members'
legitimate history, remove revoked identity references under the approved policy,
and keep ordinary receipt expiry. No new retention policy is invented here. The local
emulator's explicit privileged-rewrite fixture demonstrates only this required contract.

## Rollout after separate approval — not execution instructions for this task

1. Recover the exact original source/build records or explicitly approve a replacement
   scope. Review the minimal named backport, service worker/cache/origin preservation,
   `.well-known/assetlinks.json`, registration and affected forms. Resolve new private
   record provisioning and the worker/recovery/inventory contract above. Keep unsupported
   actions visibly held; never show a successful send before server acknowledgement.
2. Prepare an isolated named test environment and independently verified synthetic
   ownership/role fixtures; validate all four roles, pending users, historical aliases,
   failed sends, account changes, browser refresh/offline caches and every required
   original-site operation. Do not claim this emulator proves browser readiness.
3. Obtain scoped rules/Hosting/provisioning approval. Recheck current Rules API source
   hash equals manifest baseline `224a64...`; default must remain `4d1c449f...` and
   Storage `9aac5f82...`. On drift, stop/rebase/review. Run `node security/legacy-launch/check-scope.cjs`.
   **Never deploy root firebase.json or use an all-database/all-functions deployment.**
4. A separately authorized initial named-only write freeze may use the secure recovery
   candidate. Unknown history remains inaccessible. Stop writes BEFORE independent
   source/identity/hash review; server attestations must re-read current records
   transactionally after that freeze. No automatic migration/record guessing is prepared.
5. Under the approved bounded review scope, provision grants/projections transactionally
   only after policy/deletion/recovery integration. Publish the proven named backport
   without switching databases, removing site storage, importing cached history, or
   forcing an active resident form to reload. Retain unknown records in review.
6. Deploy only `firestore:rules` with this directory's `firebase.deploy.json` targeting
   the named database and explicit project. Verify published source hash, unchanged
   default/Storage releases and intended browser artifact before permitting writes.
   Use separately approved test accounts/fixtures; no live exploit/resident read probes.

Secure fallback: `firebase.readonly.json` selects `firestore.named.readonly.rules`
for **the same named database only**. It preserves attested/owner read boundaries and
deletion fences, denies **all client mutations**, and requires independently approved
application. Fix forward while writes are held. Never restore the vulnerable named
baseline, public/team-wide history reads, unrestricted profiles, arbitrary history
replacement, an old permissive site or native default rules. Backend writes and prior
leaks cannot be undone by a client/rules rollback; tokens/backups require their own scope.

## Verification

See `VERIFICATION.md` for exact red/green commands and results. `manifest.json` records
scope/source hashes and unresolved gates; `check-scope.cjs` is offline only. Both
production configs contain only the named rule entry: no default DB, Hosting,
Storage, functions or indexes. Current production remains vulnerable until a later
separately approved, coordinated release; these local artifacts do not close the live P0.
