# First-launch Android evidence — 2026-10-23

## Actual failing APK

- EAS Preview build: `26feaf48-c696-4e7f-aca3-5bd1603fa4b1`, bundled commit `fb1a602`.
- Package `com.toni029.townloop`, versionName `0.1.0`, versionCode `2`.
- Packaged `assets/fingerprint`: `a6551ff3ee4b0d2b0c6797653fc556f234494d65`.
- APK SHA-256: `6c928e4c4e45ca24a09451635dc9e735f55eb6862c9dbcd3735cfc1f63ce3310`.
- Preview channel, launch check ALWAYS, zero update launch wait. Fresh emulator install was offline, so the exception came from bundled JavaScript, not a downloaded OTA.

Captured on Android API 36 from the unmodified downloaded APK:

```text
Error: Call to function 'VideoPlayer.pause' has been rejected.
→ Caused by: The 1st argument cannot be cast to type class expo.modules.video.player.VideoPlayer
→ Caused by: Cannot use shared object that was already released
code: ERR_USING_RELEASED_SHARED_OBJECT
componentStack:
    at LaunchVideo (address at index.android.bundle:1:3198667)
isComponentError: true

expo.modules.kotlin.exception.PropSetException:
Cannot set prop 'player' on view 'class expo.modules.video.TextureVideoView'
Caused by: expo.modules.kotlin.exception.UsingReleasedSharedObjectException:
Cannot use shared object that was already released
    at expo.modules.kotlin.sharedobjects.SharedObjectRegistry.ensureWasNotRelease-tuC-2VU(SharedObjectRegistry.kt:130)
    at expo.modules.kotlin.sharedobjects.SharedObjectRegistry.toNativeObject-kyJHjyY$expo_modules_core_release(SharedObjectRegistry.kt:97)
    at expo.modules.kotlin.views.ConcreteViewProp.setPropDirectly(ConcreteViewProp.kt:27)
    at com.facebook.react.fabric.mounting.SurfaceMountingManager.createViewUnsafe(SurfaceMountingManager.kt:613)
```

The original API 36 emulator also hit Android System UI ANRs under host memory pressure. Its screenshots are not passing app tests. The exception above is the app's own captured React/native error, independently of those OS dialogs.

## Cause and correction

The hook automatically releases its SharedObject during React teardown. Startup then paused that released object; queued Fabric view creation could also still contain its ID. The earlier local cleanup correction removed the unsafe pause but did not cover queued native view binding: a local API 30 run of that implementation still produced PropSetException.

Startup now uses the installed library's direct `createVideoPlayer` API with a single process-owned reference. This keeps its ID valid through queued native view attachment/removal, without a guessed release delay. Cleanup pauses playback, removes listeners, clears timers and calls `replaceAsync(null)` to unload the media source. If a pending prepare resolves after teardown, the source is cleared again. Only one idle player object is retained until process exit; no repeated player creation or background playback is allowed. The source is loaded asynchronously after silent startup-only audio-session configuration. Ordinary app videos are unchanged.

The watchdog, startup-local error boundary, reduced-motion handling, once-per-process claim, neutral fallback and original MP4 remain. The regression fixture was run red for post-unmount native attachment before applying this correction, then green.

## Actual Android verification and limits

A local, independently test-signed copy of the downloaded APK was used on an isolated Android 11/API 30 x86_64 emulator. It is not an EAS build and must not be distributed as a Preview release. All 100 native libraries and all five Kotlin/service metadata files were verified byte-identical. Only the startup bundle, embedded asset manifest, original MP4 and five splash image resources were overlaid. The MP4 is byte-identical to `/home/tonio/Downloads/startupapp.mp4`; its SHA-256 is `0deed2ecabd1be98c4d02e9edd34d5a53d300b04d312dc332f8b9727fd7a3934`.

Passing corrected-fixture checks, with logcat and visible UI captures:

| Case | Result |
| --- | --- |
| Fresh installation, offline first launch | Community selection visible; no released-object, PropSet or React boundary errors |
| Force-stop and cold reopen offline, second launch | Same result |
| Force-stop and cold reopen offline, third launch | Same result |

Each recorded exactly one ExoPlayer initialization. H.264 decoder initialization was recorded. This is not proof of every rendered frame, performance/FPS, or physical Bluetooth behavior.

Incomplete: enabling network access caused the host's memory-limited emulator process to be OOM-killed. Online startup, background/resume, intentional playback failure, authenticated Home transition and complete visual playback verification are **not claimed passed**. No resident was authenticated, read, modified or deleted. Phone validation and a normally generated final APK remain required.

Earlier test copies with omitted service metadata were identified and excluded from the passing table. Their fallback-only launches do not establish successful normal playback. The corrected fixture preserved the metadata and normal runs had no ExpoModulesCore/ReactNativeJS startup errors.

Twelve focused lifecycle/native-patch checks and TypeScript passed. They supplement, not replace, the Android results.

## Release boundary

No EAS build, OTA publication, GitHub push, Firebase, Hosting or resident-data action was performed. The pointer-lifetime correction itself is JavaScript and uses already-installed native APIs. A new approved Preview APK is still necessary to bundle the fix for a fresh offline first launch and compile the neutral native splash from `68b86a7`; an OTA cannot replace an already-installed APK's native splash or repair its bundled code before its first offline launch. Runtime safety must remain enabled.

Raw local captures are under `/home/tonio/.cache/townloop-startup-verification/`; none are uploaded. Only the startup exception excerpt is included here. The heavyweight test processes were stopped; future tests should run sequentially with host memory limits.
