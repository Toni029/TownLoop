# Newsletter upload reliability — 2026-11-03 local follow-up

## Actual findings

The Samsung baseline is approximately ten minutes; no new physical-phone measurement is available. A temporary `UnknownHostException` is a device/network DNS failure reaching Firestore, not a missing Gemini key or rejected Firebase permission. The old uploader did not automatically retry these failures. Its 60-second confirmation wrapper could time out while leaving the actual fetch unresolved. Retrying retained that pending promise. Metadata acknowledgement still used the SDK write queue after transfer. Title edits discarded partial upload IDs, and closing the uploader lost its resume journal.

The existing newsletter format is Base64 Firestore chunks shared with the reader, adding roughly 33% to raw bytes. The earlier synthetic benchmark did not establish mobile throughput. On the current 42 MiB synthetic fixture, the transport sends 90 bounded chunk commits instead of 23 larger batches: maximum individual payload falls from about 2.5 MiB to 640 KiB, with two concurrent requests. This deliberately trades some request overhead for shorter acknowledgement windows and smaller failed-transfer retransmissions. It is not a claim of faster real-device bandwidth.

## Implemented, not released

- Each actual request has a 45-second abortable deadline, up to five bounded attempts and exponential backoff with jitter. DNS/network failures, 408/429/transient server errors retry; authorization/validation failures do not. One expired Firebase ID token can refresh. Cancel aborts active requests/backoff. A genuinely unavailable connection ends with a recoverable error, not a permanently pending promise.
- Deterministic existing chunk paths and atomic SHA-256 receipts let an ambiguous commit be checked before resending. Only server-confirmed bytes count as uploaded. Final draft metadata uses the same bounded transport instead of a potentially queued SDK write.
- Unpublished draft metadata is checkpointed before transfer. Recovery lists partial drafts only for their verified uploader, with consistent metadata and hash receipts. The manager selects the original PDF; **all existing chunk hashes are validated before any write**. Only missing parts transfer. A different PDF is rejected without overwriting saved bytes. Legacy partial uploads without hashes are preserved and excluded from unsafe resumption.
- Complete retained uploads, including legacy orphan parents, remain recoverable without phone reupload. Analysis and explicit publishing remain separate; no transfer touches `newsletters/current`. Editing title/month no longer abandons confirmed transfer state. Timing is recorded on transfer failure as well as success; accumulated concurrent request time is not pure network time.

## Storage comparison and verified compatibility gate

Read-only checks of the **currently deployed** Storage rules found `bounded(): size < 25 * 1024 * 1024` on `newsletters/{editionId}/document.pdf`. Therefore the existing permission policy rejects this 42 MB document. Binary resumable Storage would remove Base64 overhead and is preferable for large files, but it cannot be substituted under the currently deployed contract. It needs separate approval for a newsletter-only limit change plus retained-Storage-PDF support in `newsletterApi`; the current API loader reads Firestore chunks. Do not weaken permissions, use public download tokens, or silently double-upload to work around this. No rules/reader/backend changes are included in this checkpoint.

Read-only metadata confirms a complete unpublished **81/81-part** recent upload is still retained (52,580,664 encoded characters). An 8/81-part newer attempt and an older 60/79-part attempt are incomplete. Metadata alone does not prove a particular filename or PDF validity. Recovery validates the chosen complete PDF through the existing server loader; no resident PDF contents were inspected here.

`newsletterApi` is ACTIVE in `cc-livingcommunity-app`, bound to Secret Manager `GEMINI_API_KEY` through its dedicated service identity. Public health succeeds; unauthenticated capabilities and analysis reject with 401. The correct endpoint is already bundled in `native/newsletter-api.json`. The earlier “Set EXPO_PUBLIC...” error text is absent from current native code. This does not establish which update the Samsung currently runs or successful Gemini inference.

## Release and verification

Focused fixtures cover DNS retry, deadline abortion, permission denial, cancellation, bounded failure, ambiguous successful commits, recovery across composer closure, mismatched-file rejection, account isolation, byte-exact assembly and existing complete-draft/analysis recovery. Native TypeScript uses the installed native compiler. No real network upload speed or Samsung/iPhone result is claimed.

