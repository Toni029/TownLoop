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

## Sun and lightning enhancement

- `sun-radiance.png`: 640×640 RGBA, 434,039 bytes. White-hot photographic sun and soft atmospheric halo; animated with the existing UI-thread glow.
- `lightning.png`: 512×768 RGBA, 393,880 bytes. Branching electrical filament with transparent glow. Two isolated strikes per 23 seconds with separate cloud illumination; disabled with Reduce Motion.
- Approved cloud assets remain unchanged. These layers use the selected forecast hour, and animation stops when the tile is inactive.

Sun generation prompt: Photorealistic-natural asset for premium weather widget, NOT UI. A dazzling real sun seen through Earth's atmosphere, white-hot luminous round core, seamless radiant pale gold corona, extremely fine optical diffraction rays of uneven natural lengths and warm atmospheric light scattering fading gracefully outward. Sun occupies center of square with generous margins. Real camera optical appearance, absolutely not cartoon, not illustrated, not orange solar surface in space, no hard concentric rings, no lens flare orbs. Isolated light sprite on genuinely transparent background with translucent glow and completely transparent outer edges, no black sky or rectangular backdrop. Square 1024x1024.

Sun refinement prompt: Refine this sun light sprite for photographic realism. Remove the scalloped, star-shaped orange outer silhouette completely. Keep a brilliant white round sun core, but use a very soft nearly white pale-gold glow that fades smoothly and radially to full transparency well before all canvas edges. Only a few fine barely visible optical rays; no geometric sun spokes, no pointed outer shape, no solid yellow disk or decorative sun symbol. This should look like the overexposed sun photographed in a real pale blue sky, with the sky removed to genuine transparent alpha. Generous empty transparent margin around the smooth glow. Preserve transparency.

Lightning generation prompt: Photorealistic-natural transparent visual-effects asset for a premium weather widget. Real cloud-to-cloud lightning discharge photographed at night: one highly irregular main filament descends diagonally from upper right toward lower middle, tiny jagged changes in direction, many delicate asymmetrical branching forks, intensely white narrow core and subtle ice blue violet luminous halo. Natural high speed lightning photography, absolutely not a cartoon zigzag or a lightning bolt icon. Isolated electrical light on genuinely transparent background, no sky, no clouds, no ground, no text, no rectangular background. Lightning safely inside canvas with transparent margins. Portrait 1024x1536.
