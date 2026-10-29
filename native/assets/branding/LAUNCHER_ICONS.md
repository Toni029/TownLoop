# Complete original TownLoop launcher artwork — Android and iOS

Owner decision: preserve the full original rounded-square composition and wordmark,
accepting necessary padding on circular Android launchers. This supersedes the
edge-extension/reframing experiment in 6d2c1a0.

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

Android's entire visible panel fits inside the centered 66dp safe circle in its
108dp adaptive layer, with a small rasterization margin. This necessarily makes
it smaller than the edge-to-edge experiment. iOS uses the largest proportional
placement preserving the panel under a conservative rounded-square mask; the
1024px icon is opaque. Pre-adaptive Android uses that same flattened image.
Android launchers control the outer mask and user-selected theming. The app
cannot guarantee a rounded-square outer shape, identical apparent size, or
untinted appearance under every launcher/theme.
Reference: https://developer.android.com/develop/ui/compose/system/icon_design_adaptive

Local checks: exact source identity, full-panel mask containment, 1024px layers,
opaque iOS/legacy backgrounds, and resolved Expo icon paths. Launcher previews
are simulated, not physical-device verification. Startup, notification icons,
authentication, and all app functionality remain unchanged.

New Android and iOS native builds are required to install these resources.
OTA cannot replace a compiled launcher icon. No build/publication is authorized.
