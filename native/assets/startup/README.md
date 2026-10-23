# Startup video

Source approved by the owner: `Downloads/startupapp.mp4`, 1280 × 720, approximately 3.22 seconds. The bundled MP4 copies the original H.264 video stream without re-encoding; its AAC track is removed. The PNG fallback frames are extracted at original resolution. The previous portrait conversion substantially reduced bitrate and picture quality.

The player contains the full landscape composition and caps presentation at source pixel density. This is a 720p master, not a high-resolution portrait master; enlarging its embedded artwork cannot recover additional detail.

Playback is configured silent and `mixWithOthers` before source loading, with background playback, controls, Picture-in-Picture and Now Playing notifications disabled. Startup stops on backgrounding and does not resume. Reduce Motion uses a still frame, and initialization is never held for playback completion.

Limitation accepted for this OTA-only change: installed expo-video creates an Android MediaSession even for muted video. JavaScript settings cannot prevent that registration. Complete Bluetooth/media-session isolation requires a future native opt-out and APK rebuild; it has not been implemented or hardware-verified here. The previous bundled video already lacked audio, so removing the source audio alone is not a proven Bluetooth fix.

No native dependencies or configuration changed. Publish only against a runtime compatible with the intended installed APK; do not override fingerprint compatibility.
