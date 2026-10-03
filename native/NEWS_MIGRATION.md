# Native News migration

The Expo app is the primary TownLoop client. Root web sources on main at a6567cd are the migration reference only. Work Orders is paused, and no Work Orders files were changed in this phase.

## Checkpoints

- f8dbc9f: preserved Home checkpoint; pushed tag `checkpoint/pre-news-f8dbc9f` before News work.
- 6091034: TownLoop News visual structure and editing dialogs.
- 9337344: live Firebase subscriptions, resident-specific RSVP state, guarded actions and tests.
- 75d2ba9: native newsletter publication and full-screen PDF reader; both platform bundles passed.
- Final parity/verification checkpoint: the commit containing the final version of this report (see Git history).

The pre-existing untracked root package-lock.json remains preserved in the named pre-Work-Orders Git stash. It was not discarded or included in native commits.

## Migrated

- Community Bulletin heading, publication gradient card, publication/custom-upload badges, edition metadata and description, two counted green selectors, dated RSVP cards, attendance/spots/deadline indicators, resident-specific Going state, and amber pinned notice cards with management attribution.
- Event creation/editing/deletion, highlight creation/deletion, role-dependent controls, and live refresh of all three Firebase sources. Existing News has no separate facility-notice or announcement collection: those are highlight categories.
- Atomic RSVP updates based on the current attendee list, with same-action double-tap protection. Resident identity comes from `attendees[].id/userId`, never a shared `userRsvp` flag. Only the current resident is added/removed. Same-name neighbors are preserved. No false success on failed writes.
- Manual publishing without Gemini, PDF selection, filename-based month/title detection, editable title/edition/description, review/confirmation, upload progress, retryable failures, replacement/removal. Only uploaded PDFs are used; there is no bundled newsletter or restore-default action.
- Native PDF rendering using react-native-pdf (not a WebView, canvas or embedded web app): full-screen reader, compact title/download/upload/close bar, continuous pages, previous/next/direct-page controls, pinch/double-tap and 75–250% button zoom, fit-width, loading/failure/retry, Android back, safe areas and native share/save.
- Same Jakarta/Playfair fonts, Lucide icons, card geometry, colored dialog headers, responsive wrapping, custom controls and opening/closing motion intent. Success messages remain floating toasts rather than interrupting dialogs.

## Firebase/data

Existing project and `(default)` database are retained:

| Path | Use |
|---|---|
| `users/{uid}` | Live approval/role and authorized action checks; no new user schema/collection |
| `community_events/{id}` | Existing event fields, attendees, counts, spots, edition links; create/update/delete and RSVP transactions |
| `community_highlights/{id}` | Existing pinned notices and edition links |
| `newsletters/current` | Authoritative current-edition pointer/removal state |
| `newsletters/{editionId}` | Published edition metadata and PDF chunk count |
| `newsletters/{editionId}/chunks/{index}` | Existing chunked base64 PDF representation |
| `newsletters/current/chunks/{index}` | Legacy chunks: removed during cleanup; no new writes to this legacy mirror |
| Storage `newsletters/{editionId}/document.pdf` | Cleanup of pre-existing PDF objects |

Uploaded newsletters remain current across month and year changes until an administrator explicitly removes or replaces them. A missing/removed newsletter shows an empty state; legacy default metadata cannot open a built-in file.

PDF bytes are staged under a new edition id before an atomic pointer switch. The real October file is 16,344,292 bytes; a single Firestore transaction cannot contain it. The new publisher retains the existing edition chunk schema and does not duplicate those bytes into the legacy current/chunks mirror. `current.totalChunks=0` prevents accidentally reading obsolete legacy bytes; both native and the current web reader resolve the current edition id. Uploads are capped at 32 MiB to bound phone memory.

An active PDF is checked against server-confirmed `newsletters/current` before and after download, on app resume, and through the live News subscription. Removal/replacement unmounts the reader and deletes its temporary file. Removal writes a tombstone first, then cleans cloud files; a partial cleanup has a visible retry action. A cached pointer is insufficient to open a newsletter. Closing deletes the temporary reader copy. Already exported user copies cannot be recalled. No published old-edition browsing is exposed.

Old AI-edition filtering and newest-first highlights follow the reference. Event ordering imports the existing `sortEventsEarlyFirst` implementation. Manual entries survive edition changes. Home recurring activities and reminders are untouched; RSVP events do not replace those activities.

## Permission blocker found in the reference

The checked-in Firestore rules allow writes to `community_events` only for `isManager()` (approved admin or VIP). The reference UI nevertheless offers RSVP to residents and treats staff/legacy flags as managers. Native preserves the reference visibility but reports permission errors honestly. No deployed rules were broadened or replaced.

Resident RSVP cannot be called verified until the deployed permissions are checked and an authorized server/rules solution is provided. Recommended: a trusted authenticated RSVP endpoint that transactionally alters only the caller's attendee record, preserves others, checks approval/capacity and updates counts. Do not grant unrestricted event writes to all residents to work around this mismatch. The existing array model makes arbitrary identity-safe edits difficult to enforce solely in Rules without a trusted handler.

## Gemini backend: deliberately deferred by the user

Inspection found root Express server routes and static Firebase hosting (`site: townloop`, all routes rewritten to index.html), but no deployed API origin in repository configuration or local URL environment settings. Static Firebase hosting does not deploy the Express server. Private environment values were not printed or copied.

