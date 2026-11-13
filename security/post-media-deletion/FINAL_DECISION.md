# Focused final decision — November 13, 2026

No production write, deployment, receipt acknowledgment, worker resumption, OTA or build.

## Media: NO-GO under the requested narrow change

The new emulator regression uses the exact live-baseline default rules. After creating
an existing per-record deletion tombstone, a different authorized Marketplace listing
and Discussion post can still acquire that file's URL. Both updates succeed (HTTP200).
Storage generation checks do not detect this Firestore reference change. A job lease
only serializes cleanup workers, not those other reference writers.

A guard on the source record alone cannot close the race. Every path that can establish
a reference must honor the guard: other social documents, private-chat text/attachments,
moderation evidence and privileged writers. A deletion-only change cannot enforce that.
Implementing universal reference registration/guarding would exceed this task and touch
areas expressly excluded. No such architecture, global freeze, scheduler or identity
was added. Keep the media flag off and retain files; do not represent the synthetic
protected-critical-section test callback as a production solution.

## Account deletion: receipt correction is appropriate, subject to separate approval

Fresh cloud evidence: final-readonly-verification.json. Worker00005-kux and immutable
source generation1793908084666775 match the prior source-verified deployment receipt.
Current rules all match the verified worker's expected hashes:

| Scope | Expected worker hash = deployed hash |
|---|---|
| Default | 4d1c449fc847c8273efdee3b813d16a1e996dd0fdfc766e3cfb09c4ace8eb6d0 |
| Secured named database | 8493ef2624b905208328f9ac7116dfe59e8349b1d24a8c3aa0883ceabd0da02d |
| Storage | 9aac5f82b7e31fef034b92340714136ec943232de88b1a0076c001331958c3e9 |

Only the account receipt's named hash remains224a64b96335d0b4b4e3d6ab72e12d8d640ae46d2b0aca0654741d7dc156e7e2.
Default receipt matches; Storage policy hash and trusted-cutover release time match.
Policy retains60 calendar days in America/New_York and65-minute token drain.
No code/rules/retention change is required to correct that stale acknowledgment.

The complete job inventory contains exactly2 jobs, both approved/previously authorized,
retention_pending/scoped_retention. Both have independent, matching approval audits,
currently approved Admin/VIP reviewers, zero recorded preflight holds and both exact
Firestore completion proofs. Direct Auth lookup confirms both identities already absent.
Their retained data/receipts expire no earlier than:
- December27,2026 at12:54:56 PM America/New_York.
- December29,2026 at2:36:59 PM America/New_York.

No other account-deletion jobs/candidates were present at this snapshot. This is not a
promise about requests submitted afterward; repeat the narrow inventory check before
an approved correction. The60-day rule protects retained records, not an already-erased
Auth identity. Existing evidence/legal exceptions still stop processing; no hold is
removed or retention deadline shortened by updating the one hash.

All three account flags are alreadytrue and the five-minute schedule is ENABLED.
Acknowledgment can resume reconciliation on the next tick, including late-media checks;
it does not mean no writes will occur before the retention dates. Final retention
expiry remains gated by the original deadline. This is therefore a separate production
resumption decision, not a harmless UI/configuration edit.

## Exact approval needed

Authorize changing ONLY deletion_policies/account.scopeRuleHashes[namedDatabaseId]
from224a… to8493…, after fresh compare-and-set preflight and queue verification, thereby
allowing the existing approved worker to resume with all current safeguards intact.
The prepared correction JSON has not been applied. No media activation is recommended.

Verification:22 focused unit checks and4 Auth/Firestore emulator checks passed. The
new emulator test proves the per-record limitation against unchanged live-baseline
rules. No application/runtime code was changed in this verification pass. Storage
removal remains synthetic in unit tests; no production deletion was attempted.
