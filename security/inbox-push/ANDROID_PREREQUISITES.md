# Android Preview prerequisites — 2026-10-27

No Firebase configuration/deployment, build, push, OTA, resident-data change or notification delivery performed.

## Google owner steps (the remaining Android build blocker)

The provider is enabled and the existing web OAuth ID is correct. Read-only Firebase configuration has zero SHA registrations and zero Android OAuth clients. Sign-in stays OFF (`androidOAuthRegistered=false`). No new service account, private key or OAuth secret is needed for these steps.

1. Open [Firebase project settings](https://console.firebase.google.com/project/cc-livingcommunity-app/settings/general), select Android **com.toni029.townloop** (app ID `1:883715389126:android:9be9bbe73fece14e27c9c7`), choose **Add fingerprint**, and register both public signing fingerprints:

   SHA-1: `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`

   SHA-256: `FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C`

   Both were freshly exported from the existing EAS Preview keystore certificate and matched against the signed installed-build artifact using apksigner. No signing identity was changed.
2. Check [Google Cloud OAuth credentials](https://console.cloud.google.com/apis/credentials?project=cc-livingcommunity-app). Confirm an **Android** client matches that package and SHA-1. Firebase may generate it after the fingerprint is added; create only the missing matching Android client if needed. Keep the existing **web** client `883715389126-m7620ld4hl03bqh861vmj21vkjc60rfc.apps.googleusercontent.com`. Do not replace the web login, create another Firebase project, or copy a client secret into the app.
3. Download the refreshed `google-services.json` from that Firebase Android app. Save it to ignored `native/credentials/google-services.preview.json` with private file permissions. Update the existing **Preview-only** EAS `GOOGLE_SERVICES_JSON` file variable with the same file. Do not edit Production/development variables, paste it into chat, or commit it.
4. Run the read-only `node native/scripts/verify-google-android.cjs`. Repeat the scoped read-only live certificate/client check, then enable the local Android readiness flag only if both checks agree. The config plugin now rejects an enabled Android provider with a missing/wrong project, app, package, SHA-1 or existing web client. It never enables the flag itself. Existing consent, approved=false resident registration, canonical roles, session isolation and email/password login are unchanged.

The validator currently fails as expected on the old SDK file. Google login is therefore **not configured/ready yet**, and another APK must not be advertised as Google-ready before completing these steps. These console changes need owner action/authorization; none was made here. iPhone prerequisites are prepared alongside Android; see PLATFORM_PREREQUISITES.md.

## Focused verification completed

- Default Firestore published rules exactly match the local baseline: SHA-256 `e77833f481a6ccbaf72b586e1cc580b178deb9a069a26e6a95b491ade65d935e`.
- Java 21 was installed as a local test tool only. Six emulator tests passed against the exact optional reply candidate: compile, all canonical roles, parent/index/author/history validation, pending/anonymous denial, numeric legacy comment IDs, unchanged Marketplace/original-web comments, and notification metadata client denial even for Admin.
- Actual Firebase Admin SDK transactions and aggregation queries passed for Private Inbox, Marketplace, Discussion comments/direct replies and Work Order Done. Mocked Auth identity and Expo transport only; no Auth users or live deliveries. Multiple devices, self-notification suppression, retry deduplication, blocking, generic opaque payloads, recipient-only resolution and read acknowledgments passed.
- Firestore-native emulator does not enforce composite indexes. The two query shapes were checked against the index candidate and exercised in the emulator. Read-only live index metadata confirms **both notification indexes are missing**; 11 unrelated existing indexes remain unchanged.
- Google configuration and isolated deployment-scope fixtures passed. Existing native/signup/security tests are reused, not rerun broadly. These are local checks, not physical Google/FCM delivery verification.

## Exact safe Firebase deployment requiring approval

**Stage A (non-delivery prerequisites only):**
1. Create only the two missing `notification_events` indexes from `notification.indexes.json`; wait for READY before relying on badge/count/ack queries. `.release/notification-registration/index-create-requests.json` contains only the two additive API requests, no deletion request. Re-list and skip already-matching indexes on retry; preserve every other index and all TTL/backup settings.
2. Optionally deploy the emulator-tested default-only reply metadata candidate, after confirming the current default rules hash still matches the recorded baseline. The candidate preserves unrelated rules byte-for-byte after reversing only the optional discussion patch. Dedicated config: `.release/notification-rules/firebase.json`. No named database, Storage or Hosting is present. Keep `DISCUSSION_REPLIES_ENABLED=false` until this candidate is actually deployed and reply capability is separately approved.
3. Deploy only `registerInboxDevice` v2 and `getNotificationState` from `.release/notification-registration/firebase.json`. The deployed v1 registration callable is ACTIVE and does not need repair; this is its required category-preference upgrade. Both keep Firebase authentication, approved account ownership, device capability, blocking and recipient-only state checks. No sender, Eventarc subscription, scheduler, deletion processor or cleanup worker is exported. Prepared environment is `INBOX_PUSH_ENABLED=false`, empty `PUSH_TESTER_UIDS`, `DISCUSSION_REPLIES_ENABLED=false`.

Approved execution would use explicit allowlists (not executed):

```
node security/inbox-push/prepare.cjs registration
firebase deploy --project cc-livingcommunity-app --config .release/notification-registration/firebase.json --only functions:registerInboxDevice,functions:getNotificationState
firebase deploy --project cc-livingcommunity-app --config .release/notification-rules/firebase.json --only firestore:rules
```

Index creation precedes callables. Reply rules can precede or follow the callables while the reply capability remains false; approving/enabling reply capability is distinct from enabling push sending. On any failure stop. Rollback only the affected client/callable to a secure checkpoint; never restore public access, remove unrelated rules, delete data, or activate cleanup.

**Held Stage B:** `node security/inbox-push/prepare.cjs events` creates `.release/notification-events/` with exactly `notifyInboxFriend`, `notifyInboxOffice`, `notifyInboxMaintenance`, `notifyInboxMarketplace`, `notifyDiscussion`, `notifyWorkOrderDone`, all default OFF. No receipt scheduler is included. Do not deploy or activate this package without separate approval. Physical tester-only sending additionally requires both the server sending flag and a nonempty tester-recipient allowlist. Resident-wide delivery and receipt scheduling are not approved.

## Consolidated Android build

The next clean managed Preview source includes the exact original native fade/scale from `7ae4520`, neutral splash/fallback, source-compiled startup Bluetooth patch, Google SDK, expo-notifications, four-category settings/routing, and unchanged Firebase protections. Existing signing and `preview` channel remain. Current installed runtime is `00add22145e025fb9329377ce1a2d9d6ecdaf393`; do not force the corrected candidate into it. Final new fingerprint must be established after the refreshed Google config is supplied. Older runtime updates cannot override a different fingerprint.

Google configuration and approval of Stage A are outstanding; **not yet ready to build the complete requested APK**. Native compilation and physical sign-in/push testing still require the separately approved build. Preserve the stale ignored native directory; use a clean managed release checkout. Upon build approval, submit once with `native/scripts/submit-build.cjs`, immediately open the returned exact Expo build page in the default browser, show the clickable link, and stop—no polling, cancellation or restart.


Current iPhone-first and Android-parity gates: [PLATFORM_PREREQUISITES.md](PLATFORM_PREREQUISITES.md).
This supersedes earlier platform sequencing; neither platform is considered Google-ready until its real configuration passes.
