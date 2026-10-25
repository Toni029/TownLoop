# TownLoop final release preparation — 2026-10-25

Local completion package, not permission to deploy or activate deletion. Builds, resident data,
Hosting, both database selections, rules, tokens and Production remain unchanged.
Existing deployed review/Preview checkpoint: `b30cbef`, OTA `01a173ea-79f0-716b-b420-ed7c1e6160c1`.

## Completed corrections and evidence

- Review approval still writes `approved_held` / `processingAuthorized:false`. Neither review,
  request submission nor these local changes can enable the default-off engine. Independent
  canonical Admin/VIP authorization, recent request verification, reasons and receipts remain.
- Secure Marketplace creation does not set `identityVersion`; the retention planner now accepts
  its exact two UID sides/participants and verified sender schema. Ambiguous/sanitized identities
  remain review-only. No actual conversation was inspected or migrated.
- Confirmed missing/disabled Auth identity clears only that account. Offline/network/expired-token
  errors are NOT deletion evidence. A protected durable retry queue survives interrupted local
  cleanup, and retry signs out only a matching current account. It clears reminders/checklists,
  exact-UID reactions and newly namespaced app-owned image cache, preserving other accounts/config.
  Profile and Social form state are in memory; cloud drafts are not represented as device files.
- Firebase image reads in native Feed/Marketplace/editor previews/gallery and prepared web
  Feed/Marketplace/details now use authenticated Storage reads, including old bearer URL inputs.
  Existing files, URLs and upload protocols are unchanged. No tokens were requested or revoked.
- Monitor prepares aggregate warning logs for NEW durable overdue receipts only. Static code
  `TOWNLOOP_DELETION_REVIEW_OVERDUE`, no names/UIDs/text/URLs. The existing 3-business-day reminder,
  7-day escalation and completion/retention overdue receipts remain idempotent. Monitor remains
  disabled and undeployed. Cloud Monitoring draft is disabled, rate-limited to one daily alert,
  and has no notification destination. Existing push-client integration is deferred, not a
  dependable delivery route. Admin/VIP review access does not imply staff response guarantees.

## Approved metadata/configuration verification (aggregate only)

`verification.aggregate.json` contains no individual records/UIDs/tokens. Projections excluded
all messages/comments/nested media arrays, resident names/contacts, medication and photo bodies.
No records changed. Counts are a point-in-time minimum scope, not a universal erasure certificate.

- Default: 5 profile IDs; named website database: 3; 3 exact IDs overlap. Default top-level
  ownership is consistent for 9 Work Orders, 14 feed posts and 7 Marketplace listings.
- Three friend chats have canonical participants; 3 office and 4 maintenance chats have verified
  resident IDs. Their other embedded identities were not inspected. Two Marketplace chats remain
  unclassified under strict current-profile matching for deletion; prior C1 messaging compatibility
  remains valid and is not equivalent to redaction certification. No ownership guessing.
- 41 Storage objects: 18 matching parent/uploader links, 6 preserved quarantine objects, 17
  unverified or non-parent objects (includes newsletter files). None are selected for deletion.
- No managed backups, backup schedules or PITR in either database; one-hour Firestore version
  retention. Restricted release backup: age-60-day lifecycle, no soft-delete retention. This
  rule is asynchronous and does not establish an inventory of all historical copies.
- Application Storage has 7-day soft deletion and no configured versioning/retention lock in the
  returned settings. Other project bucket configurations were read, not contents. General
  logging retention is 30 days; the required audit bucket is locked at 400 days. No log bodies read.
- Application bucket has no explicit CORS configuration. Prepared browser authenticated reads
  need a real permitted-origin check before release; a proposed origin-scoped configuration preserving upload methods is supplied
  for owner approval, not silently applied.

## Boundaries before destructive activation

1. Default-only engine must not delete shared Firebase Auth identity while the named website's
   profile/data remains. Three shared IDs establish this dependency. No named-DB cleanup adapter
   or broad scope attestation is silently enabled. Complete per-account scope and approved handling
   before setting database/identity/media proof gates. Existing flags stay false.
2. Embedded author/media relationships, unverified objects and legacy chat identities remain
   `needs_review`; do not convert scan omissions to ownership proof. Six quarantined files are an
   approved preservation exception pending independent resolution; they are not reassigned.
3. If an offline client loses its Auth session before authoritative deletion evidence, current
   Firebase APIs may not deliver that evidence. Durable retries solve interruptions AFTER proof,
   not absence of proof. A separately reviewed cleanup-only receipt/lease protocol and its finite
   retention is needed for that gap. Do not erase active residents merely for being offline or
   extend server tombstone retention indefinitely without approval. Historical unassigned caches
   and the unchanged hosted client's cleanup remain limits; no remote offline erasure claim.
4. Manual/automatic processing must actually complete verified requests promptly before Play
   release; a held approval is not completed deletion. The 60-day window is a maximum ordinary
   retention limit, not a fixed waiting period. Delays/withdrawals require the existing legitimate
   reasons. No arbitrary denial or deadline reset.
5. Backup recovery proposal: optional daily managed backups with 60-day expiry in both scoped
   databases; preserve current recovery protections. Restore into isolation, reapply approved
   deletion receipts, then validate permissions before client access. Provider-required audit
   logging (400 days) needs a documented minimal-data security exception and owner approval.

## Legacy token retirement — held, separate approval required

