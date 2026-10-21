# C1 final pre-deployment review

**Web follow-up:** [HOSTED_WEB_REVIEW.md](HOSTED_WEB_REVIEW.md) confirms that live
Hosting uses a different, named database and has no Marketplace conversation
client. The previous main+C1 web-deployment step is now **on hold**. Recommendation:
keep Hosting unchanged for C1, pending owner review; do not automatically execute
that step or retarget the website's database. Native/older-client cutover gates
remain separate and have not been worked on in that follow-up.

**Decision: GO for isolated release preparation; NO-GO for production cutover yet.**
No release commands were executed. Existing app source, local branch/checkpoints,
resident records, and remote deployments are unchanged by this review. Only local
review artifacts, a restricted fallback candidate, and its emulator check were added.

## Confirmed evidence

- GitHub `native/expo-migration` is still `25c4b3b9b64baab3ab2b0a52e682f55e9855d9d9`.
  Local HEAD `1804071` contains seven unrelated UI/PDF/gallery files. Publishing
  this checkout or pushing its whole history is not the proposed C1-only route.
- GitHub `main` is `a6567cdcbfaa578dd10a89b8c259a5650d5a0a76`.
- Authorized Rules API GETs independently retrieved the active default-database
  rules. They match the Console baseline byte-for-byte (SHA-256
  `79c701b89890d43c1bb82028f02ce5483987577b2dae31dd1e5518bdecddd259`).
  Public Marketplace access remains live until a separately approved cutover.
- The C1 candidate remains unchanged: SHA-256
  `ea46363e0c12251f1d9855e24252abaa7593f138a65cab11a099a356def903bd`.
  Reversing its C1-only replacement reproduces the live baseline exactly.
- Prior identity check: 2/2 structurally compatible, no identity migration indicated.
  Prior 51 passing C1 assertions were reused, not repeated. Message content and
  historical authorship were not inspected or certified.

## Exact clean source scope

`release-scope.json` is the explicit path inventory. The native release patch
contains ONLY these 12 client files plus the verification scripts:

1. `native/src/lib/liveCollection.ts`
2. `native/src/social/actions.ts`
3. `native/src/social/model.ts`
4. `src/components/MessageSellerModal.tsx`
5. `src/components/community/MarketplaceChatModal.tsx`
6. `src/components/community/MarketplaceReplyComposer.tsx`
7. `src/hooks/useCommunityState.ts`
8. `src/services/marketplaceChat.ts`
9. `src/services/marketplaceChatIdentity.ts`
10. `src/services/marketplaceChatProtocol.ts`
11. `src/services/marketplaceChatRecovery.ts`
12. `src/services/marketplaceChatTypes.ts`

Include the C1 review/rules artifacts listed in the manifest, including the three
verification scripts. Do not stage the pending root `firestore.rules`; the complete
root file contains other undeployed rules. The reviewed rule source is exclusively
`security/c1/firestore.c1-candidate.rules` with its dedicated deployment config.

Exclude checkpoint `1804071` and its gallery/PDF/Social/Work Order UI edits, all
Storage/C2 changes, other unfinished work, secrets, credentials, signing files,
dependency directories, build output and binaries. Existing approved changes
already in the pushed base are retained; this is not an app-wide rollback.

Two review patches were checked for clean application in disposable directories:

- `c1-native-release.patch`: applies to pushed native base `25c4b3b`.
- `c1-web-release.patch`: only the nine shared/web files, applies to original
  `main` base `a6567cd`. Do not build the web app from the native branch wholesale:
  its root source already differs from main in 12 non-C1 files.

## EAS compatibility and older clients

Read-only EAS results are recorded in `eas-predeploy-verification.json`:

- Latest finished Preview APK: `e2bba78f-7774-4bdb-99e9-8f2b934831ea`, channel
  `preview`, runtime/fingerprint `34fdc17d0432044445e5789a549f8e9bfbcf8b3c`.
- Current local Android fingerprint calculated with installed Expo tooling matches
  that runtime. The C1 source changes add no native dependencies/configuration.
  Reconfirm the fingerprint of the final isolated snapshot before publication;
  never override it to force compatibility.
