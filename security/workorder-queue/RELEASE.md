# Work Order queue correction — prepared locally

Not deployed. No resident records read or changed during implementation.

Crew/Admin/VIP order their already-authorized tickets by original createdAt, then exact document ID.
First pending ticket displays In Progress, following tickets Queued #1, #2, etc. Completed tickets are excluded.
Residents cannot infer the community queue from their private query. The prepared
getWorkOrderQueuePositions callable verifies nonrevoked Firebase Auth and an approved canonical role,
reads only queue metadata in (default), and returns only that caller's own IDs/positions.
It never reads ticket text/comments/photos or changes records. The metadata query has a hard 2,000-ticket bound;
exceeding it fails safely instead of returning incomplete numbering.

Required release order, separately approved:
1. Deploy ONLY getWorkOrderQueuePositions to cc-livingcommunity-app, us-central1. No workers, rules, Hosting,
   Storage, IAM expansion, named-database changes or other callables are part of this scope.
2. Verify authentication rejection and fixture authorization checks; no resident account creation required.
3. Publish the compatible Android Preview JS update. No new APK dependency.

Resident lookups refresh on Work Orders focus, changes to their pending-ticket set, app resume, and once per
minute while the screen is focused. Requests coalesce and stop in the background. Until the backend is available,
failed/unavailable lookup displays Queue position updating rather than falsely labeling the resident's first
private ticket In Progress. Staff computation works locally. Do not release the resident client dependency first.

Gallery dissolve and Inbox/Report layout changes are JS-only and independent of this callable.