New authenticated image readers deliberately do not fall back to a bearer URL on denial.
Newsletter download helpers already support authenticated SDK reads. Authenticated reading
is NOT token revocation: every still-valid old download capability remains usable by its holder,
including the six quarantined files. The projected top-level sample contains 4 Work Order and
4 newsletter bearer references; nested Social/video/reference arrays were not fetched. Source
confirms Social uploads still mint links for older clients, so these counts are not the total.

Safe order: deploy compatible readers to intended native runtime and separately approved web
snapshot; verify current/old readers, PDFs, video and all live web origins; switch new writes to
object identities only once readers support them; generate a server-controlled exact-parent,
UID, generation/metageneration allowlist; require separate token-retirement approval; retire a
small verified batch with preconditions and audit only hashes/counts. Stop on mismatch or denied
legitimate access. Never guess paths from filenames or include the six quarantine exceptions.

**Remaining reader gaps:** native/web videos, message thumbnail consumers and older hosted or
installed clients must be covered and verified before retiring their tokens. New upload URLs
remain unchanged now to preserve those clients. Do not deploy this preparation as evidence that
all clients are token-independent. CORS changes, reference changes and token retirement are
separate operations. Recovery uses a reviewed authenticated reader/service and preserved bytes;
never restore known-exposed tokens or public rules. No rollback can make an already leaked URL
private before its token is invalidated.

## Existing APK versus new source

Inspected actual `9a934883-9957-4a10-95d3-a286f75e01f5` APK, SHA-256
`7e67657f39b18879143e46fc932af6fe48d09320795bee34dd4ca610fe037d57`:

- Bundled fingerprint `d6f09b9023171c8bdabd4a8e1da0b41223dff3b9`; package
  `com.toni029.townloop`, version code 2, target/compile API 36, backup false.
- Original MP4 matches `/home/tonio/Downloads/startupapp.mp4` byte-for-byte:
  `0deed2ecabd1be98c4d02e9edd34d5a53d300b04d312dc332f8b9727fd7a3934`.
  Existing JS lifecycle checkpoint is bundled; no new startup animation or asset was introduced.
- Compiled `PlayerBuilderOptions` has only seek increments, no `disableAudioSession`; DEX code
  inspection confirms the startup-only native opt-out is absent. JS presence is not native proof.
  Bluetooth behavior therefore cannot be certified for this APK. No new real-device test occurred.
- Added Android `buildFromSource:["expo-video"]`, explicit EAS post-install patch verification and pre-upload compiled DEX gate. Installed autolinking code chooses the precompiled publication by default unless this exact project-name override matches; the resolved configuration now matches `expo-video`, so other modules remain prebuilt. [Expo source-build guidance](https://docs.expo.dev/guides/prebuilt-expo-modules/). The actual
  old APK fails that gate as expected; synthetic patched/missing fixtures pass/fail correctly.
  The next approved binary must compile and pass the gate; no build occurred here. The original APK lacks the patch and the old source config allowed the prebuilt AAR; this supports the source-bypass mechanism. It does not claim that future compilation has already passed.
- 50 64-bit native libraries pass the 16-KB ELF alignment inspection; APK ZIP alignment passes.
  This is packaging evidence, not a 16-KB hardware/emulator launch test.
- Signing verifies; Preview certificate SHA-256
  `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`.
  Play upload/app-signing enrollment and certificate continuity are not verified.

Native/JS changes must stay separate during release: cleanup/images can form an OTA candidate
with a freshly verified installed runtime; build-hook/native permission changes belong in a new
binary. HEAD contains the build-hook change, so do NOT force this combined HEAD onto the old
runtime. Existing EAS Production AAB/production channel remains separate from Preview APK/preview.
The permission fragment is inactive: remove broad storage/media access and overlay permission in
an approved new native release, preserve optional camera/system picker, then inspect its manifest.

## Minimum coordinated release after approvals

1. Fill owner/provider/staff decisions and approve policy drafts; finish the narrow technical
   blockers above. Local files do not replace the currently hosted site.
2. Release approved client cleanup/authenticated-reader changes to a verified Preview runtime;
   independently verify browser readers/CORS against a separately approved website snapshot.
   No rules changes or token retirement are bundled. Review-only services already run at b30cbef.
3. Separately approve non-destructive monitor deployment plus one staffed Monitoring destination;
   test a synthetic aggregate alert without making a resident deletion request.
4. When explicitly approved, apply future native permission fragment and build ONE Preview binary
   to verify native opt-out and release gates. Preserve original video and signing. After tests,
   separately approve the Production AAB/Play closed-test track. Never publish a Preview OTA to
   Production or assume runtime compatibility across binaries.
5. Activate deletion/media workers ONLY after per-account multi-database, ownership, local cleanup,
   retention and backup gates and explicit destructive approval. No generic flag flip or self-approval.
   Later, independently approve controlled token retirement. Neither is included in this task.

Owner input: legal operator/contact/effective date; a monitored office destination and staffed
Admin escalation owner; provider AI/translation handling terms; required audit-log exception;
Play account type/testing/signing status. Recommended defaults: all approved Admins see office
queue, one monitored office email receives aggregate alerts; preserve 60-day ordinary policy;
retain required audit records only for the actual provider minimum. No contact or legal identity
is invented. Optional managed backups are a cost/recovery choice, not a Google Play mandate.

## Focused verification

38 focused tests passed: 25 native cleanup/image/upload checks, 7 retention planner checks,
3 monitor/deadline checks and 3 native patch/autolinking/artifact-gate checks. Native and web TypeScript
checks passed. The historical APK intentionally fails the new compiled-patch gate; that is
evidence of the packaging gap, not a successful native rebuild. No new phone/emulator run
or deletion execution occurred. Existing Samsung cancellation acceptance remains reused.
