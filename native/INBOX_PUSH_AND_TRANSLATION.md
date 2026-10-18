# Translation and Inbox push — local preparation

Recovery: tag `local/pre-translation-push-20261016`, commit `65242ee`.
No Firebase deployment, credential upload, build, GitHub push, or OTA publication performed.

## Translation

Native previously used only a phrase dictionary. It now calls authenticated `/api/translate`, keeps title/body/comment translations in memory, and preserves original Firestore text. Admin/VIP/Crew only, enforced on client and server. Loading, timeout and retry errors replace silent dictionary results.

The existing server uses Google Translation when configured, otherwise server-only Gemini (`gemini-3.1-flash-lite`; override with `TOWNLOOP_TRANSLATION_MODEL`). A live synthetic title/body translated successfully. The first 2.5 Flash probe failed and 3.8 Flash timed out; the smaller model is the default. No resident data was used and no client key was added.

**Phone activation pending:** host/restart this Express service behind HTTPS, keep GEMINI_API_KEY server-only, and set `EXPO_PUBLIC_TOWNLOOP_API_URL` for native. No public API URL is configured in this checkout. The updated local service is running on localhost:3000 (unauthenticated requests correctly return 401); a phone cannot use that localhost address. Translation alone is OTA-compatible after backend activation.

## Push architecture

- SDK-compatible expo-notifications/config plugin; existing Firebase project, package, signing, update channels and fingerprint policy preserved.
- Permissions on Android/iOS, token registration after approved sign-in, refresh on foreground/token rotation, status/retry in Profile → Account. Browser retains existing in-app notifications.
- Authenticated callable `registerInboxDevice` assigns a hashed Expo token to its signed-in UID in server-only `notification_devices`. A token has one owner across shared-phone accounts. Logout revokes it before signing out; offline revocation reports an error instead of leaving the old account subscribed.
- Auth-context Firestore triggers `notifyInboxFriend`, `notifyInboxOffice`, `notifyInboxMaintenance` watch existing `resident_chats`, `office_chats`, `maintenance_chats` message arrays. They validate the real author/profile, ignore read receipts, replayed IDs, deletion and Admin SDK/system writes.
- Office alerts: Admin/VIP and that conversation's resident; Maintenance: Crew and that resident. Sender excluded. Other staff in a shared staff chat also receive replies. Friends: actual participants only. Marketplace inquiry chat is outside these three Profile Inbox categories and unchanged.
- `notification_deliveries` holds deterministic message/recipient/device claims, preventing duplicate sends on trigger retries. Ambiguous send failures are marked `unknown`, not blindly retried: a rare crash/network ambiguity may lose an alert, while the Inbox message remains intact. Push transport never guarantees delivery.
- `checkInboxPushReceipts` checks every 15 minutes and removes DeviceNotRegistered tokens. `delivered` means accepted by APNs/FCM, not read by a person. Review `unknown`/`rejected` records when troubleshooting. Claims are retained against replay; no automatic ledger deletion was added.
- Lock screen always says “TownLoop — You have a new Inbox message.” No sender, subject or body. Android private visibility; foreground banners suppressed to preserve existing in-app unread behavior.
- Taps open the existing conversation after authentication/community selection. Other-account taps are ignored; deleted/inaccessible chats show the existing unavailable state.

## Activation requires separate approval

1. Review/deploy proposed rules **together with the updated web friend-chat query**. The original web query reads every conversation and would be denied by the new private rules. Membership stays unchanged; no historical messages are deleted or migrated.
2. Deploy the callable, three triggers and receipt scheduler in the existing Functions codebase; preserve retention. Verify a real Preview message supplies Firebase Auth context. Triggers fail closed without an authenticated UID. Eventarc/Functions/Scheduler may incur charges.
3. Android: supply `GOOGLE_SERVICES_JSON` as an EAS Preview/development file variable for the existing Firebase Android app `com.toni029.townloop`. Config validates project/package and blocks EAS Android builds without the file. Configure FCM v1 sending credentials in EAS; never bundle a service-account key.
4. iOS: configure APNs credentials/provisioning in EAS for existing `com.toni029.townloop`. Apple developer access is required.
5. Build a **new Preview Android APK and iOS build**. This combined change cannot be OTA-published to the old APK because expo-notifications is a new native module. Keep fingerprint runtime compatibility enabled.
6. On devices, use two test accounts to verify foreground unread behavior, background/closed alerts, tap routing, role isolation, denied permissions, shared-phone logout and delivery receipts. Android force-stop, battery restrictions, notification settings and Do Not Disturb may suppress alerts.

## Local verification

Focused authorization and routing tests; disposable Firestore emulator checks of creation, staff reads/replies, friend queries, receipts, forgery/ownership rejection, token protection and deletion; synthetic live Gemini translation. Native TypeScript and focused lint results are in the final report. No live Firebase writes or physical-device push tests. No builds requested or run.

## Deferred for compatible Preview OTA

The push-notification client integration is preserved at Git tag
`recovery/push-preparation-f31dc54` (implementation commit `59fbd12`).
Its native dependency, plugin, and client wiring were removed from the active
branch so weather updates can reach the existing Preview APK. Backend setup
remains prepared only, not deployed. Restore the client portion of `59fbd12`
when the user authorizes the next native build; do not override runtime hashes.
Translation still needs a deployed HTTPS service URL for physical phones;
the local localhost:3000 service is for browser development only.

## Hosted Google Translation (October 17, 2026)

The native client now defaults to the HTTPS Firebase `translateWorkOrder` endpoint
in `cc-livingcommunity-app`, region `us-central1`. It sends the current Firebase ID
token; the function checks revocation and reads the existing user role before
calling Google Cloud Translation. Admin, VIP and Crew are allowed; residents are
denied. No ticket writes occur. The API key is stored in Secret Manager as
`TOWNLOOP_GOOGLE_TRANSLATE_KEY`, never in the bundle. Optional endpoint override:
`EXPO_PUBLIC_TOWNLOOP_TRANSLATION_URL` (not an API key).

Only this function is deployed for translation. Push-notification functions remain
deferred. The client change is OTA-compatible with the existing Preview APK.
