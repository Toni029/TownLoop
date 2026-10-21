# C1 Marketplace Chat Security — Console-baseline candidate

## Current decision

**Latest web finding:** [HOSTED_WEB_REVIEW.md](HOSTED_WEB_REVIEW.md).
Do not deploy main+C1 to Hosting as a narrow C1 patch: the served app uses a
different database and predates Marketplace conversations. Recommendation is to
keep Hosting unchanged for this cutover, subject to owner review.

**Final pre-deployment review:** [PREDEPLOY_REVIEW.md](PREDEPLOY_REVIEW.md).
Live rules were independently verified unchanged; EAS runtime/channel checks and
clean C1 patches are prepared. Web live-source provenance and older-client rollout
coverage still gate cutover. Nothing has been released or deployed.

**Updated local status:** [Client compatibility follow-up](CLIENT_COMPATIBILITY_RESOLVED.md).
The approved metadata scan found 2/2 identity-compatible conversations, with no
identity migration indicated. Leave-marker alignment and local-cache preservation
are now implemented and verified locally. Release/deployment approval, supported
client activation, baseline recheck, and secure fallback preparation remain.

> Latest compatibility decision and unexecuted metadata-only plan: [COMPATIBILITY_PLAN.md](COMPATIBILITY_PLAN.md). This identifies additional client leave-marker/cache-preservation gates.

**The C1-only rules candidate is prepared and source-compatible with the updated
clients. Production cutover remains conditional on client activation and legacy
identity compatibility. No deployment is authorized or performed.**

This review accepts the full rules supplied by the user from Firebase Console as
the current live baseline. It does not claim a successful independent Rules API
fetch: the last authorized read-only API attempt returned HTTP 401 and credentials
were not changed.

## Exact artifacts

- `firestore.console-baseline.rules`: the supplied Console baseline, matching the
  historical Git blob `4834e1f:firestore.rules` (`4a962b2f2f2247ab4199488a22001f1f324f2747`).
- `firestore.c1-candidate.rules`: complete baseline with only C1 replaced.
- `firestore.c1-only.patch`: exact reviewable unified diff.
- `comparison.json`: hashes and mechanical preservation/equivalence checks.

Baseline SHA-256:
`79c701b89890d43c1bb82028f02ce5483987577b2dae31dd1e5518bdecddd259`

Candidate SHA-256:
`ea46363e0c12251f1d9855e24252abaa7593f138a65cab11a099a356def903bd`

The candidate is 408 lines; baseline 334. A reversal of just the C1 replacement
reproduces the baseline byte-for-byte. Names of the new helpers do not collide
with existing helpers. No other path in this supplied ruleset grants overlapping
access to Marketplace chat documents; the recursive fallback denies access.

**Do not deploy the root `firestore.rules` as the C1 release.** In addition to C1,
that local file contains undeployed profile-update-request and manager-resolution-
comment-deletion changes absent from the Console baseline. Those remain untouched
and excluded from this candidate. The root `firebase.json` has not been rewired.
Existing Work Order, profile, RSVP, office/crew/friend Inbox, newsletter, counters
and all other live rules are copied unchanged, including known unrelated risks.

## Prepared client compatibility

Both the native and web implementations use the shared Marketplace protocol:

- Firestore seller-or-buyer queries constrained to the exact Firebase Auth UID.
  Sanitized `participantIds` are not used as access authority.
- Fresh approved profiles and canonical role checks; no nonparticipant Admin,
  VIP or Crew access exception.
- Authenticated buyer creation linked to a listing and a different approved
  seller; deterministic existing chat-ID convention is retained.
- Transactional single-message append, stable operation IDs, and bounded
  contention retries; prior messages/participant identities are immutable.
- Own read-flag acknowledgment and controlled first-leave/second-leave deletion.
  Only a fixed, actor-attributed system notice is accepted for leaving.
- Web no longer reports a failed remote write as a successful local message,
  accepts matching names as membership, or reuses its unscoped global chat cache.

Native changes are compatible with the existing native dependencies and can be
released via an approved matching-runtime OTA. Web needs a separate deployment.
The original `main` service matched the pre-C1 service; its approved patch must
reach the real web hosting target, not merely this branch or GitHub.

### Existing records

Compatible by design and covered with synthetic fixtures:

- Exact canonical Firebase UID strings in `sellerId`/`buyerId`.
- Legacy sanitized participantIds arrays with canonical seller/buyer fields.
- Existing historical messages (not rewritten or revalidated as new messages).
- Chat IDs and listing links remain unchanged; an old listing need not still
  exist for the authorized participants to read/reply in an existing open chat.
- Explicit historical leave flags or buyer/seller role markers.

Not certified compatible without additional, separately authorized review:

- Names, email aliases, lowercased/sanitized IDs or absent values in seller/buyer
  fields; do not guess or infer ownership from names or participantIds.
- Malformed message arrays, unsupported role values or missing explicit approval.
- Leave state inferred only from a lossy UID rather than explicit flags/roles.
- New inquiries against listings without a valid canonical owner/approved seller.
- Historical ownership claims possibly forged under the old public-write rules.

