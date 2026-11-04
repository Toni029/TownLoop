# Newsletter analysis failure: verified diagnosis and release

## Deployed evidence (read-only inspection)

- Function `newsletterApi`, revision `newsletterapi-00002-faq`, PDF loader 2.
- Deployed `lib/native-app.cjs` SHA-256 matches the reviewed `fcf8b49` bundle:
  `f856106d036614511fc222085a1356f69466721900aabf054c6c009a6a754a3f`.
- Analysis request at 2026-11-04 00:20:21 UTC, trace
  `3e0fec1de1962427bbbff6027fe04512`, returned HTTP 502 after 100.2 seconds.
- Reconstruction passed; Gemini file upload failed, readable-text fallback was
  unsuitable, then the existing visual fallback rendered 12 pages (4,996 KB of
  images). This is analysis preparation, not another phone upload.
- Model `gemini-3.1-flash-lite` completed batches 1 and 3; its remaining batch
  failed with status 503. `gemini-3-flash-preview` subsequently failed without a
  recorded status. Final `gemini-3.8-flash` failed with status 503. The route
  discarded the last provider error and returned a generic 502 message.
- The old logs do **not** contain the provider's full response body or the
  preview-model exception. Do not invent an exact error sentence, quota issue,
  parsing failure or overload reason. Confirmed final failure: Gemini model
  processing, HTTP 503 (service unavailable), not retained-PDF integrity.
- Configured models were confirmed by the authenticated model catalog, each
  supporting `generateContent` and a 1,048,576-token input limit. No model change
  or replacement key is required. Secret version 1 remains bound server-side.
- A separate, tiny nonresident fixture confirmed Files API upload currently
  returns 404. Its existing image fallback works and is preserved. No full
  newsletter inference was run during diagnosis.
- Previously verified retained PDF: 39,435,477 bytes, 81/81 chunk hashes, complete
  manifest. The request logged approximately 38,511 KB and 12 rendered pages;
  neither exceeds Gemini's 50 MB / 1,000-page PDF limits:
  https://ai.google.dev/gemini-api/docs/document-processing

## Local correction

Retry only transient generation failures, at most twice per model/batch, with
backoff and a shared 230-second analysis budget. Each request has an abortable
timeout; SDK retries are explicitly disabled to avoid multiplying retry loops.
Completed batches are not sent again within that analysis request. Existing
model fallback and complete-result caching remain intact.

Return fixed, safe errors distinguishing service unavailability, quota, timeout,
credentials, model availability and response parsing. Include a generated request
reference and structured failure stage/status in logs, never raw provider error
text, prompts, document contents or secrets. A provider outage can still exhaust
the bounded retries; the app then tells the user to retry analysis later using
the retained upload.

Admin/VIP authorization, integrity verification, original PDF bytes, upload speed,
explicit publishing and the current newsletter are unchanged. Retrying analysis
reuses the existing Firebase PDF reference; it does not upload the PDF again from
the phone. Partial Gemini results are never published or reported as complete.

## Verification and release gate

18 focused fixture tests pass: retained reconstruction/integrity and authorization,
safe route errors, correlation references, transient retry/deadline bounds, partial
batch reuse, model fallbacks and Gemini temporary-file cleanup. Scoped server
TypeScript and isolated function packaging pass. No physical-phone or successful
live full-newsletter analysis is claimed.

After approval, prepare the isolated artifact with
`node security/newsletter-api/prepare.cjs` and deploy **only `newsletterApi`** using
the existing isolated deployment configuration. Do not deploy root functions or
rules. No secret, IAM, index or rule change is needed. The installed app already
displays the JSON `error` field, so this fix requires a Firebase backend deployment
and does not require an OTA or new APK. The earlier resume-list fix `c1c6d34` is a
separate client release; do not conflate its release with this backend correction.

Nothing was deployed, pushed, published or replaced during this task.
