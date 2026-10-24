# Discussion photo-selection isolation — 2026-10-23

## Confirmed behavior and correction

Discussion and Marketplace both mount `CreateEditor` and call `pickAndUpload`.
Neither picker path depends on title/description. Previously, picker return set a
raw local preview and immediately awaited a Firestore draft transaction, native
image processing, and upload while the editor/sheet remained busy. A pending
processor fixture demonstrated this coupling; the new selection-only assertion
failed against the original code (`draft count 1 != 0`). This is not proof of the
physical phone's native ANR.

Discussion selection now stages the local assets and releases the sheet without
creating a draft, processing, uploading, or publishing. Explicit Post validates
text first, then runs the existing authorized processing/upload path. Partial
successes are retained; failed operations release busy/progress in `finally` and
keep text and selected assets for retry. Normal staging does not show a Retry
button. Marketplace/Work Orders keep their previous upload behavior. The existing
native picker options, local preview component, Firebase permissions, and deadlines
are unchanged.

## Focused checks

`node --test native/tests/feed-picker-editor.test.ts native/tests/photo-first.test.ts`
executes the real editor/media orchestration with native/network boundary fixtures.
It covers empty/filled fields, photo-first typing and explicit publication,
cancel/retry, processor rejection/recovery, no duplicate completed transfer, and
unchanged Marketplace recovery. TypeScript is checked separately.

Actual Android 11/API30 x86_64 emulator checks used the existing compiled Preview
native binaries with a disposable, independently signed JS test overlay, not a new
native/EAS build. No Firebase account, network write, or resident data was used.
The fixture uses the real editor, ProductDialog, native Image, gallery picker,
filesystem, and ImageManipulator; only identity/draft/transfer/publication boundaries
are fixtures. A generated 4000×3000 JPEG was the only selected media.

- Empty fields → real gallery confirmation → mounted preview; Close enabled and
  JS heartbeat continues; no draft/transfer before Post.
- Type title/body after selection → real image processing → fixture publication;
  sheet closes normally.
- Filled fields → cancel picker → fields retained → reopen picker/select/confirm;
  preview appears, form remains responsive.
- Corrupt only that generated selection's private cache copy → real
  `Context.renderAsync` / `Loading bitmap failed` rejection on Post; form and text
  retained, Close enabled. Restore fixture bytes → Retry → Post succeeds.
- Captured stage totals: 3 picker launches, 2 selected returns, 1 cancellation,
  3 draft attempts (including forced failure), 2 transfer boundaries, 2 fixture
  publications, no fatal exception in captured app logs.

## Limits — do not call the physical-phone freeze reproduced or fixed

API30's default OPEN_DOCUMENT fallback displayed fixture files but would not select
them in this environment. The disposable harness therefore used the real native
picker's **legacy gallery route → Photos → device folder → Done**. This override
is confined to the external test harness; it is NOT shipped in app code. Thus the
phone's modern picker/return behavior and original complete freeze remain unverified.
Native image-decoding/preview memory problems are not ruled out. The fix removes a
confirmed automatic processing/backend dependency after selection; it does not
claim that dependency caused the phone's ANR.

The native emulator fixture preceded only the final minor UI change hiding Retry
on successful staging; the focused callback test verifies that final condition.
No actual Firebase submission was performed. No physical phone, Production action,
APK release build, OTA, or GitHub push was used. Startup was not changed.

Disposable harness/scripts and fixture-only logs are outside the repository at
`/home/tonio/.cache/townloop-picker-lab/`; no diagnostic controls or collection are
included in the application. Emulator stopped after verification.
