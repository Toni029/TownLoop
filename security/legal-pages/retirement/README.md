# Proposed Hosting retirement — final owner approval required

This is a Hosting-only plan, not an executed cleanup or a backend release. The
owner has approved the visual design, Seeds4Clix identity, public Safety Team contact
and ongoing mailbox/manual escalation maintenance. Publication is still unapproved.
Use the actual publication date in America/New_York; November 12, 2026 applies only
if publication occurs that day. Do not backdate a later release.

## Confirmed publicly accessible legacy artifacts

Fresh anonymous GETs returned 200 for all 23 files in the verified live manifest.
The following contain old company branding in content or their public filename:

- `/assets/index-C_3tBUcg.js` — compiled retired web interface, also personal attribution.
- `/cecil-pines-logo.svg` — old company wordmark.
- `/cecil-pines-trees.svg` — old company identity in its URL; retire even though no
  matching text was found in the SVG itself.
- `/server.cjs` and `/server.cjs.map` — publicly served old server source/build artifacts
  with branding and personal attribution. These are static Hosting bytes, not the
  running Cloud Functions code; do not conflate removing them with a backend change.

`/index.html` and `/sw.js` contain personal attribution. The old index imports the
main bundle, CSS and vendor bundles. The old web service worker caches app-shell
responses, so a server-only replacement cannot guarantee that an already-open or
permanently offline browser instantly forgets previously downloaded content.

No native source or required backend references to these specific retired Hosting
bundles/logo URLs were found. Native assets are bundled independently. Native legal
links, Firebase authDomain/OAuth handlers, app-link associations, API origins and
Cloud Functions endpoints are still required and must remain intact. This source
trace is not a claim that arbitrary external bookmarks or old web/PWA users do not
exist; those users will see the new information landing page instead of the web app.

Visually inspected all proposed retained PWA/apple/favicon/badge artwork: TownLoop,
Crew and Staff branding only. No old company wordmark or personal attribution was
visible. Those unrelated clean assets can remain without importing an old app bundle.

## Controlled release sequence (not executed)

1. Obtain final approval for the Terms wording, accurate Privacy disclosure and
   this retirement plan. Separately resolve the unpaid Gemini personal-data issue;
   do not enable billing or change secrets/backends under a Hosting approval.
2. Recheck latest Hosting version/config/hashes against the saved manifest. Stop on
   drift. Snapshot the current file/config inventory and retain required recovery
   artifacts securely; do not publish old server/source-map archives as a backup.
3. Prepare one complete, isolated release with the reviewed legal HTML/CSS and
   supporting deletion page. Replace `/index.html` with this folder's clean policy
   landing page and add its `404.html`. Remove the catch-all SPA rewrite, so removed
   files really return 404 rather than HTTP 200 with an app shell.
4. Omit exactly the legacy artifact/manifest paths in `plan.json`. The retired web
   manifest and its unused CSS/vendor bundles have no role in native operation.
   Keep Firebase-reserved `/__/auth/**` and `/__/firebase/**` handling, the verified
   `/.well-known/assetlinks.json` bytes and other required associations. Do not
   disable Hosting or change authorized domains, Auth settings, rules or functions.
5. Replace `/sw.js` with the proposed retirement worker. It installs without a new
   app shell, removes only exact known legacy shell/branding cache entries from
   old TownLoop app-shell caches, stops intercepting requests and unregisters.
   It does not delete Firebase/IndexedDB/localStorage/Auth data, PDF caches,
   unrelated caches or server records. Path hashes avoid re-publishing the old
   branding in public worker source. Test cases cover this scope.
6. Apply no-store/revalidation headers to legal HTML, the new landing page and
   `/sw.js`; retain unrelated appropriate headers. Deploy Hosting only in one
   reviewed release, after explicit approval. No deployment config is executed here.
7. Verify clean public HTML/CSS without login; all retired URLs must return 404,
   including `server.cjs` and its map. Verify support/footer links, the mirror domain,
   reserved auth handling and unchanged Android association bytes. Test an existing
   controlled browser as it refreshes; fresh anonymous checks alone do not prove
   an old service worker has retired. No forced navigation of users is proposed.
8. Inventory preview channels/custom domains using the saved read-only check.
   If an old preview channel is still public, get approval to expire/replace it.
   Old immutable Hosting versions are not automatically active public channels.
   Previously downloaded/offline copies cannot be remotely guaranteed erased.

## Recovery

Do not roll back to the branded app shell or restore public server/source-map files.
Keep a clean minimal information-only release as the recovery option. Preserve the
preflight association/config hashes and restore specific required associations if
needed without resurrecting the old website. No database restore or security-rule
rollback applies. No live resident data, tokens or account-deletion receipt changes.

## Domain inventory

The `townloop` site has only its live channel and no custom domains; no active
preview channels were returned. Its `townloop.firebaseapp.com` mirror shares the
same Hosting site and must be included in post-release checks. The project also
has a separate default site (`cc-livingcommunity-app`); its root check is recorded
in `hosting-domains-verification.json`. It independently serves the same retired artifacts and requires its own Hosting-only
release under final approval. Both sites have only live channels. The native Firebase
authDomain is `cc-livingcommunity-app.firebaseapp.com`; preserve its reserved sign-in
helpers and domain identity. Do not disable either site or apply blanket redirects.
No preview channels, sites or domains were changed.

Both sites contain the same 23 manifest paths, so the plan accounts for both public
copies. Apply the reviewed static-file retirement independently to both site IDs
only after drift checks and final approval. Native sign-in/redirect smoke testing
should follow any approved rollout; source dependency tracing is not device testing.
