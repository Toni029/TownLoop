# Community welcome page checkpoint — 2026-10-11

Reproduced the original CommunitySelectorScreen in React Native using its source as the reference: warm gradient/frame, TownLoop favicon, portal pill, welcome heading, two community cards, original emblem/placeholder artwork, badges, feature lists, location, action labels, footer, light/dark toggle and responsive geometry. Light is the default.

The new /communities route is available for review. Signed-out first-time visitors are redirected there before sign-in; selection is stored in AsyncStorage under selected_community, matching the web key. The existing sign-in route retains its authentication and password reset flows and now has a switch-community link. Existing signed-in sessions are preserved. Community selection follows the original shared-backend behavior; no tenant architecture was introduced.

Validation: TypeScript, focused ESLint, native JSX text check and Expo web export passed. Direct browser visual verification remains unavailable due to the saved browser access restriction; final visual approval is with the user.
