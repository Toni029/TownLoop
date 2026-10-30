# Approved-request processing activation

Owner instruction, 2026-10-30: fulfill verified resident deletion requests automatically after independent Admin/VIP approval. A request alone never authorizes destruction.

## Deployment boundary

`node functions/tools/prepare-deletion-processing.cjs` creates the isolated `.release/deletion-processing` source. Deploy only `fulfillApprovedAccountDeletions` using `firebase.deletion-processing.json`. It exports one five-minute worker; general orphan/draft cleanup, Inbox permanent-conversation cleanup, alerts, unrelated retention workers and notification senders are absent.

Activation requires all three explicit environment flags (`TOWNLOOP_AUTOMATIC_ACCOUNT_DELETION_ENABLED`, `TOWNLOOP_ACCOUNT_DELETION_ENABLED`, `TOWNLOOP_SCOPED_DELETION_ENABLED`) plus the server-only approved account/media policies. Live rules must match the verified hashes in `rules-manifest.json` and `deletionMediaProvenance.json`. The media cutover must match the actual Storage rules release timestamp. Drift stops processing.

## Per-request safety and progress

The worker validates the UID-bound request, independent current canonical Admin/VIP role, exact approval audit receipt and policy reference. It records a deterministic processing-authorization audit, preserves the human decision, and uses a six-minute lease against overlapping five-minute deliveries. Failures retain progress; ownership/provenance/evidence exceptions stop with `needs_review`, not endless destructive retries.

Access fences in both databases, Auth disable/revocation and directory removal precede destructive processing. The 65-minute existing-token drain remains mandatory. The already performed operator revocation can resume without restarting its original drain, but only after confirming disabled Auth and matching fences in both scopes.

Before destruction, each request gets a fresh inventory of both databases, private child-collection metadata and Storage object metadata. Unsupported schemas, ambiguous legacy identities, unknown private child collections, remote avatars without ownership proof, reported evidence, shared media references and quarantined files block affected processing. No guessed ownership or email/name matching is used. The six quarantined attachments are always excluded.

Supported content includes owned social posts/listings, own embedded comments/likes, verified legacy chat schemas, Inbox v3 memberships/authored messages/visibility, private profile data and notification tokens/state. Other residents' content survives. Necessary Work Order history is anonymized. A UID embedded in an older chat path requires reviewed relocation and cannot receive a false completion receipt.

Account-media cleanup is limited to that request's exact manifest and account-linked jobs. It rechecks parent state, both databases' remaining references, ownership, object generation/metageneration and trusted upload provenance. No global orphan cleanup or token revocation is enabled.

Both database completion receipts, finished media jobs and reconciliation are required before Auth deletion. The website authorization bridge is cleared before final Auth removal. Existing client account-cleanup proofs expire within the original 60-day window and support next-run cleanup; permanently offline devices cannot be remotely erased.

## Honest retention state

`retention_pending` means Auth/personal content removal has finished, with only explicitly retained minimal receipts/proofs and any anonymized maintenance history outstanding. The worker removes account-linked processing/review/media/device receipts and access fences at the original 60-day expiry; retries never extend expiry. No automatic 400-day exception is authorized. Backups remain under existing policies. Reported evidence requires documented disposition, not an invented retention period or false `complete` status.

Stop/recovery: disable the automatic worker's environment flag or pause its exact scheduler job. Do not remove access fences, recreate profiles, restore access or mark failed scopes complete. Resume only after addressing the recorded exception and independently rechecking the request's proof.
