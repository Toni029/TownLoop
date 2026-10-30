# Account-deletion access protection — October 30, 2026

Owner authorized rules changes for safe requested-account deletion. This scoped release only
blocks unauthorized/anonymous writes and prepares stale-session protection. It does not deploy
or activate deletion workers, approve extra requests, install processing policies or delete data.

## Live request inspection (read-only)

One request exists, already independently approved by an authorized Admin/VIP. Its state is
`approved_held`, processing authorization is false and Auth remains enabled. No duplicate
approval is necessary. The default profile has no UID conflicts; no same-UID named profile
exists. Exact UID metadata queries found one Marketplace listing in default and zero matching
supported parent/membership records in named. This does NOT certify absence of embedded
comments, aliases or unmatched historical media. No private message/comment bodies or image
contents were read. Named profile metadata: three pending profiles, none approved; no role or
approval was assigned by this work.

The live account-processing policy and media-deletion policy are both absent. Installing
unverified coverage flags is not an acceptable substitute for a per-request inventory.

## Prepared implementation

- Server-only `account_access_revocations/{uid}` is written independently in both scopes before
  Auth is disabled/revoked. It binds the request, UID, policy and original expiry. Retries cannot
  replace another request's fence. Conflicts pause for review; no silent overwrite.
- Rules deny fenced callers even when an old token still appears valid. They prevent profile
  recreation after erasure, profile-marker removal, and manager writes to a fenced profile.
  Inbox v3's separate approval helper also observes the fence.
- Fence receipts are removed only in the existing final retention phase after successful account
  processing and Auth deletion. No 400-day period or permanent new audit exception is added.
  Unresolved cases remain blockers; preservation is not authorization for indefinite retention.
- Website rules require authenticated, approved canonical accounts for all chat writes and every
  social update/delete branch; previously anonymous write paths are removed. Existing pending
  registration and ordinary approved-account field/chat operations are covered by emulator tests.
- Default candidate starts from the ACTUAL deployed rules, preserving Discussion reply and Inbox
  group protections. The root `firestore.rules` file was already older than production; it is not
  used for this release. Do not overwrite live protections with that older generic configuration.

## Exact release scope

`firebase.deploy.json` names only the two existing databases and their rules. No functions,
indexes, Hosting, Storage, database creation or activation settings are included.

Run `check-rules-release.cjs before` with the existing Firebase CLI auth-module path in
`TOWNLOOP_FIREBASE_AUTH_MODULE`; it refuses any changed baseline/candidate. Deploy only
`firestore:rules` with this configuration and project `cc-livingcommunity-app`. Then run
`check-rules-release.cjs after` to verify both live hashes. Authentication secrets are never
printed or stored by this tool. The resulting receipt is rules metadata only.

## Still required for deletion activation

Complete a trusted, non-destructive per-request inventory (including embedded author references,
profile/media relationships and any legacy identities), verify media provenance/cutover and
finite evidence dispositions, install the verified account/media policies, and deploy the
isolated processing/proof/media components initially disabled. Preserve all six quarantined
files. Recheck live rule hashes and the independent approved request before explicit processing
authorization. Rule publication alone does not make the request operational.

Focused verification: ten Firebase emulator rule cases and seventeen scope/processor tests;
fixture-only deletion, retries, two-database completion, access-fence creation/expiry and conflict
handling. No actual user deletion or physical-device testing is claimed.