This checkpoint is shared Android/iOS JavaScript using already installed Expo Crypto/FileSystem APIs. After owner approval: push the commit and publish one Android Preview OTA only after verifying the exact installed runtime. No new APK, Firebase deployment, rules change or key setup is required for these compatibility-preserving reliability fixes. On Samsung, first use **Resume an uploaded PDF** and select the complete retained entry; a fresh upload should not be necessary. Verify Wi-Fi/mobile DNS/connectivity if failures remain persistent, and record real timings separately from local synthetic checks.

---

## Historical transfer checkpoint (e5f2857)

Superseded for analysis/recovery and transport by `NEWSLETTER_ANALYSIS_RELEASE.md`. The measurements below describe the first optimization, not a real phone speed guarantee.

Local change only. No resident PDF was inspected or uploaded, no backend/rules changed, and no release was published.

## Bottleneck and compatible fix

The native picker previously read the entire cached PDF into Base64 before showing the selected file. The uploader then awaited each 650 KiB Firestore document write individually. A 42 MiB source becomes 56 MiB of Base64 and requires 89 serial acknowledgements. The UI also mapped successful upload completion to 40%, obscuring the transition to analysis.

The new native path (Android and iOS):

- Keeps DocumentPicker's single cache copy and moves it into the existing account-scoped cleanup namespace. Selection validates only eight header bytes. Copies retained for retry are released on replacement/closing; reads reject account changes.
- Reads 480 KiB byte ranges using the already installed Expo FileSystem native Base64 range reader. At most two four-document batches are pending (about 5 MiB encoded, excluding SDK buffers), rather than keeping the entire encoded PDF in JS memory.
- Preserves the existing newsletter/chunks paths, metadata, ordered data-URL format and immutable-edition publishing transaction. The existing native and website readers still assemble the identical PDF bytes.
- Reports original PDF MB and percent only after Firebase acknowledges batches; 100% means the PDF transfer is confirmed. Gemini retains its existing implementation and gets the unchanged full data URL only when analysis starts. Analysis and publishing have separate statuses.
- Cancellation stops scheduling new batches, not already-submitted Firestore writes. Pending and confirmed batches remain associated with the same account/file/edition in the open composer. Retry awaits unknown outcomes and skips confirmed work. Confirmation timeout is recoverable. Nothing publishes a partial document. Closing/restarting discards the in-memory resume journal; reselecting starts an unpublished draft with a new ID.

Direct binary resumable Storage transfer was considered: the existing deployed Storage limit is 25 MiB and the original website expects Firestore PDF chunks. Moving a 42 MiB PDF there would require separate Storage-rule and reader compatibility work. This fix does not do that. The existing Base64 transport overhead remains, but full-file upload preparation and serial request latency are removed.

## Focused measurements and checks

`node --test native/tests/newsletter-size.test.cjs native/tests/pdf-transfer.test.cjs`

A **synthetic** 42 MiB fixture with 10 ms acknowledgement delay measured approximately 930 ms for 89 serial writes versus 128 ms for 23 batches with two in flight; range slicing in that in-memory fixture took 2 ms. This isolates acknowledgement scheduling, not real bandwidth, native file I/O, Firebase server performance, or device timing. Do not present it as a real upload-speed guarantee.

The transfer adapter exposes separate preparation, range-read, accumulated commit-wait and wall-clock transfer measurements without recording PDF content or identities. Preparation timing begins after the picker returns (excluding human selection time and its internal cache-copy time). Concurrent accumulated times are not additive wall-clock phases. No full-file read happens before uploading unless the browser-specific native web picker is used; the original hosted website is untouched.

Focused fixtures cover exact byte reassembly, batching/concurrency bounds, progress, failed-write retry, pending-write cancellation/timeout, account isolation, size validation, lazy AI reads and cache disposal. Existing reader/zoom/web tests remain passing. TypeScript verifies the shared Android/iOS implementation. Real-device upload throughput and UI behavior still require Android/iPhone testing after approval.

## Release

JavaScript-only: uses Expo FileSystem APIs already installed and used by TownLoop; no dependency, app configuration, runtime, or native-resource changes. Suitable for a compatible Preview OTA, subject to the normal runtime check at publication. No APK/iOS rebuild or Firebase deployment is required for this optimization.

The previously prepared server AI PDF-cap change is independent and remains undeployed; this optimization does not raise the live Gemini endpoint's limit. Large files exceeding that endpoint's current limit can still be published with optional analysis switched off until its separate deployment is approved.
