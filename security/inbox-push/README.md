# Native Inbox push — local implementation, no service/app deployment

Scope: default Firestore database in `cc-livingcommunity-app`, Expo project `9f970d26-beed-44d6-a590-9dcdc00e85de`, Android/iOS application ID `com.toni029.townloop`. Original website and its named database are unchanged. No deletion, cleanup, moderation or Admin escalation worker is exported by the isolated package.

## Behavior

- Existing `resident_chats`, `office_chats`, `maintenance_chats` and Marketplace Inbox message arrays are monitored with authenticated Firestore write context. Only an authenticated author's single immutable-tail append qualifies. No historical backfill, receipt, edit, deletion or system-leave alert.
- Canonical approved participants/staff only; disabled/deletion-pending profiles, revoked Auth identities, either-direction blocks and Marketplace leave markers suppress sends. Office/Crew chats retain existing shared team membership; direct Office messages already use resident_chats.
- Each opted-in installation/account registers its Expo token through an authenticated callable; database clients cannot read/write notification collections under existing rules. Token ownership transfer requires the protected installation capability. Multiple devices are independent.
- Opt-in switch is inside Profile → Mail (Inbox), on this device. No launch-time permission prompt. Android channel is created before Android 13 permission/token acquisition; iOS requests alerts/sounds. Denial never blocks navigation.
- Tokens, per-account preference and installation capability use device-only SecureStore. Logout/account switching attempts server revocation and native FCM/APNs deregistration; failed server revocation is retained encrypted for retry. Account deletion already removes server device documents, while local deletion cleanup clears the preference on next client execution. A permanently offline device cannot be remotely erased. An already accepted, generic OS alert cannot always be recalled.
- Registrations expire logically after 60 days without renewal. Renewal occurs on app launch/resume/token change. OS permission revocation is discovered at next resume, or invalid-token receipts; permission changes while the app is closed are controlled by the OS.
- Per-message/per-device claims prevent retry duplicates. Generic title/body only; payload has category, conversation ID and an account-bound opaque device binding, no message body, recipient UID, name, photo or Expo token. Taps wait for approved authentication and a fresh server-authorized conversation read. Wrong-account taps cannot open a chat. Foreground uses exactly one Expo notification handler; no parallel in-app banner.
- Delivery claims have a 60-day expiry. Configure Firestore TTL on `notification_deliveries.expiresAt` and `notification_devices.expiresAt` separately after approval; no TTL or retention configuration changed here. Idempotency also refuses events older than one hour, so expiry cannot replay old sends. The receipt checker processes bounded batches and removes only the matching expired device. No resident files are touched.
- Receipt status `delivered` means the provider accepted delivery, **not proof the phone displayed it**. Network-ambiguous sends are `unknown`, never automatically replayed (the Expo API cannot guarantee exactly-once delivery). Provider rejection remains recorded with a sanitized code. Inbox/unread state remains authoritative. Force-stop, OS battery restrictions, DND and network loss can delay/prevent system alerts.

## Credentials / build prerequisites

1. Register the existing Android package with the existing Firebase project if not already registered; supply its real `google-services.json` as the **EAS file environment variable `GOOGLE_SERVICES_JSON`**, for each intended EAS environment. The config plugin validates project/package and refuses Android EAS builds without the file. Do not commit credentials. Android registration and Preview credentials were subsequently prepared; see [credential status and owner steps](./CREDENTIAL_STATUS.md).
2. Configure **FCM HTTP v1** sending credentials in EAS for this Expo project (least-privilege Firebase Cloud Messaging API Admin service account credential), plus enable the FCM API where required. Obtain owner approval before creating credentials/IAM changes. Android client JSON is not a substitute for the server sending credential.
3. Apple Developer team membership, matching App ID, Push Notifications capability, valid APNs `.p8` key (key ID/team ID) stored through EAS credentials, and provisioning that includes `aps-environment`. The expo-notifications plugin prepares the entitlement; EAS signing must supply the correct distribution environment. Visible alerts do not require background JS/silent-push capability. Apple credentials remain pending owner login; see [credential status and owner steps](./CREDENTIAL_STATUS.md).
4. Optional Expo enhanced push security: enable it for the Expo project and provision server-only `EXPO_ACCESS_TOKEN` securely to **all Inbox send/receipt functions**, never client configuration or Git. If unavailable, leave enhanced security off until coordinated. Do not paste credentials into chat.
5. Both Android and iOS require **new native builds**: expo-notifications and expo-crypto were added using SDK-compatible Expo versions. This is not a d6-runtime OTA. Preserve fingerprint policy; new builds establish new exact runtimes. Preserve existing signing and Preview/Production channel separation. No binary was built here.

## Exact safe rollout — approval required, not executed