Required integration:

- HTTPS `POST /api/newsletter/extract-content` from the existing `server.ts`.
- Header `Authorization: Bearer <Firebase ID token>` and JSON content type. Server verifies current approved manager role against the same `(default)` project.
- Body: `newsletterId`, `base64Data` (PDF base64 without data URL prefix), `mimeType: application/pdf`, `fileName`, `editionTitle`, `monthEdition`, `isReanalysis`, `isNewUpload`, optional `extraInstructions`.
- Response: existing server extraction result (`events`, `highlights`, `rsvp_events`, `pinned_highlights`, edition metadata). Validate the result and show editable review before publishing. Preserve manually entered entries and never treat ordinary recurring activities as RSVP events unless the document explicitly requires RSVP.
- `GEMINI_API_KEY` belongs only in the deployed server environment. No Gemini/private server credential, direct Google call, or actual analysis request exists in native code. `src/news/ai.ts` retains the typed contract and clear deferred state.
- Configure a public HTTPS API origin only after deploying the authenticated server and its rate limits. A phone cannot call this computer's localhost. Production transport must not enable trust-all-certificates.
- Optional legacy server cleanup endpoint: authenticated `DELETE /api/newsletter/current`. Native removal can revoke in-app access and purge Firebase data now; a still-running legacy server's filesystem copies need that server connected for physical cleanup.

## Validation and limits

TypeScript, lint, model/subscription tests (including Home regression tests), Expo dependency checks and Android/iOS export are run for this phase. Local visual harnesses render the actual native components and unchanged reference with identical isolated fixtures; no production test records are written. The fixture harness is outside the production router. Screenshot comparison is a native-component browser layout check, not proof of device rendering.

Native PDF rendering requires a development/release build, not Expo Go or the browser preview. `eas.json` provides development/preview build profiles; no paid/cloud build or deployment was started. Use `npx expo run:android` with an installed Android SDK/device, or `npx expo run:ios` on a Mac; EAS development builds are another option. Then use `npx expo start --dev-client`.

Still require real-device checks: PDF rendering/pinch/rotation/large-file memory, Android back and iOS sheet/file-picker/share behavior, VoiceOver/TalkBack and font scaling, keyboard on long forms, reduced motion, real authenticated admin/resident flows and removal from a second device. This host has no connected Android device and cannot run iOS.

Unavoidable platform differences: native document picker and share/save sheet replace browser file input/download; native page rendering/gesture physics differ slightly; the modal backdrop approximates browser backdrop blur using translucent dark tint; PDF text selection depends on platform support. The 32 MiB upload bound is explicit. AI actions are deliberately deferred. No fake fallback News data is shown.

Do not resume Work Orders until the user reviews News and authorizes continuation.

## Recorded validation results

- TypeScript and lint: pass.
- Tests: 19 pass (all existing Home/auth tests plus eight News tests, including uploaded-only newsletter availability and retention across edition months).
- Firestore emulator: 28 permission/concurrency/removal checks pass against the unchanged repository rules in `demo-townloop-news`. This confirms resident/staff write restrictions; it does not validate production-deployed rules. `verification/news-emulator.mjs` refuses a non-local emulator host.
- Expo doctor: 21/21 pass, including after native project generation. Expo dependency versions: compatible.
- Android/iOS native project generation and bundle exports: pass, including native PDF code. Generated project folders remain ignored. Actual APK/IPA compilation is not verified.
- Visual harness: 16 assertions pass at 320, 390 and 768 px: overflow, dialog validation, resident/admin controls, tabs and empty/error states. Reviewed alongside the unchanged web reference; corrected button sizing, badges, headers and wrapping.
- Real October PDF: 33 existing-format chunks reconstruct all 16,344,292 bytes identically; checked locally with no upload.
- Browser-API inspection: no browser-only APIs in News Android/iOS implementation. `.web` adapters explain the mobile build requirement rather than embedding a website/PDF plugin.
- Private server key comparison: no matches in Android/iOS bundles. Existing public Firebase client configuration is retained.
- Dependency audit: 36 unresolved findings (11 moderate, 25 high), including inherited Expo/Firebase dependencies and native plugin chains. This is not a clean release-security audit. No forced downgrade was applied.

**Acceptance still open:** signed-in production News data has not been independently confirmed in this run; no test records or real RSVP/admin mutations were written to production. Await resident/admin review and native device tests. The resident RSVP permission mismatch must be resolved before full feature parity can be signed off. Work Orders remains paused regardless.

Committed visual review images are in `verification/screenshots/` (isolated fixtures, not production records).

## Uploaded-only newsletter correction

Removed the bundled default PDF, its native asset loader, and the restore-default action. The publication card and upload form no longer use legacy default edition metadata as a real uploaded publication. With no upload, News shows “No Newsletter Uploaded” and offers managers an upload action. A removed upload stays removed; there is no fallback or scheduled expiry. Existing uploaded files, Firebase records, Home, and Work Orders were not changed by this correction.

TypeScript, lint, all 19 tests, Expo version compatibility, and fresh Android/iOS exports passed. Both export asset lists contain no bundled PDF. An isolated layout harness also passed 18 uploaded/missing/removed/default-metadata and resident/admin checks. Physical-device PDF verification remains outstanding as above.
