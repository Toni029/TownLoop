# Resident upload regression — November 18, 2026

## Cause and correction

The cleanup Storage guard added a third distinct Firestore document to valid native upload checks: global cleanup control, current user profile, and owned parent. Production Storage Rules permit only two document lookups. Both the local emulator and Rules REST test evaluator accepted the three-document expression; their success alone did not prove production compatibility. The evaluator's function-call trace established the three dependencies; the corrected trace uses at most two.

Sources: [Firebase limits](https://firebase.google.com/docs/rules/rules-behavior), [Firebase cross-service announcement](https://firebase.blog/posts/2022/09/announcing-cross-service-security-rules/).

Native media writes now check current approved profile and exact owned/live parent. Cleanup freezes each parent before removing files; late resumable finalizations are denied. The existing global Firestore reference guard still prevents new sharing. New files arriving between preview and freeze hold the root rather than expand its deletion scope. Parent locks are server-only under the default Firestore rules. Full-parent content hashes preserve manifest versions across the worker's lock-only metadata writes; unrelated content/evidence changes still invalidate the manifest. Retained/cancelled parents are unfrozen through guarded checkpoints. Newsletter Storage behavior remains unchanged; retired, unlinked legacy create paths are denied, with historical reads preserved.

## Focused evidence

- Nine emulator tests passed: Resident Discussion/Marketplace photos and videos; Work Order photos and Crew access; expired drafts; pending/wrong-owner denial; stale resumable finalization; parent lock release; lock-field forgery denial; committed-response retries; shared/evidence/generation and named-database reference preservation; new-file scope drift.
- Twenty Rules REST cases passed with no more than two distinct Firestore document dependencies (normal, frozen, pending and wrong-owner variants).
- Live rules hashes match reviewed sources. Existing cleanup job stays completed_with_holds, with its prior 13 post / 3 file deletions unchanged. No production cleanup action, upload test record, resident deletion or purge was executed.
- Physical Samsung upload has not been observed; the resident should retry the existing composer. No client code changed, so no OTA or binary is required.

## Deployment

Code commit: `1e66d09`.
Only `manageDatabaseCleanup` was deployed: `managedatabasecleanup-00008-gej`.

- Default ruleset: `f230af5d-c4d4-49bb-9b0b-9610740a0608`, SHA256 `3ad9f821760c8ce865776af9073c4a80981a231d19f6339494be90d49f97bbd9`.
- Storage ruleset: `397a8264-fa56-473f-9992-89b98936390e`, SHA256 `6f7eafaff08d489c2b130d6de9b8108f19b598e6789552f4698b129b46aac19a`.
- Cleanup receipt updated at `2026-11-18T16:43:30.750951Z`, exact function inventory digest `0a40db39571574aba0bd420531a8446db00c804f0ec18b35a32c54cc0af7a5aa`.

Legacy named deny-all rules, account-deletion policy/retention, original media provenance cutoff, other functions and IAM were unchanged. Cleanup remains enabled, with no active write lock. Read-only diagnostic artifacts remain ignored under `.release/resident-upload-fix/`. No GitHub push, OTA, native build or new service was performed.
