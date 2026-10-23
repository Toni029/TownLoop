# Single original startup — local correction

## Confirmed cause of inconsistent visuals

The previous implementation ended startup immediately when authentication/fonts/community were ready, regardless of video completion. The shared motion preference initially reported true until its async lookup completed. Both timing paths could skip the player. An explicit end-frame poster was shown for reduced motion, completion and failures; the native splash also displayed a logo frame. These were real branches in `StartupLoading`, not an alternate generated video. Two regression checks failed before this correction: early readiness removed the animation, and neutral fallback still contained an Image.

## Current implementation

Native neutral cream splash → exact original MP4 in expo-video/ExoPlayer → existing Home/login. React/Reanimated provides only the final screen fade. Source identity, codec metadata, hashes, scaling and audio behavior are recorded in `assets/startup/README.md`.

A separately resolved motion preference avoids conflating “unknown” with “enabled”. Ready navigation mounts underneath while successful video playback completes. A process-level claim prevents multiple player instances across root remounts. Backgrounding ends playback without resuming it. Reduced motion and failures use only neutral cream. The video surface remains hidden until its first frame, avoiding an initial black decoder surface; no poster or gradient obscures original frames.

The earlier cleanup-only correction was insufficient for queued Fabric view binding. Startup now owns one direct player for the process, keeping its SharedObject ID valid while native view operations drain; cleanup unloads the media source instead of prematurely releasing the ID. Errors stay inside the startup boundary. Preparation/playback remains capped at 4.5 seconds; motion lookup at one second. Failed playback proceeds to the app as soon as its existing initialization gate is ready. Authentication/navigation are not bypassed. JS safeguards cannot recover a native process crash or blocked JS thread.

## Focused verification

Actual component code runs in deterministic hook/native lifecycle fixtures: fast/late initialization, repeated simulated fresh process launch, root remount, background/resume, successful playback, decoder/prepare failure, pause/render failure, released-player cleanup, reduced motion and unresolved preference. Asset identity and neutral splash pixels are checked; the existing native opt-out patch is verified unchanged. This is simulated verification, not physical-device playback or FPS testing. ADB lists no connected devices; no current Android crash logs are available. Cold launch, force-close/relaunch, background/resume and Bluetooth behavior still need phone verification after an approved release.

## Release boundary

No build or publication is performed. The JS behavior can be backported to the installed runtime, but that APK retains its compiled logo splash. The complete requested neutral-native-splash experience requires a new Android APK (and future iOS build). Do not force this changed native fingerprint onto `a6551ff3ee4b0d2b0c6797653fc556f234494d65`. Preserve the original source and recovery checkpoint `recovery/before-single-startup-20261023`.

Actual Android follow-up, captured error stack, pointer-lifetime correction and verification limits: see `STARTUP_ANDROID_EVIDENCE.md`. Three corrected offline emulator launches passed; the remaining matrix is not claimed verified because the host memory guard stopped the emulator during the online check.
