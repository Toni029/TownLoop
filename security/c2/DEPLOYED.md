# C2 activated — 2026-10-23

Project `cc-livingcommunity-app`; original `cc-livingcommunity-app.firebasestorage.app` bucket.

- Four verified attachment links preserved; six unresolved legacy objects quarantined by
  denied ordinary SDK access. Their generations/metagenerations match the preflight snapshot.
- `syncHostedStorageMembership` is ACTIVE, targets only the existing named database's
  `users/{uid}` metadata, and projects authorization into the server-owned default policy.
- Live Storage source exactly matches `storage.compatible.rules`; both Firestore rule
  releases are unchanged. Hosted website and database selection are unchanged.
- Existing six planner/metadata tests passed; focused emulator native/web authorization,
  upload/download, overwrite denial and historical-unlinked denial test passed.
- Live metadata-only unauthenticated reads and start-only anonymous upload probe returned
  denial. No object was created by the probe. No media bytes downloaded.
- Real-device authenticated uploads were not performed; legitimate native/web paths are
  covered by the focused emulator checks against the exact deployed rules.
- Existing bearer download tokens remain usable. No URL was revoked; do not call these
  existing links private. Cleanup/deletion workers and Production releases remain unchanged.

Recovery: IAM-administrator-only `recover-quarantine.mjs` provides metadata review and
explicit verified-link restoration, audited in Cloud Logging. Review was exercised and
reported six unlinked objects, without media downloads. Future restoration requires a new
uniquely verified parent plan and separate approval; ownership is never inferred.

Private original plan, metadata snapshot, linkage receipt, prior rules recovery source and
aggregate deployment verification are preserved outside Git under the owner's restricted
local state directory `~/.local/state/townloop/c2-quarantine-20261023/` (0700/0600).
Use fix-forward or restricted read-only recovery; NEVER restore the old public write rules.
