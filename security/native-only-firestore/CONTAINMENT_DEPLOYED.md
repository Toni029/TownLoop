# Step 1 production containment — 2026-11-05

Owner authorized only the existing named-database client-denial rules. Deployment
completed using the named-only config and explicit project `cc-livingcommunity-app`.
No worker/policy transition, resident operation, Hosting, Storage, index, IAM,
notification, Gemini, OTA, binary build or GitHub publication was performed.

## Production evidence

- Exact target database:
  `ai-studio-cclivingv27-5fc1a0f6-cd75-4964-8c9e-e219a265f7bb`.
- Final preflight confirmed expected named/default/Storage hashes, correct project
  and existing named database, unchanged worker revision/source/env and old policy
  pins. The config contains only one named Firestore rules entry; Firebase CLI
  resolution was checked against that config directory before the deployment.
- Published named SHA-256:
  `8493ef2624b905208328f9ac7116dfe59e8349b1d24a8c3aa0883ceabd0da02d`.
  Release points to ruleset `b9930259-e74c-4438-8c50-facadabfd8a5`.
- Post-deploy Rules API fetch confirms the exact approved source. Provider-side
  evaluation of that fetched source passes **30/30 synthetic denial cases**:
  anonymous/pending/Resident/Crew/VIP/Admin contexts and get/list/create/update/delete.
  No runtime errors are accepted as successful denials. This uses the documented
  [Rules testing API](https://firebase.google.com/docs/reference/rules/rest/v1/projects/test)
  with synthetic contexts; it is not a real resident-token/device test.
- A separate actual anonymous Firestore REST read of a synthetic path returned
  **HTTP403**. No real write was attempted, no Auth user created and no resident
  record/message/media was fetched or modified. No test records were created.
- Default and Storage release objects are **byte-equivalent JSON values before and
  after**, with unchanged source hashes `4d1c449f...` and `9aac5f82...`. Worker and
  Storage-sync function resource metadata, both policy documents and scheduler
  configuration also compare unchanged. The Storage-sync function remains ACTIVE.

Firebase documents up to one minute for new query/listener enforcement and up to
ten minutes for existing active listeners to receive rules changes. Existing
device caches/prior disclosures are not remotely erased. See [Firebase deployment
propagation guidance](https://firebase.google.com/docs/firestore/security/get-started#deploying_rules).
No monitoring loop or real signed-in resident probe was performed.

## Account-deletion hold and next approval

The worker still pins named SHA `224a64...`, and the policy receipt still contains
that old pin. New worker invocations encounter `deployed_rules_changed` before
querying/processing deletion jobs. This is an intentional rules-hash hold, not a
worker deployment failure. Scheduler remains ENABLED; no job status was edited,
worker manually invoked, deletion resumed or request processed by this rollout.
Already in-flight authorized work is not cancelled by client rules; no claim that
the rules stop a running Admin SDK operation is made.

Remaining rollout is technically prepared but **not authorized by Step 1**:
deploy only the matching `fulfillApprovedAccountDeletions` package, verify its exact
target pin, then separately acknowledge only the named hash in the existing policy.
Those steps can let the previously active approved workflow continue and require
the owner's next explicit approval. Native default rules and Storage stay untouched.
For the next preflight, the expected deployed named hash is now `8493ef...` while
the expected worker/policy pin remains `224a64...`; do not report this intentional
split as unexpected drift or deploy optional unused recovery APIs to resolve it.

If later verification fails, retain named deny-all and leave processing held.
Never restore the vulnerable named baseline. Preserve all original retention,
membership, evidence and six-object quarantine safeguards.

Private before/after source, configuration and simulation snapshots are under the
owner's mode0700 `containment-step1-*` state directory, mode0600 files. The sanitized
tracked receipt contains exact hashes, release identity, scope and verification
limits. No credentials or resident payloads are committed.
