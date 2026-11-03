# Isolated newsletter analysis function — prepared, NOT deployed

Project: `cc-livingcommunity-app` · region: `us-central1` · isolated codebase: `newsletter-api` · sole export: `newsletterApi`.

Prepared public service URL (not live yet):
`https://us-central1-cc-livingcommunity-app.cloudfunctions.net/newsletterApi`

## Existing key verified without disclosure

Read-only checks on 2026-11-03 found:

- The existing backend `.env` contains `GEMINI_API_KEY`, is mode 600 and ignored/untracked by Git.
- A read-only Gemini model-list request accepted that key (HTTP 200). No inference, PDF upload or quota/billing guarantee was made.
- Secret Manager has one existing translation-key secret. An in-memory comparison confirmed it is **different** from the local Gemini key; no values were displayed or saved. Leave that secret unchanged.
- No Gemini environment binding was found among the 25 Cloud Run services checked in us-central1.

The owner does not need to obtain or paste another key. After separate approval, `provision.cjs` can import the existing private backend value directly into a new `GEMINI_API_KEY` Secret Manager secret over authenticated HTTPS. It never passes the value on a command line, writes it to another file, or logs it. Existing enabled secret versions are reused instead of overwritten. Merely invoking the script without `--approve-provision` performs no cloud actions or credential reads.

## Runtime and privacy

The package reuses the existing extractor, Gemini Files API/model fallback/cache, PDF text/image helpers, canonical Admin/VIP authentication and retained-Firestore-PDF loader. The function is HTTP reachable; Firebase ID-token verification plus approved Admin/VIP status in `(default)` authorizes capabilities/inference. Health alone is unauthenticated. Clients cannot nominate another database, storage URL or arbitrary download host.

The custom runtime identity is `townloop-newsletter-api@cc-livingcommunity-app.iam.gserviceaccount.com`. Provisioning grants it `roles/secretmanager.secretAccessor` **on this single secret only**, preserving existing IAM bindings/etag. No project Editor, Firestore or Storage role is requested: reads forward the authenticated user's ID token and enforce existing Firebase rules. The existing website, named database, workers, notification functions and all other codebases are excluded.

Runtime: Node 22, 2 GiB, concurrency 1, min instances 0, max instances 2, backend timeout 360 seconds. Client analysis timeout remains 300 seconds. No schedules or destructive handlers are exported.

Phone analysis requests are small retained-PDF references, not 42 MB uploads. This avoids the HTTP-function request-size ceiling; an explicit 64 KiB reference-only bound also handles Functions Framework pre-parsed bodies. Backend reads validate all chunk indexes, totals and PDF bytes before passing the document to the unchanged extractor. No original PDF is rewritten/compressed. A recent complete 81-chunk upload was found during the preceding metadata verification; recovery can select it and reject any incomplete/changed upload when used. Retries reuse Firebase bytes and do not upload the file again from the phone.

## Size limits

42 MB fits the prepared native analysis limit of **50,000,000 bytes**, conservatively matching Gemini's documented 50 MB / 1,000-page PDF ceiling. Publishing remains 64 MiB. Existing fallback constraints remain: text fallback 100 pages / 500,000 characters; image fallback 30 pages / 12 MiB rendered images. These helpers may reject unsupported documents explicitly; they do not alter the original stored PDF. Key validity and dependency checks do not establish successful analysis of the actual resident newsletter.

## Local preparation (safe; completed)

`node security/newsletter-api/prepare.cjs`

This bundles only the shared native Express app and existing analysis modules into ignored `.release/newsletter-api`. Its pinned dependency lock matches installed server versions. No `.env`, signing files, assets, original website or existing function exports are copied. Native PDF.js/canvas dependencies and the packaged function were checked locally using a synthetic PDF and unauthenticated HTTP requests. To enable these optional integration checks on a clean checkout, prepare the artifact, run `npm ci --prefix .release/newsletter-api --ignore-scripts --no-audit --no-fund`, then run `node --test tests/newsletter-function.test.cjs`; otherwise the dependency-dependent cases explicitly skip.

The mobile client now defaults to the exact prepared Firebase URL through `native/newsletter-api.json`. Its existing readiness/size checks prevent proceeding while the function is absent or misconfigured. `EXPO_PUBLIC_TOWNLOOP_API_URL` remains an optional **public URL override**, never an API-key setting.

## Owner approval required; none of these actions has run

1. **Approve secure provisioning:** import the existing backend key, create the dedicated runtime identity, and grant that identity access to this one secret. We can perform this using the existing authorized Firebase operator session; no key/password/token needs to be pasted. Command for the operator after approval: `node security/newsletter-api/provision.cjs --approve-provision` with `TOWNLOOP_FIREBASE_AUTH_MODULE` pointing to the installed Firebase CLI auth module if needed. No function is deployed by this script.
2. **Approve deployment of this one function only:** `firebase deploy --project cc-livingcommunity-app --config firebase.newsletter-api.json --only functions:newsletter-api`. The predeploy step only repackages local source. No Hosting, rules, indexes, named-database changes or other functions are in this configuration. Do not use a blanket functions deployment.
3. Verify public health plus unauthenticated rejection with `node native/scripts/verify-newsletter-api.cjs`; then verify approved Admin/VIP capability access and one authorized retained-PDF analysis. Keep the current published newsletter until explicit review/publishing succeeds.
4. **Separately approve the compatible Preview OTA** containing the prepared recovery/client endpoint changes. No APK rebuild is required for this JavaScript configuration. The previous app bundle must not be described as containing these unpublished fixes.

Until those approvals, everything stays local: no Secret Manager import, IAM/service-account creation, deployment, Expo environment change or publication has occurred.
