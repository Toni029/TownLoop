# Step 2 worker compatibility — 2026-11-05

Owner approved only the matching `fulfillApprovedAccountDeletions` deployment.
The scoped update completed in `cc-livingcommunity-app`, `us-central1`, using
`firebase.deletion-processing-native-only.json` and the single-function filter.
No policy acknowledgment, resident operation, rules deployment or GitHub push occurred.

## Verified production state

- ACTIVE revision: `fulfillapprovedaccountdeletions-00005-kux` (previous
  `fulfillapprovedaccountdeletions-00004-cos`).
- Deployed source generation: `1793908084666775`. A read-only download of the
  deployed source archive matches all 19 prepared source/manifest/package files.
  The sole function export and entry match the reviewed package. No environment
  file is embedded in that archive.
- Worker named-rules pin matches the current deny-all release:
  `8493ef2624b905208328f9ac7116dfe59e8349b1d24a8c3aa0883ceabd0da02d`.
- Default and Storage rule release objects and hashes are unchanged. Both policy
  documents compare exactly unchanged, including their update times. The account
  receipt deliberately retains the old named hash `224a64...`.
- Runtime identity, environment, memory/CPU/concurrency, timeout, instance settings,
  ingress/network settings and endpoint are unchanged. The ENABLED every-five-minute
  UTC scheduler, target, OIDC identity and retry configuration are unchanged.
  Relevant runtime/Scheduler grants and Storage authorization metadata passed the
  preflight drift checks. No permission expansion was requested.
- `syncHostedStorageMembership`, `listAccountDeletionRequests` and
  `reviewAccountDeletionRequest` are ACTIVE with unchanged resource metadata.

The deployed entry compares both live rules and the policy receipt to its pins.
The receipt mismatch raises `deployed_rules_changed` before the runner queries jobs
or claims a lease. One focused local guard regression passed. This establishes an
intentional processing hold, not an operational deletion test. No handler was
invoked manually; no resident job or policy was written. Scheduled attempts remain
enabled and are expected to fail closed until a separate receipt approval.

## Read-only aggregate job inspection

Snapshot time: **2026-11-05T19:48:23.230462Z**. A projected, bounded query inspected
only workflow state/deadlines, discarding document identifiers. No resident names,
emails, UIDs, content or per-person timestamps are in this receipt.

- Total records: **2**; pending review: **0**; approved: **2**.
- Both are `retention_pending` / `scoped_retention`, already authorized, with an
  `identityDeletedAt` receipt. There are **0** approved initial-deletion jobs and
  **0** active candidate leases in this snapshot.
- Both are scheduler candidates, but both remain **before** the existing 60-day
  deadline computed from request creation; **0** are past it and **0** have an
  indeterminate deadline. This calculation reuses the worker's retention helper.

After acknowledgment, these two records can automatically be claimed for checks
and late-media reconciliation; expiry/finalization still waits for the existing
deadline and all safeguards. Future valid approved requests could also process
automatically. An acknowledgment is therefore a real activation step, not a
documentation-only change. Counts do not prove every job passes its separate
ownership, evidence, provenance and approval checks.

## Next approval

Compatibility prerequisites passed. It is technically ready to consider the final
named-hash acknowledgment, **only with explicit approval accepting automatic
approved processing** and a fresh narrow drift/queue check immediately beforehand.
Do not change flags, deadlines, retention, reviews, token waits or Storage policy.
If any new mismatch appears, keep the hold and named deny-all; never restore the
vulnerable rules. This deployment did not resume or complete any resident deletion.

Private snapshots/source archive are mode-restricted under the owner's local
`worker-compatibility-*` state directory. The companion JSON receipt contains only
sanitized configuration identities, hashes, aggregate counts and verification limits.
