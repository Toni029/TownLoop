# Additional operating cost — USD/month, checked November 13, 2026

Planning estimate, not measured billing or a spending cap. Existing TownLoop traffic,
Gemini, resident media storage and existing workers are excluded. Use existing Blaze
project; do not upgrade Auth, activate backups, enable paid messaging or change billing.
Shared billing-account free allowances may already be consumed. Default Firestore is
nam5 in the existing release snapshot; confirm location/SKUs at provisioning.

## Low-usage assumptions

20 new registrations, 100 post/listing deletions/edits and 200 candidate objects/month;
up to 2,500 reference documents scanned per candidate; <=20,000 vCPU-seconds and
5,000 GiB-seconds monthly for all new functions; minInstances=0, memory256MiB.
Orphan enumeration runs hourly, 100 objects/folder/page, two folders. That is up to
144,000 object metadata GETs/month if a large folder is continuously present, not just
one request per orphan. Add linked-object discovery (up to 20 pages/job), recovery
checks and retained-item retries. Assume <=500,000 metadata/list operations/month,
<=2 million incremental Firestore reads, <=100,000 writes and <=10,000 deletes.
These conservative allowances include new shared-guard reads; actual existing writer
volume can exceed them. Queue triggers run on ALL writes to the two collections,
including likes/comments, not only deletions.

## Rates and allowance

| Component | Conservative incremental allowance, free tiers already consumed |
|---|---|
| Three Scheduler jobs | $0.30/month total ($0.10/job); paused jobs are still billable. Up to three free per billing account, shared with existing jobs. |
| One automatically replicated HMAC version | $0.06/month + $0.03/10,000 accesses. Six versions and 10,000 accesses free across billing account when available. Disabled versions also cost storage. |
| Firestore nam5 example rates | 2M reads × $0.06/100k = $1.20; 100k writes × $0.18/100k = $0.18; 10k deletes × $0.02/100k = $0.002. Add index-entry reads and stored indexes. |
| Request-billed compute | 20k vCPU-sec × $0.000024 + 5k GiB-sec × $0.0000025 ≈ $0.49, plus $0.40/million requests. Free allowances shared; no always-on instance charge. |
| Storage metadata/list/recovery | Allow $1–$3 at this small operation volume; exact bucket location/class/SKUs must be confirmed. Soft-deleted bytes stay billed for existing seven-day recovery. |
| Eventarc/Pub/Sub, logs, image registry | Allow $0–$1/month low usage; Google-source Eventarc events have no Eventarc event fee, but transport/compute/logging can be billed. Deployment build/image storage is additional and not a fixed runtime fee. |

**Budget $2–$7/month additional under these assumptions; $10/month planning allowance.**
Disabled infrastructure with schedules paused should generally be below $1/month,
plus image storage/deployment costs; no promise of $0. No per-service-account or
per-index fixed subscription; indexes consume billed Firestore storage/writes.
Free tiers can reduce the totals, but are not assumed in this budget.

## Spikes and operational controls

- 100,000 candidates × 2,500 references = 250M reads (~$150 at cited nam5 read rate)
  before retries. Retained/ambiguous jobs retry up to daily; unresolved inventory can
  keep costing money without deleting anything. Named-database reads may have no free quota.
- 100k seconds of compute adds ~$2.40 CPU + memory. One worker continuously busy for
  30 days at1vCPU/256MiB is roughly $64 before free tiers; maxInstances limits capacity,
  not total monthly spend. Timeout300sec does not impose a monthly spending cap.
- Large videos remain billed during soft-delete recovery. Bucket location/class,
  cross-region metadata/Firestore traffic, class-A discovery and old retained jobs can
  exceed the low-usage allowance. Immutable generation deletion does not save money
  until recovery copies expire.
- Initial approved activation should be a small disposable cohort, then inspect billed
  read/operation counts once. Recommend separate approval for $5/$10/$25 incremental
  budget alerts and a runbook pause; alerts do not cap costs. Do not automatically
  disable a worker while an uncertain deletion fence requires reconciliation.

Sources:
- https://cloud.google.com/scheduler/pricing
- https://cloud.google.com/secret-manager/pricing
- https://firebase.google.com/docs/firestore/billing-example (nam5 example)
- https://cloud.google.com/firestore/pricing
- https://cloud.google.com/run/pricing
- https://cloud.google.com/storage/pricing
- https://cloud.google.com/eventarc/pricing
