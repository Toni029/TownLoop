# Account-deletion processing — October 30, 2026

## Verified live state

Automatic fulfillment is active for verified resident requests independently approved by an authorized canonical Admin/VIP. Submitting a request alone cannot delete an account, and self-approval remains prohibited.

`activation-receipt.json` records the verified deployed worker/review revisions and content-free aggregate verification. The independently approved existing request was processed successfully: Firebase Auth no longer contains the account; both database scopes independently confirm completion; profiles, directory projections and device tokens are absent; one owned Marketplace listing and four owned photos are removed. No unresolved inventory or remaining owned active Storage objects were found. All six quarantined files remain.

The request accurately remains `retention_pending` for minimal audit/offline-cleanup receipts under the previously approved original 60-day window. Existing Storage soft-delete recovery is seven days (604800 seconds). Recovery settings and backups were not changed; recoverable copies are not falsely described as immediately purged. No automatic 400-day application retention was introduced.

## Deployment and safety

- `reviewAccountDeletionRequest` queues a valid independent approval when the explicitly activated server policy is ready. The review callable never performs destruction.
- `fulfillApprovedAccountDeletions` is the sole new scheduled worker, running every five minutes from the isolated `firebase.deletion-processing.json` package. Its three processing flags and server policies were explicitly activated under the owner's instruction. General orphan/draft cleanup, Inbox final-participant cleanup and unrelated workers remain untouched.
- Per-request approval/audit verification, both-database access fences, immediate directory removal and Auth disable/revocation precede the mandatory token drain. A fresh ownership/media inventory runs before destruction.
- Both database completion receipts, media completion and reconciliation are required before Firebase Auth removal. The original website's authorization bridge is cleared; fenced stale website sessions cannot recreate deleted profiles.
- Unknown ownership, legacy identity paths, unsupported private subcollections, reported evidence and shared/unverified media are explicit `needs_review` exceptions. They cannot be silently declared complete. The six quarantined attachments remain excluded.
- Account-specific media deletion rechecks both databases' remaining references and object generation/metageneration. Late resumable uploads require the original request-bound deleted-parent ownership proof and are reconciled during the finite receipt window.
- Other residents' content survives; necessary Work Order history is anonymized. Existing clients clear account data when authoritative deletion/revocation is established on their next run/reconnect; permanently offline devices cannot be remotely erased.

See `automatic-processing.md` for operation, exception and stop/recovery boundaries. The source does not automatically grant itself new permissions; existing service-account and bucket/object access were reused without IAM expansion.

## Rules checkpoint history

`release-receipt.json` is the earlier **rules-only** checkpoint at 09:07 EDT. Both reviewed scoped rules hashes remain current. The rules-only checkpoint's then-disabled processing state has been superseded by `activation-receipt.json`.

`firebase.deploy.json` still names only the two scoped Firestore rule releases. It does not contain function, Storage, Hosting or index deployment targets. Default rules started from the actual deployed protection set; do not replace them with the older root `firestore.rules` file.

`check-rules-release.cjs after`, with the existing Firebase CLI auth-module path in `TOWNLOOP_FIREBASE_AUTH_MODULE`, verifies current rule hashes without reading resident documents. Never overwrite a changed baseline.

## Verification

80 focused authorization, request, scoped-processing, media, pagination, expiry and retry tests passed. Independent focused review confirmed the deadline-format and >100-parent regressions fixed. Live completion was verified through Firebase Auth absence, independent database receipts, private/profile/token absence, active Storage absence and preservation of all quarantined files. No physical-device verification, new APK, OTA, Hosting update or unrelated Firebase deployment is claimed.
