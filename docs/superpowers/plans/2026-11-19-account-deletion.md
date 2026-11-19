# Simplified Account Deletion Implementation Plan

> Execute the owner-approved November 19 assessment in the current branch. Local implementation and synthetic verification only; no production access/mutation, deployment, OTA, binary build, push or historical-job migration.

**Goal:** Keep verified pending requests usable; immediately dispatch approved deletion; authorize undecided requests at submittedAt + 30*24 hours; support documented invalid-request rejection/reapplication and truthful progress.

**Architecture:** Preserve the existing scoped deletion engine and shared cleanup coordination. New requests use workflowVersion 3 and an independent requestId. Approval and timeout produce explicit server authorization (never a fabricated Admin review). A thin Firestore job-change processor starts/continues deletion; the existing schedule only authorizes overdue pending v3 requests. Legacy jobs, including the two retention_pending requests, are outside these paths.

**Approved spec:** User's November 19 implementation request and preceding accepted read-only assessment.

## Contracts
- New request: workflowVersion:3, requestId, createdAt/submittedAt, autoDeleteAt, status:'requested'. Repeated pending submit does not move the deadline. Reapplication after rejection creates a new generation.
- Authorization: {source:'admin_approval'|'pending_timeout', policyReference, requestId, authorizedAt, actorId?}. Timeout also binds the original autoDeleteAt. Decision races use a transaction.
- Rejection: documented reason/category; private persistent accountDeletionNotice on the resident profile; no disabling pending/rejected users.
- Existing review/status/list function names stay compatible. Admin list includes processing/retrying/failed/complete, not only canReview rows.
- Runtime configuration stays disabled until separately approved deployment/policy cutover. V2 historical jobs are never claimed by the new monitor/processor.
- Existing 60-day historical deadlines remain unchanged. New personal-data completion is not gated on receipt expiry. Any retained operational evidence must be disclosed and not reported as unresolved-data erasure.

## Work
- [x] Write failing lifecycle/race/historical exclusion tests, implement v3 authorization and generation transitions.
- [x] Adapt review API and immediate event entry; reuse core scoped executor with bounded continuation and safe retries.
- [x] Correct data adapters (Inbox receipt keys, UID references, notification/profile/media exceptions); keep other users' content and evidence protected.
- [x] Investigate safe replacement of token drain with current-rule fences and upload completion protection; retain fail-closed behavior if proof is unavailable.
- [x] Adapt resident/Admin screens and persistent rejection notices; update only deletion/privacy wording.
- [x] Fix packager dependency closure including deletionScopeRules.json; validate in temporary test directories, no release artifact generation.
- [x] Run focused Node/client/type checks and synthetic Auth/Firestore/Storage integration/security tests.
- [x] Review combined diff, preserve unrelated dirty files, document rollout, limitations and test evidence.

## Verification ledger
120 focused backend checks (115 combined plus four event-dispatch checks and one additional stale-package guard); eight real Auth/Firestore/Storage emulator scenarios; 29 focused native checks and TypeScript (see final run results). Security drain retained after upload-fencing investigation. Detailed cutover and limitations: security/account-deletion/SIMPLIFIED_WORKFLOW_2026_11_19.md. No production operations.
