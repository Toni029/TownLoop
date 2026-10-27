# Approved portrait startup and phone layout preparation

## Authoritative playback

The owner has now approved a new video integration, superseding the earlier direct-launch-only decision. `ApprovedStartup.tsx` is the sole custom launch path. It references only `assets/launch/approved-startup.mp4`; the old `StartupLoading`, original/converted MP4s, posters and fade/scale implementation remain removed. The approved video's byte identity and codec metadata are recorded next to it.

The standard static native splash remains while session, fonts and community initialize. Once ready and the accessibility preference is resolved, one process-owned player prepares the video. The native splash dismisses before play. No readiness change ends playback: the real `playToEnd` event controls normal completion, and ready navigation then mounts. The movie itself supplies all visuals and its ending; no added zoom/fade or minimum-duration timer exists.

Preparation has an 8-second failure limit. The first rendered frame starts a separate 4.5-second stall limit, covering the complete 2.5-second file plus allowance. Errors, stalled preparation and local video-render failure safely skip to authorized navigation when initialization is ready. Reduced Motion skips playback. Backgrounding ends optional playback; resume or a root remount cannot start it again. A genuine process restart resets the launch claim. Native ID lifetime is retained for queued Fabric props; teardown unloads the decoder source, removes listeners and clears timers, without invalidating that shared ID. No duplicate decoder/player is created.

## Silent platform behavior

The MP4 has no audio stream. The player is muted with volume zero, mixes with other audio, does not advertise Now Playing or run in the background; iOS external playback is disabled. The inspected iOS SDK only activates AVAudioSession for an unmuted player or an explicit exclusive-mixing override; this launch player requests neither. Device Bluetooth behavior is still unverified.

Expo-video's existing Android startup-only `disableAudioSession` option is restored for this newly authorized video use. The pinned default-off patch suppresses MediaSession creation, audio-focus registration and audio-track selection only for the startup player. Normal MediaViewer playback is unchanged. Clean installs and EAS build gates apply/check the patch; Android builds compile expo-video from source instead of silently using an unpatched AAR. No new dependency is added. Never remove the build gate while this option is required.

## Focused responsive changes

- Preserve the full approved frame with `fitPortrait`, based on actual window dimensions and all four safe insets. No crop, stretching, global UI transform or logo enlargement to fill the screen.
- Remove the native shell's 448-point web-preview width cap. The web frame remains unchanged; native screens use the available device width.
- Bound Profile/Account panels to left/right cutouts and top/bottom safe areas, with positive short-viewport dimensions. Existing KeyboardAvoidingView, scrolling and transition behavior remain in place.
- Keep flexible header/menu text shrinkable; fit dock labels within their measured tabs and preserve accessible tab labels. Enlarge the resident-menu close target with hit slop without changing its artwork.
- Existing shared Work Order/Social sheets, safe-area headers, keyboard-aware scroll handling, notifications and authentication/security logic are otherwise unchanged.

## Runtime and verification limits

The installed Android Preview APK `49e3b645-1d6f-4dbd-aa4d-820f835dc812`, runtime `00add22145e025fb9329377ce1a2d9d6ecdaf393`, contains the prior startup audio opt-out, but its constructor is defective. Two cold launches of this exact APK in the Android API 30 emulator, without login or resident access, produced:

```text
Call to function 'VideoPlayer.constructor' has been rejected.
Caused by: java.lang.IllegalStateException: Player is accessed on the wrong thread.
Current thread: 'mqt_v_js'
Expected thread: 'main'
```

Those runs used the APK's bundled `LaunchVideo` JavaScript, not the latest OTA; the current `ApprovedStartup` uses the same native constructor option. Source inspection identifies the synchronous `player.trackSelectionParameters` getter/setter added by our opt-out in the constructor. ExoPlayer is explicitly main-looper bound. The video boundary catches construction failure and skips to the app, explaining a missing video without an app crash. The earlier assumption that presence of the compiled option established functional compatibility was insufficient.

The pinned patch now dispatches this startup-only track configuration to `appContext.mainQueue`; MediaSession and audio-focus exclusions remain unchanged. Its installer safely upgrades the exact previous patch and remains idempotent. A focused regression rejects synchronous constructor track access. Lifecycle fixtures still cover once per process, real end-of-video completion, no replay on resume/remount, readiness changes and bounded failure recovery. The approved MP4 remains byte-identical.

**A new Android APK with a newly computed native fingerprint is required.** Do not publish this native repair to runtime `00add22145e025fb9329377ce1a2d9d6ecdaf393` or force that old runtime onto a new build. Merely publishing the same JavaScript again will not repair the installed native constructor. The corrected binary has not been built or tested on a phone. iOS does not use the Android patch; its startup lifecycle remains unchanged and still requires its own device verification.

Local verification covers byte identity and source timing, actual component lifecycle fixtures, all phone/safe-area geometry cases, preserved route guards, patch/artifact-gate fixtures, TypeScript, and local Android/iOS JavaScript exports containing the exact MP4. Exports are not native builds, physical playback, frame pacing or Bluetooth tests. No Firebase, OTA, GitHub, APK, iOS binary, notification delivery or production change is authorized here.


## Thread-fix verification

- Existing Preview binary: constructor thread exception reproduced on two emulator cold launches; no login, resident records or photos accessed. The first-run bundle was the embedded bundle, not a claim that the latest OTA was executing.
- Local thread-safety regression failed before the patch and passed afterward. Four patch/artifact tests cover pristine SDK and prior-patch upgrades, idempotence, default-off behavior and source drift; eight existing component lifecycle tests passed. TypeScript and diff whitespace checks passed. Owner-supplied and bundled MP4 SHA-256 values still match.
- A compile-only `:expo-video:compileReleaseKotlin` check was attempted offline, without an APK task. It stopped during Gradle configuration because Kotlin JVM plugin 2.2.0 is not cached; it did not reach this Kotlin source. No replacement build was attempted. Native compilation and corrected Android playback remain unverified until an approved build/test.
- No OTA, GitHub push, cloud build or backend change was performed for this correction. Do not describe passing JavaScript fixtures as device verification of the repaired native binary.
