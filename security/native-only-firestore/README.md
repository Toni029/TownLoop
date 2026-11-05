# Native-only Firebase containment and dependency map — 2026-11-05

**Current state: Steps 1 and 2 deployed and verified on 2026-11-05.** The named
client-denial rules and matching worker both pin SHA-256
`8493ef2624b905208328f9ac7116dfe59e8349b1d24a8c3aa0883ceabd0da02d`.
Worker revision is `fulfillapprovedaccountdeletions-00005-kux`. The policy receipt
still pins `224a64...`; deletion processing remains blocked before the job query.
See `CONTAINMENT_DEPLOYED.md`, `WORKER_COMPATIBILITY_DEPLOYED.md` and their sanitized
receipts. Default/Storage rules, policy documents, worker settings/service identity,
schedule, Storage synchronization and Admin/VIP review functions are unchanged.
Only the policy receipt step remains separately approval-gated. Acknowledgment can
resume existing approved work and future valid approvals automatically. Never
restore the permissive rules.

The original local preparation and compatibility findings follow. This plan
supersedes the website-compatibility/backport prerequisites in `../legacy-launch/`
and the earlier prelaunch reports. It does not supersede native authorization,
historical ownership, existing retention or account-deletion safeguards.

Baseline `fb654e5`; reuse `973424a`, `6c792e1`, `9c0d5da`, `30d7be2`, `5007858`.
No cloud credentials, resident documents, historical messages or media were read.
No settings, IAM, live rules, data, Hosting, notification gates or workers changed.
No website UI audit, migration, push, deployment, OTA or native build occurred.

## A/B/C dependency map

A = native runtime required; B = shared/historical dependency still required;
C = retired website-only client behavior, candidate for eventual retirement.

| Resource | Class | Actual native/backend usage and decision |
| --- | --- | --- |
| Firebase project `cc-livingcommunity-app`, Auth and existing Google OAuth registrations | A/B | Native `lib/firebase.ts`, session/registration/Google login and all authenticated APIs share the project. Keep Auth identities, providers and native registrations. Do not delete users, revoke keys or disable domains just because a web client used them. |
| Firestore `(default)` | A | Native profiles/approval/directory, Work Orders/counters, Social/Marketplace, private/service Inbox, group conversations/membership/message visibility, newsletter PDF chunks and publishing, RSVP/highlights, notification device/state and deletion controls. Keep exact current rules/indexes. |
| Named Firestore `ai-studio-cclivingv27-5fc1a0f6-cd75-4964-8c9e-e219a265f7bb` | B for data and server operations; C for direct website client access | No mobile client data connection. Server account deletion inventories/redacts both databases, checks completion and reconciles media. Prepared exception helpers mention named scope but are not imported by the current native UI. Keep the database and records; close client access. |
| Storage `cc-livingcommunity-app.firebasestorage.app` | A/B | `getStorage(app)` plus native media authorization/PrivateImage and newsletter compatibility reader paths. Existing legacy-linked attachments may still be referenced; six quarantined objects remain. Keep bytes, rules, metadata, links and existing tokens. Never infer disuse from an old filename, folder or uploader. |
| `syncHostedStorageMembership`, default `storage_web_authorization/policy` | B, retirement candidate only after separate reference/authorization review | Server reads named profile role/approval and projects bounded authorization metadata; deployed Storage rules consult that projection. Account deletion invokes the same reconciliation. Closing named client access does not stop Admin SDK reads. Do not remove the function/projection or its Storage branches in this rollout. |
| Push registration/state, four category triggers, receipts and group push | A | `functions/inbox.cjs` binds events to `(default)`; group entry also binds `(default)`. Native uses `registerInboxDevice`, `getNotificationState`; Android delivery/FCM credentials remain. iOS uses the same backend with its existing separately gated APNs preparation. No sending/platform setting changes. |
| `manageInboxConversation`, membership/role revocation, Inbox retention preparation | A | Default-only authoritative conversations/memberships and epoch-filtered messages. Legacy-format records **inside default** remain active native data; their collection names do not make them retired website resources. Existing Stage B gates remain unchanged. |
| `newsletterApi`, `runNewsletterAnalysis`, task queue, Gemini secret/service identities | A | Native API mounts only `/api/newsletter/native`; authorization/PDF loader/jobs use `(default)`. Shared server modules/config filename are not evidence of a website-only dependency. Keep endpoints, IAM, secret, queue, uploaded PDFs, extraction and publishing unchanged. |
| Translation, directory sync, moderation/blocking, queue positions, account request/review/processing/monitor/proof APIs, media cleanup | A/B | Default role checks and server operations; account/media processing also traverse named scope. Source env-selectable database handlers must retain their reviewed deployed `(default)` selection. No function is removed or globally redeployed. |
| Home weather/medications/checklist/monthly schedules | A, largely outside Firestore | Home model/storage is per-account local storage, recurring activity source is bundled, weather uses Open-Meteo. User/session still depends on default profile authorization. No feature changes. |
| Hosting site `townloop`, public policy files and domain | B | `src/data/legal.ts` still points native users to `https://townloop.web.app/privacy.html`, `/terms.html`, `/delete-account.html`. Preserve those exact URLs until approved replacements and app release. Check any app-link/auth-domain associations before later Hosting/domain changes. **Do not disable all Hosting.** |
| Original AI Studio/Vite SPA, old broad Firestore subscriptions and web-only registration/inbox UI | C | No longer a compatibility requirement. Candidate for an approved retirement landing page/cache retirement later while preserving required policies/association routes. Neither website rebuild nor shutdown is part of this work. |
| Isolated old website Firebase bootstrap, web service worker/cache and website-only API routes | C candidate | Android/iOS source graphs do not import `src/firebase.ts`; native API packaging does not mount old web routes. Preserve shared utilities/server modules, public client config and history until a scoped retirement decision. No resource deletion prepared. |

