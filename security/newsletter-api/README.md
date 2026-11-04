# Isolated newsletter analysis function — deployed 2026-11-03

**Pending local upgrade:** durable background jobs and real November-PDF validation
are documented in [BACKGROUND_ANALYSIS.md](BACKGROUND_ANALYSIS.md). The deployed
service still uses the synchronous endpoint; no task worker has been deployed.
The sections below record earlier deployment checkpoints.

Project: `cc-livingcommunity-app` · region: `us-central1` · isolated codebase: `newsletter-api` · sole export: `newsletterApi`.

Live service URL:
`https://us-central1-cc-livingcommunity-app.cloudfunctions.net/newsletterApi`

## Pending local PDF-loader correction (not deployed)

The live revision `newsletterapi-00001-taj` was verified against its uploaded source archive; its bundled app SHA-256 is `38ba7e1bf6fb128c528c817f71f09ac156c3c95251acbea668d9c7e41b51973d`, matching the originally prepared implementation. The function is active with Secret Manager version 1 and the dedicated service identity; health succeeds and unauthenticated inference/capabilities are rejected. This establishes deployment identity and authorization, not successful Gemini inference.

The large-PDF error is a loader bug: its fixed **26-page** loop assumes Firestore delivers eight chunks per page. Read-only integrity verification of the newest complete unpublished edition found **27 pages of three chunks each**, all 81 hashes matching, 52,580,664 encoded characters and 39,435,477 original bytes matching the completed manifest. The old reader stops after 78 chunks. The PDF is intact, and neither the published pointer nor any retained data was modified. No PDF contents were written to disk or sent to Gemini during inspection.

The local fix follows continuation tokens with independent row/page bounds and repeated-token detection, verifies available SHA-256 receipts and manifest totals/decoded byte size, and preserves complete legacy uploads without receipts. Verification failures and actual Gemini failures have separate response stages. Health/capabilities expose additive `pdfLoaderVersion: 2` while retaining API `version: 1` for installed-client compatibility. Focused HTTP pipeline fixtures verify that only fully verified bytes reach the Gemini adapter; live extraction is still pending approval/deployment.

Required next release: deploy **only `newsletterApi`** using the isolated config already documented below. No key import, IAM change, rules/index deployment, OTA, native build, new upload, or newsletter publication is required. After deployment verify health reports loader version 2, sign in as an approved Admin/VIP and retry analysis of the existing complete retained edition. Do not publish it until the owner explicitly reviews and publishes the replacement.

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

## Approved deployment — 2026-11-03

The owner approved provisioning, this isolated function deployment, GitHub push and one compatible Android Preview OTA. The existing private key was imported into Secret Manager version 1 without disclosure. Only the dedicated runtime identity has an explicit secretAccessor binding on this secret. No other function, rules, indexes or Hosting was deployed.

Cloud Functions reports `newsletterApi` ACTIVE with the dedicated identity and secret binding. Public health returns the expected service/project identity; unauthenticated capabilities and analysis requests return HTTP 401. These checks do not establish that Gemini successfully analyzed the actual newsletter.

There is no legitimate signed-in Admin/VIP app session available to the release operator. Do not impersonate a resident or mint a token to bypass this boundary. After installing the compatible Preview update, an approved Admin/VIP can select **Resume an uploaded PDF** in News and analyze the complete retained upload. No phone reupload is required; incomplete uploads are rejected. Analysis does not replace the published newsletter: the resident must explicitly complete the existing publishing action after review.

Future backend releases must remain scoped to `firebase.newsletter-api.json` and `--only functions:newsletter-api`. The unchanged key provisioning procedure above is historical setup guidance; do not rotate/import another key unnecessarily.
