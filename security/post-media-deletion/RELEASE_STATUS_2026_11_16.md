# Sharing removal and targeted media deletion — release status

Prepared November 16, 2026. Local commit only; no new tests, audits, cloud writes,
deployments, OTA, builds or account-policy changes in this finalization step.
Earlier README/FINAL_DECISION describe earlier snapshots, not this newer candidate.

## Included

- Remove native Social/Marketplace post sharing and the shared post-detail handler.
  Preserve PDF sharing, media upload, messaging and existing deletion confirmations.
- Extend the existing deletion path to canonical marketplace_posts, discussion_feed
  and work_orders. Preserve current deletion roles and original/crew media linkage.
- Reuse issueMediaUpload for exact, expiring, server-issued per-record media-reference
  authorization stored in existing safety_limits. Candidate default rules reject
  cross-post typed attachment claims; legacy associations may remain in their own
  record. No new schedule, identity, secret or registration service.
- Reuse durable per-event jobs, generation checks, temporary-failure retries, evidence
  holds and ownership verification. Shared/unverified/protected files remain held.
- Preserve existing Marketplace chat images through verified, byte-identical copies
  before removing listing originals; messages/history are not rewritten.
- Existing single synthetic Auth/Firestore/Storage emulator scenario passed (1/1,
  saved prior-run log: /tmp/townloop-record-deletion-single-e2e.log). No production
  deletion or physical-device verification is claimed. No additional tests run here.

## Safety gate and compatibility

The cross-post typed-attachment claim demonstrated previously is addressed by the
candidate rules and server authorization. Do not extrapolate that result into a
proof that every shared-reference race is eliminated: arbitrary references in other
records, protected evidence and privileged backend writers require compatibility
with the exclusivity guarantee. Point-in-time scans alone are not that guarantee.
Keep targeted deletion disabled until this remaining release gate is satisfied.

The narrow TOWNLOOP_POST_DELETE_MEDIA_ENABLED flag defaults OFF. Global Database
Cleanup remains read-only; broad media/orphan/draft/retry schedulers stay unexported.
No historical purge or queued-account resumption is authorized.

Old clients do not obtain new reference tickets. After strict rules activation,
adding/replacing attachments on those clients can be denied; do not describe this
as a transparent backward-compatible backend-only deployment. Existing reading,
text operations and deletion roles are intended to remain unchanged.

## Exact proposed release scope — separate approval required

1. Push approved commit(s). Deploy only issueMediaUpload (us-central1),
   cleanupDeleted_marketplace_posts, cleanupDeleted_discussion_feed,
   cleanupDeleted_work_orders (us-central1), and completeMediaUpload (us-east1).
   Keep targeted deletion OFF and all broad cleanup disabled. Confirm existing
   service permissions cover metadata/copy/delete and Rules read access; no new
   service identity is proposed. Preserve old callable request behavior.
2. Release the matching native JS changes BEFORE stricter rules. The sharing and
   ownership changes themselves add no native dependency. Confirm the actual
   Production runtime before approving an OTA; never override fingerprints. The
   separately prepared App Check native module is outside this release, and a full
   current-tree fingerprint must not be assumed compatible with the installed AAB.
   If a compatible release cannot be isolated, a separately approved AAB is needed.
3. After client adoption and the remaining shared-reference safety gate, deploy ONLY
   security/post-media-deletion/firestore.ownership.rules to (default). Its expected
   SHA is recorded in functions/recordMediaRulesPin.json. Storage rules and the
   deny-all named-database rules remain unchanged. This candidate derives from the
   existing account-deletion default rules snapshot, not the separately prepared
   abuse-enforcement migration. Do not mix unrelated rule rollouts.
4. Default-rule changes also invalidate the account-deletion worker's expected
   default-rule hash. Keep that worker/receipt/retention untouched and paused;
   future account-deletion compatibility/resumption is a separate approval.
5. Only after the safety gate and coordinated client/rules rollout, authorize the
   narrow flag on the three deleted-record handlers and existing finalizer.
   Do not enable global cleanup or deploy broad scheduled cleanup workers.

Event retries are finite; unresolved held/exhausted jobs require a scoped operator
review/replay, not an invented completion result. Existing bucket recovery retention
still applies. Deployment preparation must preserve unrelated backend writers and
must stop if their reference behavior defeats exclusivity.
