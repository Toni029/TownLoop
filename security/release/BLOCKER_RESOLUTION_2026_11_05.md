# Confirmed launch blocker resolution — 2026-11-05

**NOT READY for public launch.** Follow-up to `PRELAUNCH_2026_11_05.md`, reusing
`973424a`, `6c792e1` and `9c0d5da`. This is targeted remediation, not a repeat audit.
No production records, rules, settings, Hosting, workers, credentials or telemetry
were changed. No push, OTA, Firebase deployment or native binary build occurred.

Local implementation checkpoints: `30d7be2` (decoder patch) and `5007858`
(named rules, compatibility preparation, tests and rollout gates). The recovery,
monitoring, lint classification and this report form the separate preparation commit.

## P0: named Firestore authorization — prepared, rollout held

The exact vulnerable named rules identified by the audit authorize all approved
users for `resident_chats`, `office_chats`, `maintenance_chats` and
`marketplace_chats` without participant checks. They also permit pending signups
to read/list full `users` profiles and unrelated residents to read `work_orders`.
Authentication/approval alone is not ownership or conversation membership.

`../legacy-launch/` contains a separate named-only candidate and secure read-only
fallback, synthetic emulator tests, compatibility adapter, scope/hash checks and
rollout instructions. Pending users can fetch only their own profile. Approved
canonical roles, active membership, immutable identities/history, departed-side
revocation, own read cursors, scoped Work Orders and existing deletion fences
are checked. Clients cannot create private-history grants, forge membership,
rewrite prior messages, elevate roles or clear deletion/access fences.

Previously broadly writable participant/owner fields cannot certify historical
membership. The candidate therefore requires independently reviewed server-owned
grants and an authorization epoch. The local adapter is **not integrated into the
original website** and no grants/projections were created. The current native app
uses the default database; its source, rules and messaging are unchanged.

**Do not deploy this candidate alone.** The hosted old website uses broad profile,
chat and Work Order reads and a different write protocol. Its exact original
source/build provenance is not verified. Before an approved rollout, establish
that source/backport or explicitly approve retirement/containment; independently
review historical membership; implement named-only server provisioning and
content-free projections; integrate those new records into existing account
deletion inventory and history-redaction/authorization-epoch freezing; and pass
browser acceptance. Those integrations are not implemented or deployed here.
Uncertain ownership remains inaccessible, never guessed from names/email aliases.

Rules cannot prove earlier message bodies were never tampered with, erase bytes
already cached on a device or revoke previously disclosed bearer attachment URLs.
No existing download tokens or six quarantined attachments were changed.

The production P0 remains live until a separately approved coordinated rollout.
The documented rollback is a secure read-only containment state, **not restoration
of permissive rules**. No sensitive migration or production experiment was run.

## P1: native deep-link decoder — fixed locally

`decode-uri-component@0.2.2` reached through Expo Router/query-string can consume
quadratic time on malformed input. A 60-KB malformed query exceeded the bounded
five-second baseline test. Upstream 0.5.1 fixes the algorithm but its ESM default
export breaks query-string 7's callable CommonJS contract.

The Metro resolver now uses the verified upstream 0.5.1 source with only that
export adapted to CommonJS. Its MIT license, registry archive integrity, source
hashes and regression tests are retained under `native/vendor/` and
`native/tests/deep-link-decoder.test.cjs`. No decoding algorithm was rewritten,
native dependency changed, or unrelated resolver replaced. The old package stays
in the lockfile for tool compatibility; this does not claim a clean advisory scan
or protection for direct Node/tool imports outside Metro.

Actual local Android JS export succeeded. The exported bundle SHA-256 was
`06c077712ee98b874d85f944ee16067c2ab38c0a12b310e78505d27306a5e6a0`;
the patched decoder is present and the old recursive decoder absent. This was
**only a local JS export**, not an APK, iOS build, publication or phone test.
Android/iOS resolution and the actual query-string caller pass regression tests.
The patch adds no native API and is an OTA candidate, subject to approved release
runtime/channel preflight and device callback/deep-link checks. No OTA was sent.

## Remaining operations/release decisions

See `blocker-prerequisites/README.md` and `LINT_CLASSIFICATION.md` for the scoped
operator instructions and reused evidence:

- **Recovery:** both databases had PITR off, one-hour version history, no scheduled
  backups and resource deletion protection off in the prior audit. An offline,
  scope-locked plan proposes seven-day PITR, daily seven-day and weekly 28-day
  backups, with optional database-resource deletion protection separately approved.
  Apply refuses the example approval and requires an actual owner decision,
  exact plan hash, cost, retention and isolated-restore review. No setting applied.
  Restore must reconcile completed deletions across both databases before cutover;
  Firestore backups do not back up Auth identities or Storage bytes.
- **Crash reporting:** minimal Sentry native crash/error reporting is proposed,
  inactive and uninstalled. Provider/privacy/retention, payload scrubbing and
  owner approval precede installation, a new native binary and symbol/device
  verification. No resident telemetry was enabled.
- **Policies/store:** final operator/contact/effective version, current automatic
  deletion and recovery disclosures, Gemini/translation processing, moderation,
  privacy/terms/deletion pages, Play Data Safety/health and Apple App Privacy
  declarations need owner approval and separately approved publication. Resolve
  Apple's Google-login rule 4.8 with a qualifying option or applicable exception.
- **iOS:** reuse existing valid Google registration; paid team authority,
  `com.toni029.townloop` capability, APNs key, consenting device registration,
  distribution signing/provisioning and signed physical-device testing remain.
  Do not repeat OAuth investigation or treat simulator/Android success as APNs
  evidence. No Apple credentials were requested or changed.
- **Lint:** reused 49 errors/31 warnings are classified. Sensitive account guards
  and lifecycle findings were inspected; no additional confirmed P0/P1 defect
  justified speculative refactoring. Lint remains failing; no suppressions added.
- **Earlier parser correction:** `6c792e1` changes the npm lock only. A separately
  approved scoped Functions deployment must use that lock, excluding/reconciling
  the stale pnpm lock, and verify uploaded dependency resolution. Do not blanket
  deploy workers or redeploy the already-patched isolated newsletter service for it.

## Focused verification and release gates

- Decoder: 4/4 tests pass, including actual CommonJS query parsing, both-platform
  Metro resolution, malformed-input bounded execution and pinned source identity.
- Recovery preparation: 5/5 tests pass, including offline default, rejected sample
  approval, exact two-database scope, idempotence and unexpected metadata refusal.
- Named authorization: candidate/fallback role cases pass 13/13 in a synthetic
  loopback emulator; the final departed-side guard/fallback follow-up passes 2/2.
  The local adapter passes 3/3 boundary tests and strict standalone TypeScript.
  Exact commands/limits are recorded in `../legacy-launch/VERIFICATION.md`.
  No live private records were read; these are not original-browser acceptance tests.
- The prior native TypeScript/full-suite findings are reused; no hundreds-case
  suite rerun, native feature rewrite or blanket lint autofix. The completed keyboard
  fix, startup, Gemini extraction/RSVP separation/highlights, uploader, notification
  sending and account-deletion activation are untouched.

Physical Android and iPhone still need ordinary/deep-link and Google callback
navigation, authorized notification taps, account switching, keyboard/Send visibility
and large-font comments checked on the actual release artifacts. The legacy site
needs original-client browser acceptance across approved Resident/Crew/VIP/Admin
and pending/revoked users, without live destructive probes. Recovery needs an
approved isolated restore drill. Monitoring needs a synthetic authorized test
crash and payload/symbol verification. None is claimed device-verified here.
