# Operational deletion gates — October 26, 2026

Local checkpoint only; all processing/monitoring/expiry flags remain off. No new live scan,
record changes, migrations, backup changes, public policy publication or deployments.

## Exact navigation verified in source

- Resident: any main tab → profile-picture menu → **Account** → **Edit Profile** → scroll to
  **Request Account Deletion** → expand → password/reauthentication + type DELETE →
  **Confirm Deletion Request**. Status/Refresh request status is in that same component.
- Admin/VIP: profile-picture menu → **Admin Panel** → **Reports** tab → scroll below
  **Safety reports** → **Account deletion requests**. Refresh/Next requests and held decision
  confirmation are there. Self-review stays blocked in the UI and backend.
- No missing route or navigation rewrite was needed. This is source verification, not a new
  phone test. Backend five callables/review and resident status are already deployed; their
  working UI remains in Preview. The corrected cleanup completion is published as commit
  `b08c804`, Android OTA `01a17879-2787-73ab-809e-1509e8fb051e`, runtime
  `d6f09b9023171c8bdabd4a8e1da0b41223dff3b9`. Publication evidence comes from the completed
  release, not a new deployment or a claim that this device installed it.

## Cross-database safety added locally

`accountDeletionScope.cjs` classifies top-level canonical ownership and two-party membership
using **verified Auth UIDs only**, identically for both known databases. Aliases/names/emails,
conflicting owners and incomplete participants remain `needs_review`. A foreign parent may
still contain an owned comment; parent classification is NOT a certificate that shared content
contains no references. Continue using the existing schema-aware retention planner for those.
The prior aggregate exact-UID overlap establishes shared Auth scope, not per-account erasure proof.

The engine now stops before private-profile/token/Auth erasure unless trusted server-only
completion receipts cover **both** `(default)` and the known named website database, each for
that exact UID and approved policy reference, with valid completion time, completed inventory,
completed records, frozen writes and zero unresolved identities/media. A global policy checkbox
alone cannot bypass this. Six quarantined files remain preservation exceptions and are never
assigned to a resident by this classifier. Do not set proof counts to zero to hide unresolved work.

**Still blocked:** the current engine actually processes only default-database records. A trusted
named-database executor, supported schema coverage, exact per-account inventory and completion
receipt producer are not implemented/verified. The pure classifier and new guard do not replace
that executor. No receipts were manufactured from aggregate counts or client assertions. Shared
Firebase Auth deletion must wait. Completion-time receipts must represent actual verified work,
not a manually toggled policy flag. This checkpoint intentionally makes unsafe activation stop.
Do not retry `needs_review` by suppressing the named scope or weakening the guard.

## Offline cleanup and expiry

New focused SessionProvider fixture verifies offline launch preserves data and foreground
reconnection clears only a server-confirmed disabled account. Existing switched-account,
interrupted-retry and expired-token protections are reused. No physical-device proof or remote
offline erasure is claimed. If Auth disappears before authoritative proof reaches the client,
a finite cleanup-proof/reauthentication protocol is still needed; do not erase an active account
merely for being offline. Unknown historical browser/device cache ownership remains excluded.

A bounded alert-claim expiry helper is prepared under separate default-off
`TOWNLOOP_DELETION_ALERT_EXPIRY_ENABLED`, inside the separately disabled review monitor.
It touches only server-owned `deletion_review_deliveries` records with exact recognized fields,
hashed IDs, known states and valid maximum-60-day expiry. It rechecks each transaction, preserves
future/malformed records, and advances a cursor so malformed records cannot starve valid expiry.
No resident account, message, profile or photo is a target. Exact-time erasure is not guaranteed
by an hourly bounded worker; verify backlog/scheduling and handle malformed exceptions before
promising operational expiry. The helper is not deployed or activated. Existing job/review
receipt expiry stays in the inactive 60-day engine; no application 400-day retention is added.

## Admin escalation

Existing isolated monitor/dispatcher preserves 3-business-day review, 7-calendar-day escalation
and 7-day post-approval target. Automatic recipients: current approved Admin only, including
fresh Auth-disable/device-ownership checks. VIP keeps review permission, no automatic alerts.
Daily deterministic claims and durable request receipts prevent duplicate storms. No support
email is automatically subscribed. Remaining activation dependency: approved Admin device
registration/delivery verification and receipt-expiry operation. No reliable push delivery is
claimed merely because a prepared dispatcher exists.

## Business/legal decisions versus technical completion

- Owner supplied corrected contact **Seeds4Clix / support@seeds4Clix.com**. Drafts updated;
  spelling is no longer a blocker. Confirm that mailbox is monitored for privacy/deletion,
  staffed Admin coverage and an absence/escalation substitute; no arbitrary denial/indefinite hold.
- Approve final policy effective date, any legally required operator details (no address invented),
  provider processing disclosures, and accurate publication of actual fulfillment status.
- No specific legal requirement for 400-day TownLoop application retention was established.
  Existing fixed provider system-log retention remains an accurate disclosure/legal-review item,
  not an approved extension for application receipts, messages or photos.
- No new backup decision is requested: changes are deferred and existing settings are preserved.
  Document existing natural expiry and safe isolated restore handling.
- Technical work still required: named/default execution and receipts, finite offline proof,
  unresolved per-account embedded/media relationships, verified media cleanup/legacy reader
  compatibility, and Admin delivery/expiry checks. These cannot be solved by approving a flag.

## Exact later approvals — none executed here

1. After those technical safeguards are complete, approve a named/default **scoped fulfillment
   deployment**, with per-account dry-run evidence and workers still off. Then a separate bounded
   activation for independently approved verified requests; never a general destructive flag flip.
2. Separately approve isolated **Admin-only monitor deployment/activation and alert-claim expiry**
   after recipient delivery/expiry verification. No VIP or shared office notification destination.
3. Separately approve policy/public deletion-page publication after contact/effective-date/provider
   decisions and actual fulfillment readiness. Existing Hosting must not be replaced wholesale.
4. Legacy token retirement and any new native APK/Production release remain separate approvals.
   Existing bearer URLs and all six quarantined files remain unchanged.

## Focused verification

18 focused tests passed across exact-UID scope classification, the shared-Auth completion guard,
legacy/v2 retry phases, Admin monitoring/activation guards, isolated monitor packaging, operational
receipt expiry and SessionProvider offline/reconnect behavior. Native TypeScript passed.
Contact/inactive-policy assertions and diff checks passed. Only synthetic fixtures/local artifacts
were used; no resident data or actual deletion request was read or modified. Existing published
cleanup queue tests and Samsung picker acceptance were reused, not reopened.
