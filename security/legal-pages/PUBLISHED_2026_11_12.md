# Hosting publication — November 12, 2026

Owner approved final legal wording and Hosting-only cleanup for both sites. Published
with effective date November 12, 2026 (America/New_York publication day).

| Site | Final active Hosting version | Release |
| --- | --- | --- |
| townloop | `4b8d24abe8cd862f` | `1794519037218000` |
| cc-livingcommunity-app | `21bf30e7c7a227c2` | `1794519037214000` |

Exact URLs: https://townloop.web.app/privacy.html,
https://townloop.web.app/terms.html, https://townloop.web.app/child-safety.html.
All return 200 with the intended document, no authentication or redirect. Supporting
account-deletion page is public; its authentication/request script is byte-for-byte
unchanged. Both sites' web.app and firebaseapp.com domains were verified. All public
text artifacts were scanned; no old-company branding or personal name was found.
Previously inspected retained raster/embedded artwork contains only TownLoop/Crew/
Staff branding. No claim of remotely erasing downloaded/offline browser copies.

Both sites now have 18 files. The retired index was replaced by a clean policy landing
page; the catch-all SPA rewrite was removed. The two legacy logos, main/CSS/vendor
bundles, old PWA manifest, public server bundle and source map return 404 on all four
domains. A restricted retirement service worker replaces the old worker. Its
cache behavior was synthetically tested; no real resident/browser data was cleared
by the deployment agent. It affects only exact old app-shell cache entries as
existing online clients update, and preserves PDF caches, Auth and local app data.

All 10 preserved files per site, including Android app-link associations and Firebase
initialization files, were verified byte-for-byte. Reserved auth handler/iframe
responses remain unchanged. Firebase Auth configuration, Firestore/Storage rule
release references and checked newsletter/deletion-function revisions match preflight.
No Firebase functions/rules, billing, Gemini keys/configuration, resident records,
native app, AAB, OTA or GitHub publication were changed.

Final privacy wording was clarified after read-only inspection of the actual deployed
translation source: native Work Order/Crew translation uses Google Cloud Translation,
not Gemini. The retired web Gemini translation fallback is absent from the deployed
newsletter service. An initial successful Hosting release was followed by this
single-file privacy clarification. Active manifests differ only at `/privacy.html`;
all other initially verified files/removed paths are unchanged in final versions.

## Exposed-file scan

`exposed-files-scan.json` records focused pattern checks of the public server bundle,
its map (including original sourcesContent) and main client bundle. No high-confidence
embedded server credentials were found: no Gemini key, private-key block, refresh
or GitHub token, AWS key, JWT literal or flagged literal secret assignment. The client
bundle contained the known ordinary public Firebase client key. Original server
source, personal attribution and an additional email-shaped string in the retired
client bundle were publicly accessible; these files were removed without reproducing
contact values. This scan is not proof that every possible historical secret format
or prior exposure has been excluded. No key/token rotation was performed.

## Recovery and future publication

Do not roll back to the branded app shell or re-expose server/source-map files. Use
the clean information-only release as recovery, preserving OAuth/app-link resources.
The root legacy web Hosting deployment is now blocked by a local Hosting-only
predeploy guard; it does not modify backend configuration or deployed services.
Future releases must use the reviewed isolated Hosting package. Public page source
retains reviewable drafts; `publication.cjs` strips review notices and applies the
actual publication date for explicitly approved releases. No native consent version
was changed; legal acceptance/re-consent remains a separately controlled matter.

## Remaining Gemini concern

The published Privacy page accurately discloses the verified unpaid Gemini
configuration. It is not a resolution of the personal-data processing concern.
See `GEMINI_DATA_HANDLING_RECOMMENDATION.md`: avoid resident-identifiable AI submissions
now; separately approve a server-enforced guard/paid-service decision before resuming
personal-data analysis. PDF upload, reader and no-AI publishing remain available.
No AI gate or billing change has been activated by this release.
