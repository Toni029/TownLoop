# Inbox and Marketplace leave and final removal — local preparation

Owner request: the first participant leaves; the remaining participant retains history and
can permanently remove the conversation. No deployment or resident-data operation performed.

## Behavior

- Marketplace: the shared native/web protocol now uses the already-permitted transactional
  delete when the other participant has left. First leave still appends the existing notice
  and preserves participants/history. Old clients that only mark both sides left do not
  automatically purge historical documents. No bulk cleanup is prepared or authorized.
- Private Inbox (`resident_chats`, including two-person office-direct conversations): use
  verified identityVersion 2 and two exact UIDs. A first leave sets only the actor's `leftBy`
  marker, appends an authenticated system notice and hides that actor's thread. The other
  person can read history but cannot send more messages. Their removal deletes the document.
- Owner approved including Office and Maintenance. These have two logical sides: the exact
  resident UID and the authorized department team (Admin/VIP for Office, Crew for Maintenance).
  Staff confirmation explicitly says the action affects the entire team. A first leave sets
  only its side's `sideLeft` marker and appends a generic resident/department notice. The
  departing side no longer sees the thread; the other side keeps history but cannot reply.
  Only after the opposite side left may an authorized actor delete the live document.
  A staff member in their own resident thread acts only as resident, never both sides.
  No one can forge the opposite consent marker, rewrite history, or reset a leave marker.
- Hidden cursors, names, email aliases and array-shaped legacy leave data are not private-chat
  leave authority. Invalid/ambiguous identity records are rejected, not migrated or purged.
- Concurrent removals are transactional. A strict-rule race retries once only after a fresh
  server read proves the opposite side has left, or its own side already completed leaving.
  Missing documents, repeat first-leave and concurrent staff representatives are safe.
- Existing push code ignores `isSystem`/`type: leave` notices. This does not send new leave pushes.
  Own badge acknowledgement is best effort. No sending configuration or backend is deployed.

Deletion means the live Firestore conversation document and its embedded message history.
It does not delete shared listing/profile images, backup copies, or independent minimal
notification/moderation/audit records governed by their existing policies. It cannot promise
immediate erasure of an offline device. The inactive retention planner understands the new leave-marker map and system notice, so
future approved redaction removes the old UID/name while preserving the closed state. No
account-deletion/retention worker is activated or deployed.

## Activation needs separate approval

1. Compare current default-database rules against scope.json's baseline SHA256. If changed,
   merge/review only these Inbox lifecycle additions; never overwrite unrelated live changes.
2. Preserve restricted recovery rules. Deploy only the default-database candidate through
   firebase.deploy.json. The candidate retains the deployed Discussion reply-rule patch.
   Existing normal message, receipt and hide paths remain supported.
3. Publish the matching native JavaScript through a runtime-verified Android Preview OTA.
   No new native dependency or APK is required. The old client cannot use the new Inbox
   leave protocol until this compatible rules patch is activated. iOS shares the source but
   requires its own installed native test build/device validation.
4. Verify using consenting test accounts; no historical scan, message inspection, worker,
   Hosting, Storage, named-database or account-deletion change is included.

Safe recovery: ship a client fix or disable the new Inbox leave paths; keep existing security.
Restoring the restricted prior rules can stop new Inbox leaves/deletions but cannot restore
already deleted chats. Backups remain unchanged and require their separate recovery procedure.

## Focused local verification

Use the local Firestore emulator with demo-townloop-chat-lifecycle and mocked Auth claims.
No Firebase Auth accounts are created. Run from the repository root:

```
firebase emulators:exec --project demo-townloop-chat-lifecycle --config security/chat-lifecycle/firebase.emulator.json --only firestore 'node --test security/chat-lifecycle/lifecycle.emulator.test.mjs'
```

The test executes the actual Marketplace protocol and native Inbox transactions through the
Firebase client SDK, including two-way reply denial, immutable history, unapproved/nonmember
rejection, forged markers, legacy hiding, concurrent removal and normal messaging/receipts.
`CHAT_LIFECYCLE_BASELINE=d1d6041` runs the old implementations to reproduce the original failures.
No physical-device verification is claimed.

Verification: 13 local emulator scenarios and eight Inbox/push regressions passed.
Five targeted concurrency scenarios also passed after adding same-team race recovery.
Native TypeScript checks passed. No live messages or records were accessed.
