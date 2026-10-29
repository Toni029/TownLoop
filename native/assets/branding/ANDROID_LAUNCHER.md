# Android launcher artwork

Source: owner-provided `/home/tonio/Pictures/Townloop.png`, preserved byte-for-byte
as `android-launcher-source.png`. No generated replacement or branding changes.

Run `python3 native/scripts/prepare-android-launcher.py` (Pillow required).
The 1024px adaptive layers trim the transparent canvas/decorative panel rim,
scale the artwork proportionally, and extend its existing edge colors into the
mask/overscan area. The logo and lettering are not cropped or redrawn. The full
background is opaque; Android supplies the only outer mask. The legacy Android
icon uses the same composition. Shared/iOS icon and startup assets are unchanged.

Scale factor: 0.57 output pixels per source pixel versus approximately 0.524 previously
(about 9% larger artwork). Important sun, houses, tree and wordmark details fit
inside the centered 66dp safe circle of the 108dp layer. Full-bleed scenery may
be masked; the wordmark may not. This bounds further enlargement on circular
launchers. Reference: https://developer.android.com/develop/ui/compose/system/icon_design_adaptive

Checked locally with circle and rounded-square mask previews and Expo config
resolution. No new APK or phone installation was performed. Native resources
require a new Android build; OTA cannot replace an installed launcher icon.