1. Approve code/credentials scope, then push the local commit. Keep all existing destructive workers and Admin escalation delivery disabled.
2. Run `node security/inbox-push/prepare.cjs`. This only creates `.release/inbox-push/` with the Inbox functions. Install its locked dependencies in the isolated artifact. Never deploy the full existing functions index.
3. Deploy **only** `functions:registerInboxDevice` from that isolated Firebase configuration to project `cc-livingcommunity-app`. Verify unauthenticated registration denied, protected revocation, approved ownership, and cross-account rejection with approved test identities. Existing Firestore deny-all notification collection rules need no change.
4. After separate approval, configure credentials above and build one Android Preview and one appropriate EAS iOS test binary. No OTA can add the native modules to old binaries. Confirm exact build runtime/channel and manifest/entitlement/FCM packaging. Any future OTA must match each new build's exact fingerprint; do not override runtime safety.
5. Enable notifications on explicitly authorized test devices/accounts; no resident test accounts created here. Deploy ONLY `notifyInboxFriend`, `notifyInboxOffice`, `notifyInboxMaintenance`, `notifyInboxMarketplace` and `checkInboxPushReceipts` using the isolated config and an explicit named `--only functions:...` list. `INBOX_PUSH_ENABLED` defaults OFF; deploy disabled first. The new Marketplace export is part of Inbox scope, not the hosted web database.
6. With approval to send only to designated testers, enable `INBOX_PUSH_ENABLED=true` in the scoped functions' server environment and verify physical devices using the checklist below. The sending flag is service-wide: do not opt in residents before testing approval. No scheduled Admin alerts, deletion or cleanup is activated. Receipt checking is delivery maintenance only and needs explicit deployment approval.
7. Roll out Preview clients to residents only after those checks. Production/App Store/Google Play require separate approval. Optional TTL activation is a separately approved bounded notification-metadata expiry, not resident-content cleanup.

Example deployment from the generated artifact (not executed):

```
cd .release/inbox-push
firebase deploy --project cc-livingcommunity-app --config firebase.json --only functions:registerInboxDevice
# Later, after the separately approved credential/build/test gates:
firebase deploy --project cc-livingcommunity-app --config firebase.json --only functions:notifyInboxFriend,functions:notifyInboxOffice,functions:notifyInboxMaintenance,functions:notifyInboxMarketplace,functions:checkInboxPushReceipts
```

Emergency stop: redeploy only these Inbox functions with `INBOX_PUSH_ENABLED=false`. Keep Inbox reads/writes/authentication/security rules intact; do not restore public access. Do not deploy/delete unrelated functions. The isolated codebase is `default` intentionally so existing function identities are not moved; always supply the explicit function allowlist to avoid unrelated deployment/deletion prompts.

## Verification / remaining physical-device matrix

Local fixtures exercise actual registration/delivery/receipt entry points with an in-memory database, mocked Auth and mocked Expo transport; no live pushes or resident reads. Routing fixtures cover unauthenticated/cold-start deferral, wrong-account binding, unauthorized chats and account switches during authorization. Typecheck and Expo config/plugin checks cover both native configuration paths without compiling.

Still required on **real Android + iPhone** with approved test identities and push credentials: A→B (A receives nothing), multiple B devices, foreground/background/ordinary swipe-away closed launch, tap into exact chat, authenticated cold launch, permission denied/off/on, OS settings revocation, logout/account switch, block in either direction, token rotation/expiry and network errors. Include Friend, direct Office, shared Office/Crew and Marketplace Inbox. Denied reads must show no private thread. Capture no message contents/tokens in test reports. No physical delivery, native compilation or APNs/FCM credential validity is claimed by local tests.

Notification transport adds Expo Push Service alongside FCM/APNs. Update the unpublished privacy/Data Safety release disclosures to describe generic push payloads, device tokens and account-scoped preferences before store release; do not claim end-to-end encryption or guaranteed delivery. Existing policies have not been published or rewritten here.

## Focused verification recorded locally

29 fixture checks passed: 13 backend recipient/registration/delivery/receipt checks, 6 native routing/device-lifecycle checks (including executing the actual device module against mocked native boundaries), and 10 existing account-cleanup regressions. TypeScript passed. Expo introspection produced the notification plugin and iOS push entitlement. Android credential validation rejected missing/mismatched files and accepted a synthetic matching fixture; no real credential was used. The six-function isolated export/default-off guard check passed without database or transport access.

Primary integration references: [Expo Notifications API](https://docs.expo.dev/versions/latest/sdk/notifications/), [Expo push transport and credentials](https://docs.expo.dev/push-notifications/sending-notifications/), [Firebase authenticated Firestore event context](https://firebase.google.com/docs/functions/firestore-events).