### Source evidence and limits

`trace-native.cjs` follows literal relative imports/exports/requires from all Expo
routes, selecting Android/iOS variants before shared source. Each platform reaches
157 source modules and one database constructor: `native/src/lib/firebase.ts`.
That constructor selects `native/firebase-config.json`'s explicit `(default)`;
this public config has not changed since `4ac3f6e`. Both graphs exclude the old
web Firebase bootstrap. Package internals/computed imports and actual phone traffic
are not certified by static tracing; `dependency-trace.json` records its bounded scope.

The native REST PDF uploader also derives `(default)` from that config
(`native/src/news/firestorePdf.ts`). Native newsletter authorization explicitly
selects default (`server/newsletterAuth.ts`), reconstruction fixes default
(`server/nativeNewsletter.ts`), background jobs use default Admin SDK
(`server/newsletterJobs.ts`). No uploader/extractor code was modified or rerun.

**Corrected by the focused follow-up:** the named-ID reference in
`native/src/lib/accountDeletionOperations.ts:4` is an **unreferenced prepared helper**,
not a current native UI dependency. Neither Android nor iOS route import graphs
reach that module. The current `AccountDeletionRequests` screen imports
`lib/accountDeletion.ts` and calls the deployed `listAccountDeletionRequests` and
`reviewAccountDeletionRequest` APIs in `us-central1`. It does not call the missing
`listAccountDeletionExceptions` or `recheckAccountDeletionException` APIs. Their
absence must not block this containment rollout or cause unnecessary deployment.
If separately deployed later, `functions/accountDeletionOperations.cjs` requires
canonical approved **Admin** status, revoked-token checks and independent request
review; VIP request review remains in the separate current review API. Processing uses
`accountDeletionScope.cjs`, `accountDeletionRunner.cjs`, `accountDeletionScoped.cjs`,
inventory/media adapters and `getFirestore(databaseId)` Admin SDK. Both scopes
must still be completed before shared Auth deletion. Do not drop the named scope.

Existing deployed receipts (`../account-deletion/activation-receipt.json`,
`../c2/DEPLOYED.md`) establish prior deletion and Storage-projection activation;
comments saying "prepared only" are not current activation evidence. This pass
did not re-inventory cloud functions, live IAM or actual resident references.

## Chosen security change: close named client access

`firestore.named.rules` denies every mobile/web SDK or Firebase-user-token REST
read/write at every named-database path, including own profiles, lists, nested
messages and unknown future collections. No exceptions for Admin/VIP client tokens:
legitimate native managers use the unchanged default rules and guarded APIs.
There is no need to provision new historical grants, mailboxes, epochs, users,
directories or conversations for a retired client.

This is a simpler, stricter native-only adaptation of the reviewed fail-closed
legacy candidate. It preserves all named data and removes the broad approved-user
chat/profile access entirely. Historical native messages under **default** retain
their existing membership/epoch rules. Do not copy this deny-all file onto default.

