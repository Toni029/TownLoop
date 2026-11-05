# Missing-callable correction and completed read-only preflight

**Prepared for the next approval; nothing deployed.** Baseline `ca70975`.
The earlier stop treated an unconnected source helper as an installed UI dependency.
This follow-up corrects that error; it does not add an API or weaken a safeguard.

## Exact cause of HTTP404

The actual project-wide inventory returned 27 v2 functions and zero v1 functions,
across all regions. `recheckAccountDeletionException` and
`listAccountDeletionExceptions` are absent; there is no differently cased or
other-region deployment. The local names and `us-central1` endpoint configuration
are correct. This is an undeployed, prepared operations surface, not a code defect,
authentication failure or incorrect project URL.

Crucially, `native/src/lib/accountDeletionOperations.ts` is not imported by either
Android or iOS route graph. The real current Admin/VIP screen is
`native/src/profile/AccountDeletionRequests.tsx`, imported by AdminMenu. It calls
`listAccountDeletionRequests` and `reviewAccountDeletionRequest` through
`native/src/lib/accountDeletion.ts`. Both functions are ACTIVE in `us-central1`.
The current screen does not contain an exception recheck action. There is no reason
to deploy unused recovery APIs to preserve current native functionality.

The two other unconnected helpers, `authorizeAccountDeletionProcessing` and
`recheckAccountDeletionScope`, are also undeployed. They are not requirements for
the current automatic worker or review screen. Do not deploy or invoke them merely
to satisfy an inventory assertion. Do not wire a new native interface in this scope.

## Optional smallest deployment, if separately wanted later

The existing `firebase.deletion-operations.json` and
`functions/tools/prepare-deletion-operations.cjs` already package the correct code.
For list-and-recheck functionality, the minimum filter is:

```text
functions:work-order-retention:listAccountDeletionExceptions,functions:work-order-retention:recheckAccountDeletionException
```

Run the existing local preparation first, then use that filter with the explicit
project and operations config only after separate approval. The artifact exports
six callables, but the filter must select only those two; do not blanket deploy the
artifact/codebase. The optional recheck changes an approved paused request's state
when an authorized operator explicitly invokes it; it must not be called as a test.

Existing guards verify token signature/revocation/UID, canonical approved Admin
status and non-deleting account state. Recheck requires an independently approved,
processing-authorized paused request, exact database/receipt identity and verified
resolution. It preserves ambiguous ownership and reported evidence, writes audit
records and prevents self-processing. VIP approval remains supported by the
separate current review API; this follow-up does not broaden Admin-only recovery.

## Remaining prerequisite results

| Check | Result |
| --- | --- |
| Project/rules identity | Reused the immediately prior verified snapshot for `cc-livingcommunity-app`: named `224a64...`, default `4d1c449f...`, Storage `9aac5f82...`. No repeat rule audit. Named target remains `8493ef...` from the reviewed containment file. |
| Current policy receipt | `policyReady` and `writeFreezeReady` both true. Both database pins match currently deployed rules; both existing write-freeze acknowledgements are true; token drain remains 3,900,000ms. The named receipt must change to the target **only after** target rules and matching worker are verified. No receipt was changed. |
| Storage policy boundary | Media policy hash matches the existing Storage source, and `trustedUploadsAfter` exactly matches its Rules release timestamp. Preserve that boundary and all tokens/quarantined files. |
| Deployed worker source | Read the exact deployed source generation into private local storage without executing it. Its entry and all 15 comparable pipeline modules match current local code. Its actual default/named pins match the current policy. The local package differs in the reviewed parser override/lock from `6c792e1`; worker business logic is unchanged. Target packaging from `ca70975` changes the reviewed named pin, without changing either database scope. |
| Scheduler | ENABLED, every five minutes, UTC. Its OIDC identity matches the worker's runtime account and target URL. Latest observed request returned HTTP200; no request was invoked by this task. Existing active deletion flags remain unchanged. |
| Firestore/Rules permissions | The actual runtime account has an unconditional existing project Editor grant. The provider's role definition includes required entity read/query/create/update/delete and Rules release/source reads. No IAM grant was added or broadened. |
| Scheduler authentication | Its existing service-agent grant includes OIDC token generation; runtime identity has the existing project Run Invoker grant. Latest scheduled HTTP200 provides current invocation evidence. |
| Storage permissions | Runtime's existing project-editor membership receives the bucket's unconditional legacy Bucket Owner grant (list/delete). Bucket default object ACL gives project editors OWNER; uniform access is off. This is existing ACL-based authorization, not a claim that Editor itself includes object get/update. Individual historical object ACLs were not re-audited or changed. Existing provenance/generation/reference checks and getMetadata failures remain fail-closed before any deletion. Prior actual removal evidence is retained; no new object operation was executed. |
| Storage synchronization | ACTIVE on named `users/{uid}`, retry enabled, same runtime identity with named reads/default projection writes permitted. Its code is unaffected by client-rule denial. No document event was generated or handler invoked. |

