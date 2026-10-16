# Native photo-upload diagnosis and fix

Recovery: `checkpoint/before-photo-upload-fix-2026-10-16` at `75a49fb`.
Original source inspected: `origin/main` at `a6567cdcbfaa578dd10a89b8c259a5650d5a0a76`.

## Findings

The original `src/services/storage.ts` uploads a browser File via Firebase `uploadBytesResumable`, then resolves `getDownloadURL`. Both clients use project `cc-livingcommunity-app`, bucket `cc-livingcommunity-app.firebasestorage.app`, and Firestore `(default)`.

| Feature | Storage prefix | Firestore collection | Image fields |
| --- | --- | --- | --- |
| Work Orders | `work_orders/` | `work_orders` | `photos: string[]`, `photoUrl` (first image) |
| Discussion Feed | `feed/` | `discussion_feed` | `media: {type,url,name}[]`, `mediaUrl` (first image) |
| Marketplace | `marketplace/` | `marketplace_posts` | `media: {type,url,name}[]`, `mediaUrl` (first image) |

Web names use timestamp, sanitized user ID and filename. Native retains its collision-resistant timestamp/user/random/filename convention under those same prefixes. Upload metadata retains uploadedBy, uploaderEmail, uploaderName, folder, originalName, uploadedAt, and contentType. Native requires the signed-in user and an existing approved profile; the Firebase ID token is used for Storage authorization. Existing Firestore save transactions and schemas are unchanged. No service account or administrative credential is used.

The web service also has a local data-URL fallback on Storage errors. That fallback does not prove that a web upload reached Firebase; the native fix intentionally requires a real Storage URL.

## Reproduced failure

The old shared native picker reads the complete file into a Uint8Array and passes it to Firebase's browser upload implementation. The installed React Native BlobManager explicitly rejects ArrayBuffer/ArrayBufferView parts. Reproducing that exact restriction against the installed Firebase SDK with a 1KB byte array produced:

```
UNHANDLED: Creating blobs from 'ArrayBuffer' and 'ArrayBufferView' are not supported
Upload observer settled: false state: running
```

The small-file multipart path builds a Blob asynchronously and throws without settling the UploadTask observer. The UI awaits that observer while `busy` also prevents closing the panel. There were no deadlines for upload or URL resolution. Reading full-size media into JS also adds unnecessary memory pressure. This proves a broken native code path, but no device log was available to establish which path each reported phone upload took.

The reproducible diagnostic is `native/scripts/diagnostics/reproduce-rn-storage-blob.cjs`; run from native with Node. It models RN's Blob restriction and uses a demo configuration, not production credentials.

## Implementation

- Shared native file transport uses existing `expo-file-system/legacy` native upload tasks, sending raw file bytes directly from disk.
- Starts the same Firebase resumable protocol used by the SDK, with the resident's Firebase ID token and unchanged metadata; then uploads/finalizes the file and resolves the canonical URL through `getDownloadURL`.
- The web preview continues to use actual browser File/Blob objects with the Firebase SDK, never Expo's native File byte API.
- Gallery content URIs are copied into private cache. Images are converted to JPEG at 85% quality, with the longest side limited to 2048px. Videos remain supported in Social. The 25MB limit remains.
- Account checks, file preparation, token retrieval, transfer and download URL resolution have bounded waits. Transfers time out after 120 seconds and are cancelled. Session changes reject and cancel the transfer.
- Progress stops short of 100% until the persistent download URL is available. Errors propagate to the existing editors, whose finally blocks unlock the form and allow retry. Native permission/HTTP errors include useful explanations.
- No Firestore record is created by attaching a photo. Existing submit/publish transactions only run after the user submits the draft. Upload failure cannot produce a partial Firestore post, listing or ticket. If a multi-file batch partly uploads before failing, already-created Storage objects can remain unreferenced; this fix does not delete remote files.
- Only temporary local files created by this operation are cleaned up. Gallery originals, existing Storage objects, authentication and other app data are untouched.

## Verification and limits

Validation: all 74 tests passed; TypeScript, Expo lint and Expo dependency compatibility checks passed. Android Hermes export passed; the final source (including authorization on finalize) also passed Android JS export and the 11 targeted upload tests.

Automated tests exercise file-based transfer for all three folders, metadata, persistent URL handling, progress, permission failures, session mismatch/change, hung-promise cancellation, Android content URI preparation and large-photo resizing. These are mocked transport tests, not claims of real uploads.

No Android device is connected to adb. Consequently gallery/camera uploads on hardware, actual Firebase authorization, submitted records surviving restart, no-photo submissions in the UI, and cross-client display still require device/account testing. Existing data decoding and action tests cover compatibility locally. No production test records were created.

The repository config declares Firestore rules but no deployed Storage rule source. Live Storage rules/locations were not verified through an authenticated console. No rule, bucket, collection or production data was changed.

## Delivery

No dependencies or native configuration changed: Expo FileSystem and ImageManipulator are already installed in the Preview APK. This fix is JavaScript-only and OTA-capable for a matching runtime. Recheck the runtime against the installed Preview APK before an approved publication. No EAS update, APK rebuild, GitHub push, or Production change was performed.

Phone review after an approved Preview delivery: attach gallery and camera photos in each supported feature; submit one clearly identified test record per feature; restart and verify the image; check the original web app; test offline upload and retry; test a large photo and a no-photo submission. Do not delete any test records without user authorization.
