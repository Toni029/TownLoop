# Exact original startup MP4

Owner-approved source: `/home/tonio/Downloads/startupapp.mp4` (the owner explicitly selected this file when the originally mentioned `/mnt/data` path was unavailable). Bundled `startup.mp4` is now a **byte-for-byte copy**, including the original container and audio track. It is not a generated/recreated animation or a portrait conversion.

- File SHA-256: `0deed2ecabd1be98c4d02e9edd34d5a53d300b04d312dc332f8b9727fd7a3934`
- Size: 3,057,363 bytes; duration approximately 3.22 seconds.
- Video: H.264 High, 1280 × 720, original variable timing (~24.31 average fps), ~7.49 Mbps, BT.709.
- Audio: original AAC stereo, 48 kHz. Playback stays muted/volume zero before source loading. Android's existing startup-only native patch disables audio-track selection, audio focus registration and MediaSession creation. Other videos are unaffected.
- Prior bundled MP4 had identical encoded video packets (SHA-256 `0665f587cea9d9d70c56e9f1a0a43a2a2cf1a934a21fb7eaa5bd07f7cd9bde68`) with audio removed; no new image detail is being invented.

The full original 16:9 composition is contained without crops, overlays, stretching, re-encoding or enlargement beyond source pixels at the device density. This is a 720p master; genuine UHD detail requires an original higher-resolution/exportable master, not upscaling.

The original-resolution `first-frame.png` and `poster.png` remain archived assets only; no startup path references them. `native-splash.png` is now a single solid cream pixel (#f3ebdc), deliberately containing no artwork. The splash plugin scales this neutral color into its native splash area. Changing that compiled asset requires a new APK/iOS build; an OTA cannot erase the existing APK's branded native splash. Fingerprint runtime safety remains enabled.

Normal cold launch plays the MP4 once to completion while app initialization runs concurrently. Initialization no longer cancels playback. The motion preference is resolved separately from readiness; Reduce Motion skips to neutral cream and then the app. Playback failure, timeout, backgrounding, or unexpected remount cannot launch a replacement logo animation. A successfully completed last frame remains only during the exit into ready navigation; if initialization is still pending, the screen is neutral cream. No background/resume replay.

Cream is sampled from the original perimeter at 0, 1.5 and 3.1 seconds (median RGB 243/235/220). The source has slight natural/compression variation at its edges; the MP4 is not recolored to flatten it.

Startup player ownership: the installed direct-player API creates at most one process-owned object. Its source is unloaded and listeners/timers removed when startup finishes. The native ID remains valid for late Fabric view updates; automatic hook release is not used for this startup-only object. See `../../diagnostics/STARTUP_ANDROID_EVIDENCE.md` for the real Android exception and verification limits.
