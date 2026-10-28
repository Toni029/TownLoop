# Android approved-user delivery and iPhone credential gate — 2026-10-28

## Approved scope

The owner confirmed all four categories on their Samsung and approved expanding Android
sending to approved TownLoop accounts. This is notification delivery configuration, not
a Firestore/Storage rule change. No historical replay, direct test send, account-deletion
worker, receipt scheduler, Hosting change or named-database operation is included.

Only the existing six default-database event functions are deployed. Required settings:

```
INBOX_PUSH_ENABLED=true
PUSH_RECIPIENT_SCOPE=approved
PUSH_TESTER_PLATFORMS=android
DISCUSSION_REPLIES_ENABLED=true
PUSH_DIAGNOSTICS_ENABLED=false
```

`PUSH_TESTER_PLATFORMS` retains its existing name for compatibility; it independently gates
platforms in both rollout scopes. Missing recipient scope preserves tester-only behavior;
unknown scopes fail closed. Approved scope does not bypass the delivery engine's canonical
approval, Auth validity, conversation ownership/membership, blocking, read suppression,
category preferences, token expiry, account binding or duplicate-claim protections.
Only devices with valid registrations can receive notifications. Old clients without native
notification support need a compatible binary. Work Orders currently notify completion,
not every status change. Category choices are not reset by this backend rollout.

## Recovery

Disable sending (`INBOX_PUSH_ENABLED=false`) on these six functions, or restore
`PUSH_RECIPIENT_SCOPE=testers` with the previously verified tester UID held in the restricted
local deployment environment. Preserve `PUSH_TESTER_PLATFORMS=android`. Do not change security
rules or grant public database access. No rollback requires deleting resident data.

## iPhone: implemented locally, not activated

Shared client code already provides native authorization, four preferences, APNs entitlement,
registration/revocation, generic payloads, foreground presentation, badges and authorized
notification navigation. Five focused credential/simulator fixtures passed on 2026-10-28.
This is not an iPhone build or device-delivery verification.

The owner does not yet have paid Apple Developer membership. To test real iPhone delivery:

1. Enroll the owner in Apple Developer Program and select the appropriate team.
2. Configure explicit App ID `com.toni029.townloop` with Push Notifications capability.
3. Use EAS credentials for the `preview` profile to reuse or create the team's APNs key,
   distribution certificate and provisioning profile. No private keys/passwords in chat or Git.
4. Register a consenting test iPhone for ad-hoc Preview, or separately approve TestFlight setup.
5. Approve one signed iOS Preview build. Submit once; immediately open its exact Expo build
   page in the owner's default browser. Do not poll cloud compilation.
6. Verify packaged entitlement, runtime, permissions, navigation and registration on that iPhone.
7. Approve tester-only iOS delivery before broader iOS activation. The current global Android
   scope must not accidentally enable all iPhones when a platform is added: first use the
   explicit tester scope for both platforms, or implement a separately tested per-platform
   audience gate before preserving global Android delivery alongside iOS testing.

No new Android APK/OTA is needed for this backend scope change. iOS requires its own signed
binary and APNs credentials; Android device success does not verify iOS delivery.
