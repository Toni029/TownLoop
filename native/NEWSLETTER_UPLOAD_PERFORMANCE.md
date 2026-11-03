# Newsletter PDF transfer checkpoint (historical e5f2857)

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