Required existing backend components are deployed. No missing callable is a
remaining containment dependency. Historical ownership holds remain valid and are
not overridden by this readiness determination. Physical Android/iPhone smoke checks
and actual post-deployment rules verification remain release acceptance work.

## Exact next approved rollout

1. Refresh only mutable release metadata/policy revision guards immediately before
   execution; stop on drift. Preserve the private snapshots and deny-all recovery.
2. Apply only named `firestore:rules` with
   `security/native-only-firestore/firebase.deploy.json`. Default rules, Storage,
   indexes, Hosting, IAM and resident records stay untouched.
3. Deploy only `fulfillApprovedAccountDeletions` using
   `firebase.deletion-processing-native-only.json`, whose preparation hook selects
   the new reviewed rules pin. No exception API, scheduler activation or unrelated
   function deployment is needed.
4. Verify named source/hash and synthetic unauthorized access denial; verify
   unchanged default/Storage releases, worker revision/pin, flags and scheduler.
5. Transactionally acknowledge only the named hash in the existing policy receipt,
   requiring its prior value and all verified target components. Keep reviews,
   waits, flags, retention and all other fields unchanged. This can allow the
   already-active approved workflow to continue; it is not a request to manually
   trigger a deletion or create a new job. Explicit rollout approval remains needed.
6. Check native login/approval, news/PDF, messaging/privacy, media and notifications
   with consenting test users, without publishing a newsletter or requesting a real
   resident deletion. Confirm worker/sync status without generating resident events.

If anything fails, retain named deny-all and let the exact-hash worker gate pause
processing; never restore the vulnerable rules. See the full plan's containment and
recovery instructions. No account deletion, recheck/resume operation, upload,
Gemini request, push message, IAM change or deployment was performed here.

## Focused verification evidence

- Project-wide v1/v2 inventory and policy/scheduler/IAM metadata read once; prior
  rules snapshot reused. Raw metadata, source archive and provider policy files
  are outside Git in the owner's mode0700 `security-unblock-*` state directory;
  individual snapshots are mode0600. No credentials or resident payloads in Git/logs.
- Both-platform source trace confirms the unused helper is unreachable and current
  request review is mounted. No UI/source behavior changed.
- `node --test functions/accountDeletionOperations.test.cjs functions/deletionOperationsEntry.test.cjs functions/storageMembershipDeletion.test.cjs`:
  **5/5 pass**, no skips, 4.140s. Existing synthetic fixtures cover Admin-only recovery,
  independent approval, ambiguity preservation, retry-safe recheck and deletion of
  only the stale Storage membership projection. Packaging exports no deletion
  engines/schedulers. No live account or document is involved.
- Existing containment emulator tests from `ca70975` were not repeated because
  the rules, default policy, uploader, Gemini, startup and native UI are unchanged.