- Live `preview` maps only to branch `preview`; live `production` maps only to
  branch `production`. Both unpaused; Production has no update groups in this query.
- Latest published Preview group is `2b692c19-9683-401d-b5ee-ea8c3ff2bce6`, from
  `25c4b3b`, runtime `34fdc17d...`. It is pre-C1 and is NOT a secure rollback target
  once rules tighten.
- Older finished Preview APK `2aa5009d-dd74-465d-84ed-8ad7bcb51e48` uses runtime
  `7a4f52ca67cc7391c6bd746696462930f71df303`; development build `82df7c94...` uses
  that runtime on channel `development`. Neither receives the new Preview/runtime
  update. Production-channel, iOS-only and non-EAS installations are not covered
  by an Android Preview publication either.

The installed phone's current runtime/update activation was not inspected. No
resident installation inventory exists in this review. Confirm users have the
compatible APK and activate the downloaded update, or approve an upgrade cutoff.
Other runtimes require a separately reviewed compatible backport/update or an
approved existing compatible APK. This review authorizes neither new builds nor
Production publication. Downloading an OTA alone is not activation; safely restart
after forms are finished. No auth/local-data clearing is needed.

## Web target and remaining baseline blocker

The configured Hosting site `townloop` is verified under `cc-livingcommunity-app`,
default URL `https://townloop.web.app`. Its current release is September 25,
version `d7e22df49f9e4bbf`; it does not identify a source Git commit. Current main
was committed October 3. Thus neither main nor native HEAD can yet be certified
as the exact live web source. Do NOT promise a C1-only change relative to that
deployed website until its source is confirmed, or the owner explicitly reviews
and approves the main-plus-C1 snapshot and target as the web release scope.

Build/deploy only from that approved isolated web source and keep the existing
site/domain/origin. Do not clear localStorage, send Clear-Site-Data headers, or
force reload a typing user. Old cache stays untouched; scoped drafts persist;
recovery requires user selection and a separate Send. Old open tabs must refresh
after finishing drafts. Switching from localhost or another origin does not
transfer its cache; preserve the old origin's data and never automatically import
untrusted caches. No migration/cloud cache collection is needed.

## Approved future sequence — commands are NOT executed

Each external release stage below requires explicit approval. Obtain approval
for the isolation strategy and web baseline before starting release work.

1. **Isolate/commit/push.** After approval, use a separate local release checkout
   based on the verified pushed native base. Apply only the native C1 patch and
   copy/stage only the manifest-listed C1 review artifacts. Preserve the existing
   dirty checkout and `1804071`; do not reset, revert or force-push it. Example
   actions from the current repository, with a chosen new release directory:

   ```sh
   git worktree add -b release/c1-only "$C1_RELEASE_DIR" 25c4b3b9b64baab3ab2b0a52e682f55e9855d9d9
   git -C "$C1_RELEASE_DIR" apply "$C1_REVIEW_DIR/c1-native-release.patch"
   # Copy the manifest-listed review artifacts; stage ONLY its explicit file list.
   # Confirm the final tree differs from 25c4b3b only in that approved scope.
   git -C "$C1_RELEASE_DIR" commit -m "Secure Marketplace participant access and preserve local drafts"
   git -C "$C1_RELEASE_DIR" push origin HEAD:refs/heads/native/expo-migration
   ```

   `$C1_REVIEW_DIR` is the absolute path to this `security/c1` directory; set both
   variables explicitly. Recheck remote base immediately before committing/pushing;
   stop if it moved. The push is a normal fast-forward from `25c4b3b`; no remote
   history rewrite or main push. The original local native branch stays on its
   preserved checkpoint until a separately reviewed reconciliation.

