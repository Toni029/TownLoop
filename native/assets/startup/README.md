# Startup video

Source approved by the owner: `Downloads/startupapp.mp4`, 1280 × 720, approximately 3.22 seconds. The bundled MP4 copies the original H.264 video stream without re-encoding; its AAC track is removed. The PNG fallback frames are extracted at original resolution. The previous portrait conversion substantially reduced bitrate and picture quality.

The player contains the full landscape composition and caps presentation at source pixel density. This is a 720p master, not a high-resolution portrait master; enlarging its embedded artwork cannot recover additional detail.

Playback is configured silent and `mixWithOthers` before source loading, with background playback, controls, Picture-in-Picture and Now Playing notifications disabled. Startup stops on backgrounding and does not resume. Reduce Motion uses a still frame, and initialization is never held for playback completion.

Android native opt-out is now prepared for the next APK: the startup player alone supplies `disableAudioSession` before native construction. The pinned native patch prevents its MediaSession creation, audio-focus registration, audio-track playback and playback-service registration. Existing APKs lack this patch and still have the previously documented Bluetooth limitation. Physical Bluetooth verification remains required after the approved build.

The native splash uses a separate stable `native-splash.png` copy so future video fallback-frame edits do not implicitly change the native splash fingerprint. The runtime policy remains fingerprint-based; the new native patch and splash configuration require a new APK. Use the guarded Preview publisher against that successful build ID, with no runtime override.
