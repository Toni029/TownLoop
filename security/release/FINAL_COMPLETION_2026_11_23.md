# TownLoop v1.0.0 release checkpoint

Production Firebase project `cc-livingcommunity-app`. Release activity on November 23, 2026, for Android package `com.townloop.app`.

## Backend revisions

| Function | Verified revision | Change |
| --- | --- | --- |
| `submitSafetyReport` | `submitsafetyreport-00003-ren` | Distinct follow-up reports, existing moderation and maintenance protections |
| `getWorkOrderQueuePositions` | `getworkorderqueuepositions-00002-vow` | Revoked sessions and inactive profiles fail closed |
| `discardNewsletterDraft` | `discardnewsletterdraft-00002-ful` | Valid native PDF manifests and pre-fence Storage protection |
| `newsletterApi` | `newsletterapi-00010-lay` | Transactional analysis deduplication, including legacy job records |
| `requestAccountDeletion` | `requestaccountdeletion-00004-raj` | Transactional policy selection at intake |
| `submitAccountDeletionRequest` | `submitaccountdeletionrequest-00004-sul` | Same atomic intake for the current client and public page |
| `listAccountDeletionRequests` | `listaccountdeletionrequests-00003-dir` | Manager readiness reflects the receipt and processor flags |
| `reviewAccountDeletionRequest` | `reviewaccountdeletionrequest-00005-der` | Approval/retry requires executor readiness |
| `fulfillApprovedAccountDeletions` | `fulfillapprovedaccountdeletions-00009-hiq` | Activates the existing five-minute v3 timeout monitor |
| `processAccountDeletionJob` | `processaccountdeletionjob-00002-kax` | Activates Eventarc processing under the new receipt |
| `reconcileAccountDeletionUpload` | `reconcileaccountdeletionupload-00002-deh` | Activates generation-specific late-upload recovery |
| `cleanupDeleted_marketplace_posts` | `cleanupdeleted-marketplace-posts-00001-zah` | Retires listing previews in linked chats after individual deletions |

Deployed archive manifests matched the scoped candidates. Account-processing packages include `deletionScopeRules.json`. The two Phase 1 revisions and the newsletter analysis worker `runnewsletteranalysis-00005-qaj` remain in service. Firestore, legacy database and Storage rule releases remained identical. The Admin Database Cleanup writer and inventory receipt was verified at `2026-11-23T20:01:36.224187Z`.

## Account deletion and public wording

The v3 receipt uses Firestore server request time `2026-11-23T20:02:47.888Z`. Approval dispatches the processor and 30 full days of no decision authorizes the same processor. The 65-minute security drain, approved ownership and evidence safeguards, and resumable processing remain. Default Firestore TTL is active only on `account_deletion_jobs.v3ReceiptExpiresAt`, which applies to completed v3 receipts. Both historical jobs were unchanged at cutover, with their December 27 and 29 deadlines. No live deletion or Admin bulk purge was initiated as a test.

The privacy and deletion pages on both Hosting sites match the active policy. Hosting versions are `b29110b8d7a87df3` for `townloop` and `6148decd2067706e` for `cc-livingcommunity-app`. Only those two documents changed on each site.

## Android OTA and verification

The Android production branch and channel serve update `01a209f7-9147-7c38-bc07-205766db2c15`, group `87b02cda-e761-4c28-a0bf-f0b9b69dd452`. The installed versionCode 9 AAB and clean production snapshot match runtime `cb1537777d6277d7c0c4beab59024b02e5a0e911`. The signed AAB is version 1.0.0, target API 36. The update includes newsletter recovery/discard, medication Undo, recurring activity reminder isolation, Home layout changes, Work Order input placement, report feedback and community selection. Root and native TypeScript, the Android export, 548 native checks, 130 account-deletion checks, 42 focused Firestore scenarios and eight Auth/Firestore/Storage deletion scenarios passed. The four corrected public functions rejected unauthenticated requests. Newsletter API health returned HTTP 200.

## Retained safeguards and release gates

- Individual Storage deletion remains disabled. The current upload provenance pins and transactionally guarded reference writers must be aligned before enabling it. The Marketplace preview trigger contains no Storage deletion code. Its conversations and messages remain.
- Crew Marketplace inquiry QA reproduced a legitimate permission failure under the live quota rules. The tested rules candidate is outside this release because its new hash must be coordinated across account deletion, Database Cleanup, and newsletter draft discard.
- The retained November PDF, 81 chunks and three saved batches were preserved. Its last real analysis stopped on provider availability. No new inference was run against it. The durable retry, publish and draft discard flows passed using synthetic data.
- Admin cleanup remains manually initiated. The completed-ticket hourly policy, Expo notification handlers, upload reservations, and Cloud Tasks analysis remain enabled. Abandoned-draft sweeps, generic media expiry, and scheduled Inbox-history expiry remain outside the authorized v1 policy.
- Confirm Play-installed Google sign-in, push delivery and the corrected newsletter flow on a physical device. Code 9 eligibility on the Samsung and completion of the Play Console declarations still require verification before public release. No public rollout or AAB build was started.