2. **Preview OTA.** From the clean, reviewed, pushed release snapshot with its
   existing locked dependencies installed, confirm project/package/fingerprint
   and HEAD equals `origin/native/expo-migration`. Then, only with publication
   approval, from its `native/` directory:

   ```sh
   ./node_modules/.bin/eas update --channel preview --platform android --environment preview --message "C1 Marketplace Chat Security"
   ```

   This explicit command is required for the isolated local release branch: the
   ordinary manual publish wrapper requires a local branch named native/expo-migration
   and must not be run from the original mixed checkout. Preserve its equivalent
   clean/pushed-HEAD/manual-approval gates here. Record group/runtime; do not change
   channel mappings or Production. Have the owner activate and review the update.

3. **Web deployment.** After the web baseline/target approval, create a separate
   web checkout from that verified base (or explicitly approved main base), apply
   only `c1-web-release.patch`, review its exact diff and preserve draft storage.
   Only after deployment approval, from that isolated web checkout:

   ```sh
   npm run build
   firebase deploy --project cc-livingcommunity-app --only hosting
   ```

   The reviewed root hosting config targets only site `townloop`. The `--only`
   flag must remain; do not deploy rules, functions or Storage alongside the web
   client. No such web build/deployment was performed during this review.

4. **Client gate.** Owner verifies updated Preview and refreshed web workflows
   using their own account. Confirm older/runtime/Production cohorts are handled,
   or explicitly approve a maintenance/upgrade cutoff. No zero-interruption
   guarantee is possible without this gate. Never grant public/name-based access
   to keep an old whole-collection client working.

5. **Rules cutover.** Require separate approval AFTER client acceptance. Re-read
   live rules and stop if the baseline changed. Recheck the candidate hash, then
   from the clean release root deploy exclusively:

   ```sh
   firebase deploy --project cc-livingcommunity-app --config security/c1/firebase.c1.deploy.json --only firestore:rules
   ```

   This deploys the complete reviewed C1 candidate, not the pending root rules.
   It does not include indexes, functions, Storage, Auth or C2 work.

6. **Post-cutover.** Re-fetch deployed rules and compare with the candidate hash.
   Owner checks their own permitted messaging; no agent reads private messages
   or probes live private records. Prior emulator assertions establish denied
   unauthenticated/nonparticipant writes/reads and history mutation attempts; use
   those and the deployed-source comparison. Any additional production account
   tests/record writes require separately scoped consent. Do not use administrator
   Google OAuth calls to claim client-rule denial: those use IAM instead of rules.

## Secure recovery

- Dedicated fallback: `firestore.c1-readonly-recovery.rules`, with only approved
  exact participants allowed scoped reads; **all Marketplace creates/updates/deletes
  denied**. Other collections remain identical to the reviewed baseline. Its
  eight new focused emulator assertions are recorded separately; the 51 existing
  C1 checks were not rerun.
- With separate emergency-deployment approval only:

  ```sh
  firebase deploy --project cc-livingcommunity-app --config security/c1/firebase.c1.readonly-recovery.json --only firestore:rules
  ```

- Then fix forward with compatible C1 clients. Republish/restore only a verified
  C1-secure update/web version for the same runtime; none exists in published
  history yet. Do not blindly roll back to embedded APK, the pre-C1 Preview group,
  or the old web implementation as a working messaging fallback. Strict server
  rules must remain even if an automatic Expo recovery selects an older bundle;
  messaging can be unavailable until it is upgraded.
- Never restore the public baseline, broaden participants, migrate/delete records,
  clear app/site data, or erase local caches as recovery. No new Auth accounts,
  credentials, signing changes, or APK build is part of recovery.

## Approvals still required

1. Isolated C1 release snapshot, local commit, and fast-forward GitHub push.
2. Matching-runtime Android Preview OTA publication (no Production).
3. Verified web baseline/site scope and its independent Hosting deployment.
4. Client acceptance and any older-client upgrade/maintenance cutoff.
5. C1-only Firestore rules cutover, with fresh baseline verification.
6. Any emergency fallback deployment or later C1 hotfix/republication.

All remain pending. C2 and unrelated application work remain untouched.

Official references: [Expo runtime compatibility](https://docs.expo.dev/eas-update/runtime-versions/),
[Expo update recovery](https://docs.expo.dev/eas-update/rollbacks/),
[Firebase scoped deployment commands](https://firebase.google.com/docs/cli).
