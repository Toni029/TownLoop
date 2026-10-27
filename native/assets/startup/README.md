# Portrait startup from the owner's original video

The active startup is `startup-portrait.mp4`, derived exclusively from the owner-approved `/home/tonio/Downloads/startupapp.mp4`. The archived `startup.mp4` remains byte-identical to that original; no artwork or replacement logo animation was generated.

## Source and conversion

- Original SHA-256: `0deed2ecabd1be98c4d02e9edd34d5a53d300b04d312dc332f8b9727fd7a3934`.
- Original: H.264 High, 1280 × 720, BT.709, 78 frames, video duration 3.208 seconds, variable frame timing. Its AAC audio is omitted from the derivative.
- Portrait SHA-256: `e93394ba7c8a34e277c2681779d26b03f49bc5fd532c6e8425969d5332514bfb`.
- Portrait: H.264 High level 4.2, 1080 × 1920, yuv420p, BT.709, 78 frames. Every video frame timestamp matches the original exactly.
- All 78 original frames were inspected computationally for high-contrast artwork: bounds x390–882, y110–719. Crop x240–1039 removes empty horizontal margins only and preserves the full source height. Uniform Lanczos scaling is 1.35×. The extra portrait background extends the original clean top-edge pixels; it does not stretch the logo or repeat bottom-edge letters.
- Near-lossless CRF 12 encoding avoids an unnecessarily large 4K decode surface. This improves framing and avoids the old tiny landscape rendering; it cannot add genuine detail beyond the 720p source. True UHD detail requires a higher-resolution original master.

Reproduce with FFmpeg 7.0.2 (tooling only, not an app dependency):

```sh
ffmpeg -i /home/tonio/Downloads/startupapp.mp4 \
  -filter_complex '[0:v]split=2[art][edge];[edge]crop=800:2:240:0,scale=1080:1920:flags=lanczos[bg];[art]crop=800:720:240:0,scale=1080:972:flags=lanczos[fg];[bg][fg]overlay=0:474,setsar=1[out]' \
  -map '[out]' -an -c:v libx264 -preset slow -crf 12 -profile:v high -level:v 4.2 \
  -pix_fmt yuv420p -fps_mode passthrough -enc_time_base 1:90000 -video_track_timescale 90000 \
  -color_range tv -colorspace bt709 -color_trc bt709 -color_primaries bt709 \
  -movflags +faststart startup-portrait.mp4
```

## One startup path

`StartupLoading.tsx` uses only this portrait video, contained at its original portrait aspect ratio. The fade/scale implementation is removed. `first-frame.png` and `poster.png` are archived and never rendered. The native splash remains neutral cream #f3ebdc.

Playback starts after the splash dismissal, independently of Firebase readiness. Normal cold launch plays all 3.208 seconds before ready Home/login is mounted. Preparation has an 8-second recovery limit; first-frame presentation starts a separate 5.208-second playback watchdog, so preparation cannot shorten the movie. Reduced Motion skips it. Failure, timeout, backgrounding or an unexpected root remount proceeds safely to neutral cream/ready navigation, without another branded animation. Background resume never replays startup.

The known `b107578` direct-player ownership correction is retained: one process-owned player, asynchronous preparation, source unloaded on teardown, listeners/timers removed, shared native ID kept valid for queued Fabric view updates. No automatically released player hook is used. No exiting view animation keeps a disconnected video surface onscreen.

## Audio and release scope

The file has no audio stream. Before loading, playback is muted, volume zero, mixed with other audio, without Now Playing/background playback. Android uses the existing startup-only `disableAudioSession` native patch (no MediaSession, audio focus registration or audio-track selection); normal app video behavior is unchanged. iOS external playback is disabled using its existing player API. Physical-device Bluetooth behavior remains unverified for this asset.

Only JavaScript, a video asset, tests and this document change. The installed Android Preview APK `49e3b645-1d6f-4dbd-aa4d-820f835dc812`, runtime `00add22145e025fb9329377ce1a2d9d6ecdaf393`, already packages expo-video, the compiled startup-only patch and neutral native splash (see `../../diagnostics/PREVIEW_NATIVE_STARTUP_RELEASE.md`). A local fingerprint check with this component and asset in the established release snapshot matched `00add22145e025fb9329377ce1a2d9d6ecdaf393` exactly. No new Android native dependency or APK is required for this change; publication must still use that compatible release snapshot rather than unrelated current native configuration. An iOS binary must include the existing expo-video module; no iOS device playback is claimed.

Verified locally: source identity, complete frame timing, silent full-HD portrait encoding, decoded-frame appearance, TypeScript and lifecycle regression fixtures. No APK was built, OTA published, or real-device launch verified for this change.
