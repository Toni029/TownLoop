# TownLoop visual parity review

Recovery points: `checkpoint/functional-bd73527` preserves the functional migration; `checkpoint/pre-visual-8d19ad0` also preserves the subsequent native console fix. Both tags are pushed. All visual work follows the latter commit on `native/expo-migration`. Main and all backend rules/data remain untouched.

## Global shell checkpoint

Restored the shared resident greeting, original typefaces/weights, date hierarchy, profile-avatar styling and role artwork; the beige application gradient; and floating four-tab glass dock, original icon/label order and spring indicator. Retained account navigation and Home's appearance toggle in the avatar menu. Native blur captures the active scene independently from the dock; older Android versions receive the translucent gradient fallback. Safe areas and keyboard visibility are respected. Native feed containers now allow the shell background through and reserve room beneath the floating dock.

Validation: TypeScript, lint and all 34 regression tests pass. Matching 390×844 rendered comparisons were inspected for all four tabs, with zero console/runtime errors in isolated fixtures. The fixtures import actual product components and never write production data. Font and device rendering, blur performance, screen-reader focus and touch handling still require Android/iOS device acceptance.
