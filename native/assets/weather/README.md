# Weather scene assets

Generated with the built-in image-generation tool for TownLoop. These are illustrative weather textures, not live camera images. The existing selected-hour forecast remains the source of truth.

- `cumulus.png`: real alpha cloud texture, resized to 896px wide; 655,054 bytes.
- `storm-sky.jpg`: storm photograph texture, resized to 768px wide; 62,168 bytes.
- Combined encoded asset size: approximately 700 KiB. Images are bundled locally; no image requests, videos or new native dependencies.
- Native image transforms and opacity run on the Reanimated UI thread. Reduced Motion uses still scenes; loops pause outside Home and in the background.

## Final generation prompts

### cloud

Use case: photorealistic-natural. Asset: transparent cloud texture layer for a premium animated mobile weather widget, NOT a UI screenshot. Create a wide bank of incredibly realistic three-dimensional sunlit cumulus clouds, fine wispy edges and layered billowing vapor with intricate natural texture, bright ivory upper rims and cool blue-gray shaded undersides. Photographic atmospheric scattering, convincingly volumetric, never cartoon or icon. Cloud bank occupies middle 65% of canvas, with ample fully transparent margin on every side and genuinely translucent feathered wisps. No sky, no ground, no sun, no text, no border, no shadows outside cloud. Landscape 1536x1024. Real alpha transparency required.

### storm

Use case: photorealistic-natural. Asset: full-bleed atmospheric sky photograph for a premium mobile weather tile, not a UI mockup. Portrait view looking upward into dramatic rain-bearing storm clouds. Realistic deeply sculpted layers of cumulonimbus, illuminated soft silver cloud tops in upper right, dense rolling blue-slate and charcoal undersides, distant sheets of rain and atmospheric haze below. Photographic meteorological realism, detailed vapor texture and three-dimensional depth. Upper half has detailed cloud mass, lower half becomes smooth dark blue-gray atmosphere suitable behind white forecast controls. No landscape, buildings, people, text, icons, borders or visible lightning bolt. No painted/illustrated look. Portrait 1024x1536.

Only standard resizing/encoding was applied after generation; cloud alpha is preserved.
