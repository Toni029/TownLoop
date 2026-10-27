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

The installed Android Preview APK `49e3b645-1d6f-4dbd-aa4d-820f835dc812`, runtime `00add22145e025fb9329377ce1a2d9d6ecdaf393`, already includes expo-video and the compiled startup opt-out. The new JavaScript/asset subset can target it only through the established native-baseline-compatible release snapshot and an exact fingerprint check; do not force current full-branch native configuration onto it. A future clean Android build must retain the patch/source-compilation gate. iOS needs its own approved build and device verification; successful Android checks do not establish iPhone behavior.

Local verification covers byte identity and source timing, actual component lifecycle fixtures, all phone/safe-area geometry cases, preserved route guards, patch/artifact-gate fixtures, TypeScript, and local Android/iOS JavaScript exports containing the exact MP4. Exports are not native builds, physical playback, frame pacing or Bluetooth tests. No Firebase, OTA, GitHub, APK, iOS binary, notification delivery or production change is authorized here.
