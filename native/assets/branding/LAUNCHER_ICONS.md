# Complete original TownLoop launcher artwork — Android and iOS

Owner decision: use the same large composition and relative artwork size as the
iPhone icon on Samsung and other Android launchers. The owner explicitly accepts
cropping by circular Android masks, including possible lettering clipping. This
supersedes the whole-panel safe-circle padding choice in f21d732.

Source: the latest owner attachment
`/home/tonio/Downloads/file_00000000ce2c8230b27c45f7dee20ef0.png` matches the existing
`android-launcher-source.png` byte-for-byte (historical filename, shared by both
platforms). SHA256: 64373610949b81dd43b1725f1ff13cd71f13ca82bfc7365d3c90dd9a5c7f7e4b.
No generated replacement, redrawing, lettering changes, or recoloring.

Run `python3 native/scripts/prepare-launcher-icons.py` (Pillow required).
Only transparent outer canvas is trimmed; the original rounded panel, scenery,
proportions, colors, and full TownLoop lettering are retained. All resizing uses
Lanczos downsampling from the 1254px source. The opaque blue/cream backing is the
existing background asset from c9008bf, preserved in launcher-background.png.
There is no stretched landscape or altered composition.

Android places the exact flattened iPhone composition in the centered 72dp visible
viewport of its 108dp adaptive layer (683px in a 1024px asset). This removes the
extra 66dp-safe-circle shrinkage. Android's foreground contains the same complete
image, but the launcher can crop it. The backing fills overscan during launcher
effects. iOS and pre-adaptive Android assets remain byte-for-byte unchanged.
Android launchers control the outer mask, effects and user-selected theming. A
rounded-square preview matches the iPhone framing; circular masks intentionally
clip the enlarged artwork. Identical shape or appearance across every launcher,
custom mask and theme cannot be guaranteed.
Reference: https://developer.android.com/develop/ui/compose/system/icon_design_adaptive

Local checks: exact source identity, matching Android viewport/iOS composition, 1024px layers,
opaque iOS/legacy backgrounds, and resolved Expo icon paths. Launcher previews
are simulated, not physical-device verification. Startup, notification icons,
authentication, and all app functionality remain unchanged.

New Android and iOS native builds are required to install these resources.
OTA cannot replace a compiled launcher icon. No build/publication is authorized.
