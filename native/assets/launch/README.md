# Owner-approved startup asset

`approved-startup.mp4` is a byte-for-byte copy of:
`/home/tonio/Downloads/TownLoop_Startup_Portrait_1320x2868.mp4`.

SHA-256: `2233522e741f4cf4a9bdc167467cdf23f81dfe77f6ed7346254f8074b4c9bc35`.

Verified with ffprobe: H.264 High level 5.0, 1320 × 2868, yuv420p/BT.709, 30 fps, 75 frames, exactly 2.500000 seconds, one video stream and no audio stream. Size: 444,109 bytes. No re-encoding, cropping, scaling, editing, extra exit effect or audio modification was performed. No old MP4 or poster is referenced.

`ApprovedStartup.tsx` is the only custom launch implementation. It contains the complete frame inside the safe display bounds at its original aspect ratio. Extra space uses a static gradient sampled from this video's left/right perimeter at 0%, 25%, 50%, 75% and 100% height. The gradient's vertical position matches the contained video; top/bottom extensions match its corner color. It does not change the file or decorate the logo.

Do not replace this asset, transcode it, or modify the checksum without owner approval. The local export check must find these exact bytes in both Android and iOS bundle asset metadata before release.
