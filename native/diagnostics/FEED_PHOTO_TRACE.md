# Temporary Preview Discussion Feed photo trace

Publication is held for owner approval. One update from the diagnostic commit includes its ancestors `6e6ff50` and `dffc0c8`; no cherry-picking or separate updates required. No native dependencies/configuration changed. Use the existing Preview publication workflow and verify the generated runtime against the installed APK; never force an incompatible runtime. Production is excluded.

## Capture on the Android phone after the approved Preview update

1. Reopen TownLoop after installing the update. Open Social → Discussion Feed → New Post.
2. Leave the text empty, select one photo, and confirm in the system picker. If it freezes, wait about 10 seconds.
3. Force-close and reopen TownLoop. Do not clear app data or reinstall. Before another photo attempt, tap **Share photo diagnostics** at the top of Social. Save/copy the shared text and provide that text for diagnosis.
4. If the first attempt succeeds, repeat with title/body filled. Export each attempt before starting another; only the latest attempt is retained. No need to publish a real post.

The record survives restart; entering Social or pressing Share does not start a new trace. A hard native/process failure can lose the last pending storage write. If the app cannot reopen, optional USB debugging capture can recover emitted stage lines: `adb logcat -d -s ReactNativeJS:I | rg '\[TL-FEED-TRACE\]'`. Share only those tagged lines, never an unfiltered device log. Device logs are best-effort on release builds and do not replace the saved report.

## Data and bounds

Fixed stage names, elapsed milliseconds since the attempt (capped at 180 seconds), and allowlisted error codes only. No images, names, IDs, text, paths, URLs, filenames, tokens, error messages, stacks, counts, or device identifiers. Unknown errors become `unknown`. Nothing is uploaded remotely. Export requires the user's Share action.

At most 80 events in one local record, overwritten by the next attempt. Writes are asynchronous, serialized and coalesced; the upload never awaits diagnostics. A five-second heartbeat ends after three minutes, without cancelling or changing upload work. No per-frame or upload-percentage logging. App-state, UI commit/layout/unmount and redacted render-error events help distinguish picker lifecycle/render failure from pending native or network operations. UI layout is a layout observation, not proof that a native animation rendered successfully.

Diagnostics run only under `__DEV__` or the actual Expo `preview` channel, never a user-supplied setting. Marketplace and Work Orders have no diagnostic callback and retain their upload behavior. The shared transport has optional stage callbacks only.

## Verification and next step

Focused tests exercise the actual media orchestration/transport using native fixtures, an unresolved processing promise, persistence/restart export, event bounds/redaction, and Production exclusion. They verify the probes, not the physical Android freeze. No root cause or upload fix is claimed until the real-phone trace is captured. Remove this temporary module, UI control and optional trace hooks after diagnosis; delete its dedicated AsyncStorage key at that time without touching resident data.
