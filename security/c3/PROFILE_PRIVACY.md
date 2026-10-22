# C3 private profiles and trusted directory projection — local preparation

`users/{uid}` remains private. An authenticated resident can retrieve their own complete profile, including while awaiting approval; only approved canonical Admin/VIP accounts can list or retrieve other private profiles for approval and profile review. Crew uses the safe directory and the existing work-order/service conversation documents for assigned operational information. Crew does not need DOB, marital status or third-party emergency contacts. No client can write directory projections.

`resident_directory/{uid}` contains exactly `uid`, `name`, `avatarUrl`, `role`, `approved: true`. It contains no email, phone, address/unit/wing, birth date, marital status, emergency contacts, pending changes, privilege aliases or approval metadata. Canonical roles are exactly `resident`, `crew`, `vip`, `admin`; explicit boolean `approved === true` is required. Unknown legacy roles, `staff`, role aliases and nonboolean approval values are excluded and require manual review, never automatic elevation. Directory search/contact fields unavailable in this projection are intentionally blank for residents and Crew. Admin/VIP account management still reads private profiles.

The trusted `syncResidentDirectory` trigger processes `users/{uid}` writes. It reads the current source in a transaction, then replaces the complete projection or deletes it. Trigger delivery order therefore cannot replay an old approved event after revocation/deletion. Replacement also removes any accidentally existing extra projection fields. Firebase's asynchronous trigger means projection appearance/removal is eventually consistent; caller approval is checked independently by rules. Existing social post and service thread snapshots are separate data with their own rules and retention; this change does not erase prior disclosures from those records or previously downloaded client data.

Both clients retain own-profile UID reads. Cross-user email lookup fallbacks were removed: missing UID profiles require office remediation rather than a private-profile directory scan. Marketplace seller validation now reads the trusted directory inside its existing transaction. Native social always reads the projection; native profile and the web directory subscriber read private users only for approved Admin/VIP workflows. Web directory state is no longer persisted in localStorage and the prior `portal_community_directory_users` cache is removed on mount.

## Offline migration preparation

No live data was accessed. The planner accepts only an explicit locally supplied authorized JSON export:

```json
{"users":[{"id":"canonical-auth-uid","data":{"name":"Synthetic resident","role":"resident","approved":true}}],"directoryIds":[]}
```

`users` must represent the reviewed complete source snapshot. Optional `directoryIds` is the complete existing projection ID export, needed to plan removal of orphan projections. The planner does not fetch either export, open credentials, import Firebase or apply any write:

```sh
node functions/tools/planResidentDirectory.cjs --input /secure/authorized-export.json
node functions/tools/planResidentDirectory.cjs --input /secure/authorized-export.json --output /secure/reviewed-plan.json
```

The default reports counts only. Explicit output writes a new file with mode 0600, refuses overwriting, and contains only safe projected values, deletion paths and manual-review IDs. Source exports remain sensitive. This plan is a review artifact, not an executable live migration; a later separately authorized trusted backfill must re-read current sources transactionally through `syncDirectoryProfile`, rather than blindly replaying stale projected values. Reconcile all exported IDs and orphan IDs, verify pending/legacy exclusion, and verify synthetic client access before changing production readers/rules.

## Deployment and release gates

Backend export wiring, trusted backfill, matching Firestore rules and both client releases must be coordinated under separate deployment authorization. No deploy, Auth changes, push, OTA or APK build was performed. An empty projection before backfill produces an empty resident/Crew directory, and marketplace inquiries need the seller projection; do not release readers without populating and verifying the projection.

Both checked-in client configs use `(default)`. Web `VITE_FIREBASE_DATABASE_ID` can override this. The trigger uses `TOWNLOOP_FIRESTORE_DATABASE_ID` (default `(default)`) for both event source and Admin reads/writes. Confirm actual released web/native database IDs and deploy the trigger/rules/backfill to each intended matching database; a default database trigger does not cover a named database. Do not point clients at an unverified named database or silently assume they share data.

Verification: `node --test functions/profilePrivacy.test.cjs` tests field minimization, strict approval/roles, replacement/deletion and transactional current-source behavior, plus offline input validation and orphan cleanup planning. Root batch emulator checks enforce the resulting document access boundaries.
