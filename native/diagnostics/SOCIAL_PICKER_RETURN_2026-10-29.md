# Social picker-return correction — local preparation

## Confirmed defects and scope

The shared Social editor had two inconsistent return paths:

- Marketplace immediately set the entire sheet busy after selection, then waited
  for draft creation and image processing before transfer progress existed. Its
  fields, sheet close and gestures were disabled during that wait. The deterministic
  pending-processing regression fails against the original editor for empty and
  filled Marketplace fields. Empty text is not an image-selection validation rule.
- Android native-window recovery from 5afbf1e ran for cancellation/rejection only;
  successful selection explicitly skipped it. Both editors now use that existing
  recovery for every settled picker outcome. This is a lifecycle hardening, not
  proof that a stale modal caused the physical Samsung ANR.

7c20fad staged Discussion assets until Publish but left Marketplace on automatic
processing/upload. a5c3ac3's authenticated native-file transport, compression,
metadata, deadlines and retry/link-resolution protections are retained.

Work Orders uses an image-only picker, a dedicated WorkOrderSheet, and displays
processed attachments. Its busy state is established before launching the picker;
Social previously changed it while the external activity was returning. No Work
Orders implementation or upload transport behavior is changed here. Inspection of
Expo's installed MediaHandler shows a selected still photo takes handleImage for
both image-only and mixed image/video filters; enabling videos does not itself
initialize a video player for a selected still photo. Video support remains enabled
in Social and remains rejected for Work Orders.

## Correction

Both Social composers stage local images/videos without draft writes, processing,
uploads or publication. They remain editable and support removal, replacement and
additional selections; cancellation keeps prior attachments/text. Explicit Publish
validates required title/body first, then reuses the existing linked uploader and
correct collection/folder. Upload percentages begin only from transfer callbacks;
preparation has a distinct button label. Failed processing or transfer keeps the
raw selection and entered text; finally releases busy state. Completed transfers
retain duplicate-free link retry. Late picker/results after unmount cannot publish
or mutate the retired editor.

No Firebase rules, backend, native dependencies, startup, or unrelated screens
are changed. No APK is assembled, EAS build submitted, OTA published, or GitHub
push performed. This client-only correction can use a runtime-matched Preview OTA
once separately approved.

## Focused verification

Command: `node --experimental-strip-types --test native/tests/feed-picker-editor.test.ts native/tests/photo-first.test.ts native/tests/media-upload.test.ts`

Four new empty/filled picker-return assertions failed against the original source;
40 focused tests and native TypeScript pass with the correction. These execute the real editor callbacks
and media orchestration with native/network boundaries supplied by fixtures. They
cover staging, editing, cancel/reopen, removal/replacement, videos, validation,
stalled preparation, processing/transfer failures, retry without duplicate transfer,
progress/authorization transport, and Work Orders image-only behavior.

The separate local native fixture uses the existing compiled Android binary and
loads only a JS test bundle in an isolated emulator's local update cache. It uses
real ProductDialog, native Image, Android system photo picker, file copying and
ImageManipulator with a generated JPEG. Identity, draft, transfer and publication
boundaries are fixtures; no Firebase accounts, resident records or private files
are used. This is not an APK build or a published/production OTA.

The Android 17 AOSP emulator had system-UI/rendering failures before picker testing;
those are environment failures, not evidence of the reported app freeze. Android
16 native fixtures passed for both initially empty composers: repeated native Back,
real modern picker confirmation, local preview, typing title/body afterward,
cancellation preserving the staged photo, native JPEG processing and fixture-only
publication. A prior run also passed the filled Discussion form. Filled forms,
video staging, failures and retry are covered in the callback/transport suite.
The automation dismisses the software keyboard through a temporary fixture-only
command; this does not verify Samsung's keyboard/IME behavior. No such command,
file polling or UI controls are included in TownLoop.
The exact physical-phone ANR is not locally reproduced. Do not claim physical-phone,
iPhone or live Firebase upload verification based on these local checks.

External test fixture/artifacts: `/home/tonio/.cache/townloop-picker-20261029/` and
`/tmp/townloop-picker-20261029-*`. No diagnostic controls or persistent logging ship.
