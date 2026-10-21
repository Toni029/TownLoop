# C1 — live Hosting compatibility review

October 21, 2026. Read-only Hosting metadata and public static code inspection.
No resident records, messages, Auth users, browser storage, or private sessions
were read. No deployed JavaScript was executed. No tests or builds were run.
Expo was relaunched on localhost:8082 and returned HTTP 200.

## Decision

**NO-GO for deploying main + C1 as a narrow web security update.**
The live web app selects a different Firestore database and predates the web
Marketplace conversation implementation. The safest C1 recommendation is to
leave the current Hosting release unchanged. The currently served code does not
use `marketplace_chats`, so replacing it is not a demonstrated prerequisite for
securing that collection in the native app's default database. This revised
rollout recommendation needs owner review; no deployment or other blocker work
has been started. Do not follow the previous web-deployment step automatically.

## Exact deployed artifact

- Site: `townloop`, `https://townloop.web.app`.
- Hosting version: `d7e22df49f9e4bbf`.
- Release: September 25, 2026, 4:45 PM EDT (20:45:33 UTC).
- Complete active file manifest: 23 entries, no further pages.
- Main application bundle: `/assets/index-C_3tBUcg.js`.
- Downloaded bundle SHA-256:
  `1dfd19fb7b3b4966a1595a18f0059c7263c4fa67dc69dd6886912b66ad5a55c5`.

Hosting version metadata has no source/commit label. The deployed client bundle
has no source-map reference. Public `sw.js` and `manifest.json` exactly match
historical Git blobs shared by 12 commits, most recently `9a850f7`. Matching these
files does NOT identify the complete source commit or prove an unmodified build.
The exact deployed build artifact is identified; its Git commit is still unknown.
No tracked root dependency lockfile was found in main, so an arbitrary rebuild
would not establish exact provenance. No speculative/repeated builds were made.

## Confirmed differences from GitHub main and the C1 candidate

The remote main SHA was checked read-only and matches local origin/main:
`a6567cdcbfaa578dd10a89b8c259a5650d5a0a76`.

1. **Different database selection.** Static AST inspection of the served bundle,
   resolving literal configuration references without evaluating app code, shows
   project `cc-livingcommunity-app` with named database
   `ai-studio-cclivingv27-5fc1a0f6-cd75-4964-8c9e-e219a265f7bb`.
   Main's `firebase-applet-config.json` selects `(default)`; commit `39a0906`
   introduced that change. The prepared main+C1 patch does not reverse it.
   Without an explicit reviewed build override, that release would redirect web
   reads/writes to another database. It would not itself migrate/delete records,
   but residents could see different/missing records and subsequent writes would
   target the new database. That is not an authorized C1-only deployment.
2. **No Marketplace conversation client in the live bundle.** It contains no
   `marketplace_chats`, `townloop_marketplace_chats_v1`, or Marketplace Inbox
   implementation. AST inspection identifies its Message Seller callback: close
   the modal, clear selection, display a success toast; no network/database send
   in that callback. This matches the old source handler. No test message was
   submitted. Main introduced the real Marketplace conversation service/UI later;
   main+C1 would add that feature to this website, not merely secure its old one.
3. **Broader source/UI upgrade.** Comparing the historical candidate with main
   shows many non-C1 changes in News/PDF, profile/admin, authentication, forms,
   medication UI and other screens. The previously prepared nine-file C1 web patch
   is narrow relative to main, but main itself is not the deployed baseline.
4. **Service worker differs.** Live is `townloop-cache-v1`; main is v3 with an
   additional PDF cache and cache-activation cleanup. It does not delete
   localStorage, but deploying it can replace offline shell/media caches and
   change controller behavior. This is unrelated to the narrow C1 client patch.
5. **Static asset preservation needs review for any later upgrade.** The live
   manifest includes `/.well-known/assetlinks.json`, absent from main's public
   source. Preserve/verify its hosting-managed or supplied replacement rather
   than assume a fresh build retains it. Public privacy, logo and favicon assets
   checked byte-identical to main. No server bundle or server source map was read.

These findings establish a compatibility risk, not complete feature-by-feature
runtime equivalence. The named database's data/rules were not queried; default
database C1 rules must not be claimed to secure a different database.

## Conversations, cache and draft safety

- Existing records remain unchanged. The earlier approved 2/2 identity check
  concerned the default database; it is not a census of the named database.
- The currently served website has no Marketplace chat collection client to
  break when default-database Marketplace rules tighten. Other origins, cached
  application versions, development servers or APKs are not certified by this
  public-asset check. Their coverage remains a separate rollout question.
- Prepared C1 web code preserves the old unscoped archive, isolates drafts by UID
  and chat/listing, and offers only explicit verified recovery into the composer;
  nothing is automatically sent. No actual resident cache was inspected here.
- Old Message Seller draft text is component memory, not persisted by that old
  handler. No new deployment can retroactively preserve text the old client never
  saved. Do not force reload an active form: users must finish sending or retain
  their own text first. Keep the existing origin and never clear site storage.
- Keeping Hosting unchanged avoids a cache/controller/database switch during C1.
  It does not repair the old website's pre-existing toast-only inquiry behavior;
  implementing that live-site feature is a separately reviewed upgrade.

## Safest source/release recommendation

For C1 now: **no web deployment** is the least disruptive recommendation, subject
to owner acceptance and separate native/older-client readiness. Do not change a
database, migrate data, deploy named-database rules, or introduce new web features
just to satisfy the old deployment sequence.

If an updated web Marketplace Inbox is wanted, first recover the original
deployment source/build records for a verified minimal backport, OR explicitly
review/approve main+C1 as a broader web upgrade. Resolve database selection and
database-specific security coverage before publishing, retain current association
resources and storage origin, and review the non-C1 source delta. The existing
main-based patch alone is insufficient evidence that this preserves all live
functionality. None of these follow-up actions is authorized/performed here.

Machine-readable public-code evidence: `hosted-web-verification.json`. Downloaded
public inspection inputs are under `/tmp/townloop-c1-hosted-review`, outside the
release scope; they were not added to Git. No secrets or individual resident data
are included in the review artifacts. Stop for owner review; C2 remains untouched.
