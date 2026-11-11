# Immediate notification switches — 2026-11-10

## Confirmed causes

The controlled Switch value changed only after secure storage, then a full permission/device registration/network/badge refresh. One global busy flag disabled all four controls and discarded further taps. Per-category read/modify/write storage also raced: a concurrent-field regression lost one selection before this fix.

## Local correction

The existing native Switch updates immediately with its requested boolean. No layout, color, navigation or animation redesign. An account-scoped coordinator separates durable local saves from background network sync and coalesces rapid changes to the latest snapshot. Untouched preferences survive initial hydration, newer selections survive stale refreshes, and disposed account controllers cannot update another account. All category/default writes use the same account-local write queue.

Local-write failure restores the last durable choices; load failure overwrites nothing. Network failure retains local intent and explicitly labels sync unconfirmed. Reopening Notifications, resuming TownLoop or another tap retries. Offline selections are not claimed to be saved in Firebase. Existing OS permission prompts/defaults, denial handling, recipient authorization, channels, badges and category preferences remain enforced.

## Server ordering safeguard

A callable timeout does not prove its server operation stopped. Each registration/removal now carries a securely persisted, installation-scoped monotonic clientRevision. The existing registration transaction checks it after approval/ownership/capability authorization. Older requests cannot undo newer choices, including across account changes.

Versioned OFF/removal/token retirement keeps minimal expiring disabled metadata with all preferences off and no raw push token, preventing a late ON from resurrecting it. Approved authenticated OFF can establish this boundary before an earlier ON arrives. Unauthenticated callers cannot claim an absent device. Existing expiry duration is retained; no cleanup worker changes. Unversioned legacy installations remain compatible until their own capability becomes versioned; stale unversioned requests cannot overwrite a versioned capability. Rollback on that installation must retain revision support.

Only registerDevice in the shared backend module changed; content delivery/sender logic is untouched. No resident-content, account-deletion, security-rule, signing or native dependency changes.

## Verification

- RED: concurrent category writes failed before the client fix. The late-server-request regression also failed against the prior backend.
- GREEN: 35 native tests and 20 backend tests passed. Covers immediate feedback, slow requests, rapid final OFF, independent categories, initialization, local/network failure, reopening/restart, account separation, late ON/OFF, token rotation and persistent ordering. Seven coordinator scenarios were rerun after the final load-error adjustment.
- TypeScript passed. New coordinator lint is clean; existing provider/profile lint findings and the device require warning are unchanged.
- Native/network boundaries and backend transactions were controlled synthetic test data. No physical-device testing, live preference writes, real pushes or performance benchmark was performed.

## Release — NOT executed

Deploy ONLY registerInboxDevice with updated inbox-push.cjs and its existing dependencies; preserve current identity, flags (including Discussion replies) and authorization. Do not deploy other exports from that shared module. Then publish a compatible Android Production OTA for the Google Play installation. No new AAB/APK, rules, indexes or signing changes required. Preview OTA does not update Play.

After release, test Samsung rapid toggles, slow/offline recovery, reopening/restart, account switching, final stored preferences and notification suppression/delivery after confirmed sync. Test physical iPhone behavior separately. No backend, OTA, build or GitHub release was performed here.
