# Scoped compatibility activation — awaiting approval

Continue checkpoint `9012749`; this is an access/request protocol repair, not activation of the full security release.

Target: Firebase **cc-livingcommunity-app**, Firestore **(default)**, Functions **us-central1**, existing **work-order-retention** codebase. Native configuration explicitly matches this project/database. Preserve Hosting site **townloop** and named database **ai-studio-cclivingv27-5fc1a0f6-cd75-4964-8c9e-e219a265f7bb**. Preview/Production use shared Firebase data; only Preview client publication is approved by this proposed scope.

## One approval scope, in order

1. Push the reviewed local checkpoints to existing `native/expo-migration`. Immediately before activation, retrieve only deployed rules/function configuration, save a restricted rule export, and stop if the rules differ from `security/c1/firestore.console-baseline.rules` or function database settings point outside `(default)`. No resident documents or messages are needed.
2. Deploy ONLY the two request-only callable exports. The legacy name is updated to reject obsolete request payloads rather than disable accounts; the distinct new name prevents a new client from reaching an old destructive handler. Both require recent authenticated identity verification and create the same deterministic durable queue record. Retries cannot enqueue duplicates.

```sh
firebase deploy --project cc-livingcommunity-app --config firebase.release-backend.json --only functions:work-order-retention:requestAccountDeletion,functions:work-order-retention:submitAccountDeletionRequest
```

3. Activate ONLY the reviewed compatibility rules file (hash-bound in `client-compatibility-manifest.json`). It restores approved-role directory reads, exact-UID Inbox access, immutable message history, own receipt cursors, own block reads, Admin/VIP moderation reads and bounded owner profile proposals. All unrelated published rules, including the current Marketplace rule, remain unchanged. This candidate does NOT claim to resolve the still-pending full security rollout/C1 vulnerability; do not ship Google Play on that basis.

```sh
firebase deploy --project cc-livingcommunity-app --config security/release/firebase.client-compatibility.json --only firestore:rules
```

4. Publish the reviewed UI/protocol fix to **Preview only**, using the existing runtime-aware publication workflow. Check the installed Preview binary runtime against the proposed update before publication; stop on mismatch, never force an old runtime. No native modules/configuration changed in these fixes, so no APK rebuild is planned. Production publication remains excluded.

```sh
cd native
npm run update:preview -- "Approved access and request-only deletion compatibility fix"
```

5. Owner verifies access and medication/Profile UI on the installed Preview app. Use mocked/local contexts for unauthorized-access checks; no private resident messages or account-deletion smoke requests without a separate test-data approval.

## Deletion processing boundary

Deploy request acceptance only. **Do not deploy or enable `resumeAccountDeletions`, media cleanup, retention jobs or deletion triggers.** New jobs remain `requested`, with no immediate Auth disable/signout, profile freeze, directory removal or local medication erasure. Confirm no existing worker consumes `requested` jobs before accepting requests; if one exists, stop rather than silently activate deletion. Existing policies and job records are not modified by this release. Queue receipts remain durable for later approved processing.

Actual destructive processing, supported 60-day retention expiry and confirmed-final-deletion device-local cleanup remain a separate release gate. Do not represent this request-only rollout as completed Google Play deletion-policy readiness. Public deletion page source uses the safe new endpoint, but publishing any page is excluded because Hosting must remain unchanged.

## Recovery

Never restore the pre-fix deletion handler or a pre-security OTA. Keep the request-only callables; if necessary stop new requests with a fail-closed callable while preserving queued jobs. Repair forward or republish only a runtime-compatible Preview update using the safe endpoint. If rule recovery is necessary, deploy ONLY Firestore from `firebase.readonly-recovery.json` (not its Storage entry): restricted reads, client writes denied. Expect temporary unavailability; never restore public Marketplace access as rollback. No record restore, history rewrite, counter reset, policy activation or Storage change is authorized. Reopening writes requires a reviewed fix and approval.

## Evidence reused

Nine local emulator role/messaging/profile checks passed at `9012749`; unchanged rules content reused. Twelve focused deletion tests pass after the distinct endpoint regression test (red before alias, green after). Native TypeScript and public-page syntax verified. No real-data migration/read, deployment, OTA or APK build performed during preparation.