Authorized server SDK calls use IAM rather than client rules, so the existing
named deletion/projection operations can continue with their current service
permissions. Emulator owner-bypass CRUD verifies only the rules boundary, **not**
the deployed service identities' IAM. Verify those identities/metadata before an
approved release. No IAM expansion is proposed. See [Firebase's server-library and
deny-all rules documentation](https://firebase.google.com/docs/firestore/security/get-started).

### Historical data

No production membership was guessed, certified or changed. Closing access does
not require verifying memberships because it grants nobody any historical access.
Retained named profiles/chats/attachments remain available only to already
authorized server services and separately authorized operators. Uncertain ownership
is denied to clients, not migrated, deleted or exposed to staff through a new API.

If a future approved recovery needs to show named history, independently verify
UID/membership and retention/evidence first using trustworthy records. Previously
broadly writable owner IDs, names, email aliases or matching hashes alone are not
proof. Do not import that history or create grants automatically. Existing deletion
processing retains its ownership-conflict/evidence/media holds and completion checks.
The default Inbox retention/cleanup gates and six quarantined attachments are unchanged.

Named client denial cannot erase previously cached data, retract prior disclosures
or invalidate bearer Storage download URLs. Those remain separate, specifically
approved reference/token work; no claim of retroactive privacy is made.

## Coordinated production rollout — requires separate approval

See `PREFLIGHT_2026_11_05.md` and `preflight-receipt.json` for the completed focused
read-only checks and the corrected missing-callable finding. The function inventory
is source-contract evidence, not permission to invoke any resident operation.

`rollout.plan.json` is a proposal, not an executable deployment or approval record.
`firebase.deploy.json` contains only the exact named rules target. No default,
Storage, Hosting, indexes or functions are included in that config.

1. **Read-only preflight:** after release approval, recheck live named rules hash
   `224a64...`, default `4d1c449f...` and Storage `9aac5f82...` against the prior
   verified receipts. Check active deletion worker revision/env, actual service IAM
   and current policy receipt. Stop on drift; do not print credentials/user data.
   Record a restricted snapshot of rules and configuration, not resident history.
2. **Prepare the worker pin:** `node functions/tools/prepare-deletion-processing.cjs
   --native-only-rules` packages the same sole approved-account worker and both
   deletion scopes, with the new exact named rule hash. It validates source hashes
   before writing the local artifact. `firebase.deletion-processing-native-only.json`
   has that preparation hook. Scope any authorized deployment to
   `functions:work-order-retention:fulfillApprovedAccountDeletions`; never deploy the
   entire codebase. Preserve existing flags, IAM, scheduler, policy, request reviews,
   deadlines, queue and token-drain timing. No deletion code or activation changed.
3. **Apply named containment**, using only this folder's rules config, explicit
   project and `--only firestore:rules`. The old worker pins the former hash and
   will stop new processing until the rollout is complete. Already in-flight
   authorized server work is not blocked by client rules; do not treat containment
   as a stop button for an executing deletion. No cross-service atomic deployment
   is assumed. Record and accept this bounded processing pause before proceeding.
4. **Deploy the single matching worker**, then independently verify its packaged
   `deletionScopeRules.json`, actual revision, unchanged flags, scheduler and service
   identity. Native default APIs, notifications and Gemini need no redeployment.
5. **Verify denial before acknowledging the new pin:** verify published source/hash,
   unchanged default/Storage releases, and Rules API simulations with synthetic
   pending/Resident/Crew/VIP/Admin claims. For live authenticated probes, use only
   separately authorized test identities and owner-provided known synthetic record
   IDs; never probe a real resident's profile/chat. Confirm GET/list/create/update/
   delete denials and native default allowed/denied paths. No production test data
   creation or real deletion is authorized by this plan.
6. **Acknowledge only the named hash** in default
   `deletion_policies/account.scopeRuleHashes[exactNamedDatabaseId]`, transactionally
   requiring the expected previous hash, newly verified rules and matching worker.
   Do not replace the policy/map, assert unverified write-freeze flags, reset waits,
   extend retention, or alter request statuses/approvals. This configuration write
   can resume already-approved deletion jobs, so it requires explicit coordinated
   approval; no automatic receipt writer is included. Reuse the existing read-only
   `verify-deletion-write-freeze.cjs` with the reviewed new named source to verify,
   preserving the existing Storage trusted-upload boundary.
7. **Physical app smoke checks:** approved Resident/Crew/Admin/VIP login/profile/
   approval, Home, default Work Orders+attachments, Social/Marketplace, both Inbox
   formats/leaving/member privacy, notification taps/four categories, published
   newsletter/PDF/RSVP/highlights and retained-draft access. Do not trigger Gemini
   charges or replace the edition just to validate rules. Check deletion status and
   review non-destructively; an actual deletion needs isolated separately authorized
   test data. Android and physical iPhone acceptance are distinct remaining gates.

### Immediate containment option

After **rules-only approval**, step 3 can close the P0 without waiting for any web
backport, membership migration or new server provisioning. Data/services are retained;
the existing deletion worker deliberately pauses at its rules-hash check until
steps 4–6 are separately approved/completed. All other traced native data paths stay
on unchanged default. This tradeoff must be reported, not hidden by weakening the gate.

### Recovery

Keep the named deny-all rule while diagnosing unexpected legitimate access failures.
Check exact database selection/function role/IAM and receipts; fix forward only the
affected integration. Do not restore permissive baseline rules, republish the old
website, point native at named, infer historical members or weaken default rules.
If worker/receipt deployment fails, leave it safely paused; preserve already
processed data and queued reviews. Restoring an older worker does not justify
acknowledging an old named hash. There is no data rollback because this rollout
does not migrate/delete data; existing separately approved deletion writes cannot
be reversed by changing rules. Follow the existing isolated recovery plan for
data recovery, reconciling deletions first.

## Verification

See `VERIFICATION.md`. New tests cover containment, unchanged default role access,
membership/history denial and local packaging scope. Existing full native, security,
Gemini and uploader suites were not repeated. The rules change requires a Firebase
rules deployment plus the matching deletion-worker pin and policy receipt; **no
OTA or native binary is needed for this containment plan**. No public website
compatibility, new named-grant scheme or data migration remains a launch dependency.
