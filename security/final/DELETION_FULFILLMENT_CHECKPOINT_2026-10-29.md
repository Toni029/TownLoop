# Deletion fulfillment checkpoint — October 29, 2026

Processing remains disabled and no deletion backend is deployed by this checkpoint.
Approval continues to authorize review only, never account erasure. No resident content
was read or changed. Only live rules/function metadata was checked; no backup, token,
Hosting, security-rule or named-database change was made.

## Verified activation blocker

At 2026-10-30 01:16 UTC the named website database still served rules SHA-256
`29ea681048a0218295555da03caf21c0d8e625a722347e808feeb92cc101fdc0`.
This is the known anonymous-write configuration rejected by `writeFreezeReady`.
The default rules hash was
`1a3ee06055fe330fd7a69f399e84125be892e623de6b02dccf4b6527b6aa1859`.
Function metadata contained no scoped deletion worker or processing-authorization callable.

Disabling Firebase Auth cannot stop anonymous website writes. The next security prerequisite
is a compatible named-site client/rules rollout that authenticates every protected write and
rejects disabled/deletion-pending accounts, with both database rule sets tested. Do not replace
website rules blindly, bypass a scope, or use policy booleans as deployment evidence.

## Safe corrections implemented

- Existing two-scope leased processing is reused. Each database must emit a current inventory-
  version completion receipt before shared Firebase Auth can be deleted. Old receipts cannot
  skip newly introduced collection coverage; resumed old scopes rerun bounded inventory.
- Inventory now includes Inbox v3 conversation/member records, nested messages and membership
  visibility epochs, legacy authorization/media/hold records and per-account notification state.
  UID-bearing legacy conversation paths require explicit review/relocation. Other residents'
  records are preserved. These are coverage checks, not authorization to guess ownership.
- Owned notification events/read state have an explicit exact-UID deletion plan. New Inbox
  schemas with references are held as `category_specific_redaction_required`: a tested adapter
  coordinating membership, visibility, legacy projections and shared attachments is still needed.
  Such requests cannot be certified complete. Nested pagination uses full document paths.
- Reported source records and their attachments are held before mutation or media scheduling.
  Moderation records are preserved rather than stripped automatically. Current reports point to
  live source content; they do not provide independent evidence snapshots. A documented evidence
  disposition, necessary fields, authorized access and finite expiry must precede disposal. No
  automatic 400-day exception or indefinite legal-retention claim is introduced.
- Public status responses allowlist safe processing stage/error labels, excluding exception
  strings, paths and identity details. Preview status wording explains approval is not deletion,
  failures need recovery and retained receipts mean processing is not fully complete. Older
  deployed review responses remain supported without new backend dependencies.

## Required before operational activation

1. Resolve and verify named-site authenticated writes without breaking the hosted website.
2. Complete/verify the Inbox v3 deletion adapter and legacy UID-path relocation. Resolve exact
   per-request ownership/media exceptions; all six quarantine attachments remain excluded.
3. Document reported-evidence dispositions and expiry; preserve others' information and legally
   justified evidence. Unknown cases pause for human review, not endless automatic retries.
4. Verify per-account dry-run coverage in both databases, exact Storage generation/provenance,
   cleanup-proof enrollment and required media executor dependencies. Keep unknown links held.
5. Only after those gates, deploy isolated operations/cleanup-proof, reviewed worker/media
   packages and indexes, initially disabled. Confirm hashes and authorization with fixtures.
   Then authorize a bounded independently approved request. No such activation occurs here.

The native status changes are JavaScript-only and tolerate the currently deployed review API.
Pushing prepared backend code or publishing that UI does not deploy or enable deletion.
The ordinary 60-day maximum and existing backups remain unchanged. Unresolved preservation
is a blocker needing timely case resolution, not permission for open-ended retention.
