# Marketplace authorization release checkpoint

Production project `cc-livingcommunity-app`. Only the default Firestore rules release was changed.

The live baseline intermittently denied legitimate atomic Marketplace inquiry writes under quota enforcement. The emulator reported a document-access limit while resolving the quota configuration. The repaired chat rules read the approved actor and cleanup control once, check the matching atomic quota proof before the fallback, and read the fallback configuration only as needed. Membership, both directions of blocks, sender identity, listing ownership, prior quota counters, and global, category and record cleanup fences remain checked.

| Component | Published version |
| --- | --- |
| Default Firestore ruleset | `ab2f200e-947c-4622-bc66-283da7fb3963` |
| Default rules SHA-256 | `131cd432198c5d70c331480658d0409b7c21f3b78fe73fe965eab4245bc79bc6` |
| `manageDatabaseCleanup` | `managedatabasecleanup-00011-tom` |
| `processAccountDeletionJob` | `processaccountdeletionjob-00003-yej` |
| `discardNewsletterDraft` | `discardnewsletterdraft-00003-sis` |

The release used generation-pinned source archives, preserving service identities, private event invocation, packages and settings. The cleanup inventory receipt includes the account-deletion event and late-upload recovery revisions. The Cleanup and account receipts were updated together at `2026-11-23T20:43:27.025794Z` with the exact published hash. Both approvals, the named deny-all and Storage rules, the 30-day account policy, the two historical jobs, and the November PDF and analysis job were preserved. Dataset cleanup and account erasure were not invoked for testing.

The compatibility functions recognize only the two reviewed Firestore hashes. Destructive default Firestore processing requires the deployed rule hash and both live receipts to agree. The previous ruleset was `ed3d7ce9-9461-4bda-9e2f-c570dfa57525`. Any rollback must verify the current jobs and locks and coordinate the previous default ruleset and both receipts together.

## Verification

- Market inquiry rule tests exercised the exact live baseline and candidate using the client protocol. The candidate passed the 12 role/quota-mode combinations and four scenarios covering private reads, replies, existing threads, duplicate requests, blocks, revocation, missing quota proofs, and cleanup fences.
- Root TypeScript and 13 rule-pin, ownership-attestation and coordination checks passed. The combined Auth, Firestore and Storage run passed 50 account deletion, cleanup, Work Order retention, moderation, newsletter recovery and client permission checks.
- Android versionCode 9 already uses the matching atomic quota protocol. Existing Production runtime `cb1537777d6277d7c0c4beab59024b02e5a0e911` can use this backend. No AAB or OTA was made for these changes.

## Individual Storage cleanup remains disabled

The existing per-record upload proof does not fence every writer that can introduce a reference from another document. Examples include private Marketplace preview records, profile avatar URLs and attachments on other posts. An immediate reference scan and GCS generation checks do not prevent a concurrent reference to the same unchanged object.

The current Admin bulk cleanup owner can hold reference writes across both databases until ambiguous Storage results are resolved. A routine automatic cleanup trigger cannot safely release this shared lock when Storage has not confirmed the outcome. Allowing it to expire could race with a delayed delete. The existing cleanup Storage role also lacks metadata update permission for a generation-conditional invalidation attempt, which itself would be unavailable during a provider outage. Nine focused reference and concurrency checks and two strict upload/finalization tests support the current protections. They do not establish an object-local production fence.

Marketplace preview retirement remains live as `cleanupdeleted-marketplace-posts-00001-zah`. It preserves buyer/seller history. No individual Storage deletion trigger or flag was enabled.
