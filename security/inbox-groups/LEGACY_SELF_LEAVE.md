# Legacy self-leave correction — LOCAL, NOT DEPLOYED

## Exact failure

The deployed `leaveLegacy` operation required a full legacy-to-v3 cutover before it
could remove one user. Office/Crew cutover correctly required an independently
reviewed membership manifest; unknown historical message fields/IDs and transaction
size limits also blocked private cutovers. The screenshots show that deliberate
`legacy-review` failure, not a missing OTA or missing function anymore.

A self-revocation does not grant anyone historical membership. It should not
require a full-conversation conversion or a review of every other historical user.

## Correction

Unconverted sources now use an authenticated server transaction that preserves all
existing history, sets only `leftBy[callerUid]`, and appends one genuine muted leave
event using the caller's verified profile name. It never writes `sideLeft.team`,
assigns new participants, copies media, or creates a replacement group. Retries do
not duplicate events. Failed transactions acknowledge nothing. Existing migrated
sources continue to use their authoritative v3 memberships.

The legacy list, direct-read/write rules, recipient authorization and live push
recheck all exclude the departing UID. Other participants retain their original
access/history. Private remaining participants can read/acknowledge but cannot send.
Office/Crew sending toward a departed resident is also prevented. A later attempt
to create/reuse a conversation cannot silently rejoin a departed account.

An account-scoped in-memory signal removes the row only after `left:true` from the
server. Confirmed departures also filter stale in-flight list responses; a failed
call emits no removal signal. No permanent client-only hiding is substituted for
server revocation. No design changes or Marketplace changes are included.

Full migration, adding recipients and historical visibility still require verified
membership. This correction deliberately leaves the old record in place. Known
final private departures queue held legacy cleanup only. The final staff member
cannot be inferred from a historical role-wide record, so those records are never
marked fully abandoned just because the currently known authors have left.
Stage B remains absent/disabled; no live records were modified during preparation.

## Exact release scope (separate approval required)

1. Fetch/verify the CURRENT deployed default Stage A rules. Run:
   `node security/inbox-groups/prepare-legacy-leave.cjs <verified-current-rules>`.
   This produces `.release/inbox-legacy-leave`, a scoped incremental candidate.
   Compare its recorded baseline SHA-256 again before applying. Already-patched
   input is rejected. Marketplace and named-database rules remain unchanged.
2. Deploy only these existing functions with their CURRENT verified environment,
   Android recipient/platform scope and secrets preserved:
   `manageInboxConversation`, `getNotificationState`, `notifyInboxFriend`,
   `notifyInboxOffice`, `notifyInboxMaintenance`.
   The last three must get the updated shared membership check so a departed user
   is excluded even from a queued pre-leave notification. No sender activation or
   expansion is requested. Generated environment placeholders are OFF; do not
   replace the verified live configuration with them during deployment.
3. Deploy only the incremental `(default)` rule candidate. No new index, Hosting,
   Storage rule, token retirement, cleanup scheduler, or account-deletion component.
   Complete backend/rules together before publishing the compatible client OTA.
4. Publish the JS-only Inbox refresh/legacy-state correction to the existing exact
   Preview runtime after verifying compatibility. No Android/iOS native changes or
   binary build are required. Full on-device behavior remains to be tested after
   deployment; no resident data or real accounts were used in local verification.

## Focused evidence

The new legacy leave regression initially failed with the screenshot's same
`failed-precondition` path. Local transaction tests now cover Office, Crew and
private sources, idempotency, rollback, actor-only changes, preserved unmodeled
history, no forced rejoin and queued push exclusion. Firestore emulator checks
verify actual direct-read denial, forged-write denial, remaining-staff send access,
and private read-only behavior. Native checks cover positive-acknowledgement only,
account isolation and subscription cleanup. TypeScript passes.