No resident metadata or conversation bodies were examined. No migration was
performed or generated to guess these identities. Exact UIDs in a document do
not by themselves prove the history was authentic when anyone could overwrite it.
**Universal no-loss/no-interruption assurance is therefore not possible under the
current restriction against examining real data. Stop for separate approval if
legacy metadata review or a controlled migration is needed.** A permission error
would hide access; it does not itself delete stored history.

## Verification reused

The 51 prior loopback-emulator assertions passed using mocked auth contexts only;
no Firebase Authentication accounts or Auth emulator accounts were created.
The tested cases include participant queries, nonparticipant and unapproved
rejection, sender/listing/participant forgery, history tampering, read flags,
leave/delete, canonical legacy fields, idempotency and concurrent replies using
the real shared client write protocol.

No new test suite/build was run. Static comparison established that the inserted
C1 block, `isSignedIn`, `currentProfile`, `isApproved`, and the users/listing read
rules used by that protocol are identical to their tested equivalents. The
non-C1 differences between local rules and the supplied live baseline do not
participate in these C1 checks. The 51 results are reused, not represented as a
new test run against live Firebase. Native types, focused web types and native
lint passed in the implementation turn; full web-project checking had unrelated
errors in unchanged paths and was not certified globally green.

## Approval-gated rollout

1. **Freeze and review:** approve the exact C1 candidate/hash and client commit
   range. Keep recovery checkpoint `1804071`, the Console snapshot and a checked
   secure fallback. Immediately before a future cutover, ensure Console rules
   have not changed since this snapshot; stop/recompose if they have.
2. **Resolve compatibility first:** establish the supported installed-client
   versions and decide whether separately authorized legacy metadata review is
   needed. If unresolved records exist, approve a minimal read-only inventory
   first, then a backed-up, dry-run, verified-identity migration only if necessary.
   No such data access/migration is authorized by this preparation.
3. **GitHub after approval:** commit the C1 client changes, types/shared protocol,
   verification harness, review notes and exact candidate as their own checkpoint;
   push only after approval. The outgoing branch also contains the earlier
   `1804071` UI/PDF checkpoint. Review that release scope or authorize preparation
   of a security-only release; an OTA bundles the selected source, not just a
   chosen Git diff. A GitHub push must not deploy any rules or publish updates.
4. **Preview OTA after approval:** publish to Preview only, verify its runtime
   matches the installed Preview APK, and have the user activate it at a safe
   restart. A new APK is not inherently needed. Preview does not update any
   Production-channel users; those would require their own approved compatible
   release before rule enforcement. No Production publication is authorized.
5. **Web deployment after approval:** ship the approved Marketplace web changes
   to the actual hosting target, then refresh active browser clients. GitHub/EAS
   publication alone does not deploy the web app. Verify compatible-client
   readiness before tightening rules.
6. **Cutover gate:** old clients that request the whole collection or overwrite
   full snapshots cannot keep working securely. Confirm users have activated the
   update, or arrange an explicit upgrade cutoff/short messaging window. There
   is no mandatory-version gate in the prepared C1 code. Never grant temporary
   public access or name-based access to preserve an old client.
7. **Firestore deployment only after explicit approval:** publish
   `firestore.c1-candidate.rules`, not the root local rules file. If using Console,
   replace the complete editor content with the reviewed candidate; review the
   diff before Publish. If using CLI, use an explicitly reviewed temporary config
   rooted alongside the candidate and the explicit `cc-livingcommunity-app`
   project/default database, scoped to Firestore rules only. A rules-only flag
   still replaces the full ruleset and does not itself preserve unrelated rules.
   No Storage, Auth, functions, indexes or other vulnerability changes belong here.
8. **Verify after cutover:** confirm published version/hash; observe aggregate
   permission failures and, only with separate consent, authorized participant
   workflows. Do not inspect or log other residents' messages.
9. **Secure recovery:** never restore the public baseline as a rollback. Keep
   strict participant-only reads, temporarily deny writes/disable messaging if
   necessary, and fix forward. A restricted fallback must itself be composed
   from this Console baseline, reviewed and emulator-checked before cutover.
   An old client rollback that reinstates whole-collection queries is not a
   secure messaging recovery plan. Do not delete/migrate conversation data as
   an automatic response to permission errors.

## Readiness gates remaining

- Identity metadata was verified compatible for 2/2 conversations. Historical
  message authenticity/schema was deliberately not examined; no identity migration
  is indicated by the approved check.
- Client activation/old-version handling is not yet established.
- A secure restricted fallback has been described, not yet built/tested.
- The outgoing source/OTA scope includes earlier UI/PDF changes unless separately
  isolated and approved.
- Deployment authorization/access and a last-moment live-baseline check remain
  necessary. Receiving Console rules is not deployment permission.

No source feature fixes beyond C1 were implemented in this review. No Auth users,
resident conversations, production data, deployments, GitHub pushes, OTA updates
or APK builds were created/changed. C2 remains out of scope.
