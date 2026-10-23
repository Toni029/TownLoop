# C2 Android regression fix — prepared, NOT activated

## Upload-denial evidence

The existing Android transfer calls Firebase Storage's authenticated resumable endpoint
for `marketplace/<generated-file>`, `feed/<generated-file>` and
`work_orders/<generated-file>`, with version-1 record linkage, actual Firebase UID and
an owner-only Firestore draft created before upload. No resident paths/content were read.

Read-only IAM inspection of `cc-livingcommunity-app` confirmed that the existing
Storage service agent has only `roles/firebasestorage.serviceAgent`, which does not
include `datastore.entities.get`. It lacks
`roles/firebaserules.firestoreServiceAgent`, required for the deployed Storage rules'
`firestore.get/exists` calls. This fails the authorization lookup even for legitimate
owners. Local Firebase CLI source `RulesDeploy.checkStorageRulesIamPermissions`
returns immediately in non-interactive mode; the prior deployment used that mode.
The earlier emulator tests could not reveal missing production IAM.

`repair-upload-authorization.mjs` is read-only by default and exits nonzero while the
role is absent. After explicit owner approval, `--apply --approve cc-livingcommunity-app`
adds ONLY that role to the existing Storage service agent, preserving all other IAM
bindings/conditions and using the policy etag. It creates no account, uploads no media,
and changes neither Storage/Firestore rules nor the authorization bridge. No IAM grant
has been applied in this fix preparation.

## Locked photo-first form

A controlled regression test through the real CreateEditor -> pickAndUpload path
reproduced indefinitely busy, disabled controls when `ensureMediaDraft` never settles.
There is no title/description validation in photo selection; required text is checked
on publish. The exact physical-device trigger for a stalled request cannot be observed
without device diagnostics; a UI-thread crash/animation loop was not reproduced.

Draft preparation now has a 20-second deadline. Social text fields remain editable
while media uploads. Pending selected assets remain visible on error and can be retried
without reopening the picker or removed locally. Publishing cannot accidentally attach
local file URLs. Each successful attachment is retained immediately, so later failures
do not discard earlier successes. A completed transfer whose download-link lookup fails
is remembered per asset/account/parent for link-only retry rather than another upload.
Timeout does not cancel a late Firestore draft commit; it may leave an owner-only hidden
draft, never a published incomplete post. Existing cleanup remains inactive.

## Focused verification

- Read-only production prerequisite check: FAIL, missing role (expected until approval).
- 20 focused native transport/photo-first/retry tests: PASS.
- Two IAM repair/explicit-approval tests: PASS.
- Native TypeScript check: PASS.
- One focused Firestore+Storage emulator integration: PASS, all four canonical approved
  roles, all three upload folders, blank-content drafts, authorized reads, unauthorized
  upload denial, immutable objects, historical-unlinked denial and unchanged hosted-web
  protocol. Synthetic emulator authentication only; no Firebase accounts created.
- Standards/spec review: findings resolved; no blocking findings remain.
- No real phone upload, resident-file read, Firebase deployment, Hosting change, cleanup,
  GitHub push, OTA publication or APK build performed.

## Smallest safe release sequence (requires owner approval)

1. Apply the single Storage-service-agent IAM role prerequisite using the checked script.
2. Check that prerequisite and one owner-performed Android upload (existing client code
   already supplies valid metadata); stop if it remains denied. Do not relax rules.
3. Push the reviewed client checkpoint and publish its compatible Preview OTA for the
   bounded wait and retained-selection/retry fixes. Verify photo-first usage on the phone.

No native dependency/config change; OTA is sufficient. No new APK, rule deployment,
backend function deployment, named-database change or Production release is required.
The six quarantined files, their tokens and cleanup exclusions remain unchanged.
