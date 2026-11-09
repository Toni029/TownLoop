# Inbox recreation correction — 2026-11-09

## Confirmed cause

Focused read-only inspection of `cc-livingcommunity-app` `(default)` found four retained legacy private records (three with leave markers) and an Office v3 conversation in `cleanup_pending` with two left memberships, zero active memberships and no missing declared memberships. No message bodies were inspected. The private creation regression was reproduced before implementation in two tests:

1. Both participants leave a current private thread; new compose reuses the deterministic pair ID and fails `permission-denied`.
2. A left legacy private pair remains in `includeLeft` lookup; compose attempts historical cutover, which correctly denies the departed actor.

The privacy refusal was correct. Treating retained history as the only possible conversation between those accounts was the defect.

## Focused correction

Only `functions/inbox-groups.cjs` changes application behavior:

- New compose excludes revoked legacy histories from automatic reuse; it does not change them or grant historical access. Still-active legacy histories retain their existing verified-cutover requirements.
- A server-only `inbox_conversation_routes/{deterministic-key}` record identifies the current thread. Transactions serialize creation so simultaneous requests and retries reuse one eligible active thread.
- Each genuinely new history receives a fresh opaque `v3_<64 hex>` ID. Never recreate a missing historical root at the same path: orphan messages and memberships cannot become accessible through ID/epoch reuse.
- Existing canonical IDs remain discoverable for backward compatibility. New routing is initialized lazily during authorized compose; no migration is required.
- Reuse requires complete declared memberships, matching participants/type, authorization and usable lifecycle. Otherwise a fresh thread is created only after ordinary approval, role, recipient and blocking checks. Malformed/missing declared membership fails closed.
- Closed/read-only generations, membership revocations, messages and retention jobs remain untouched. A remaining participant retains permitted old history. A new thread copies no earlier messages or attachments.
- Office/Crew can start a new generation after resident departure or final departure. A departed staff member cannot fork or silently rejoin a shared group that still has the resident and other active members. Automatic Crew synchronization continues to respect explicit leave within each existing thread.
- Routes contain only the current opaque conversation ID, not resident content. Existing default-deny rules reject direct client route reads/writes. Retention cleanup may remove the old target; the next authorized compose can safely replace a stale route with another fresh ID. No cleanup worker or rules change is made here.

## Evidence

- RED: both new compose-after-leave regressions failed with `permission-denied` before the fix.
- GREEN: 58 focused tests passed across group operations, legacy leave, retention and existing group push compatibility. Includes partial/final departures, both messaging directions, concurrency, orphan roots, old-history preservation, blocked accounts and missing membership rejection.
- Six real local Firestore-emulator scenarios passed using unchanged candidate rules and synthetic demo data. Covers legacy/current private recreation, simultaneous opposite-direction compose, two-way send/read, old-read revocation, outsider denial, server-only route read/write rejection, Office/Crew recreation, staff history preservation and post-join visibility.
- Node syntax and Git whitespace checks passed. No TypeScript/native files changed; no unrelated suites rerun.

No physical-device test or live mutation was performed. The old Preview source at `844622e` and current Play client both use the same v3 `create`/`send` callable shape and opaque returned conversation ID. No client-visible protocol or ID-format change is introduced.

## Release requirements — not executed

Deploy **only `manageInboxConversation`**, packaging the updated group module with its existing dependencies and preserving all live flags, identity, auth and safeguards. No Firestore/Storage rules, indexes, data migration, notification deployment, OTA or new APK/AAB is required for this backend-only correction. Production remains unchanged until separately approved.

After deployment, use authorized test accounts to verify new/existing private compose and reply in both Play↔Preview directions, plus fresh Office/Crew flow and old-history isolation. Marketplace, Discussion, account deletion, Database Cleanup, News/PDF/Gemini and native UI are unchanged.
