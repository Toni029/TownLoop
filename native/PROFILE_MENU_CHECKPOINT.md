# Profile menu restoration — October 11, 2026

Source of truth: `src/components/ProfileAvatar.tsx`, the original TownLoop glass styles, and existing friend, office, and maintenance chat schemas.

The header avatar opens a custom centered glass panel instead of an Account shortcut. Reanimated springs use the original damping 25, stiffness 280, mass 0.75, initial scale 0.84, and vertical offset -28. Close takes 200ms; the dim backdrop fades over 280ms. Subviews slide/fade and respect reduced motion. Small screens, safe areas, keyboard avoidance, Android Back, and backdrop dismissal are handled.

Implemented menu actions:

- Resident photo, name, role, address and profile-photo editing. Photos are square-cropped, resized to 320px, and saved in the existing Firestore avatar fields.
- Live unread count on the header avatar and Inbox row.
- Friend, Community Office and Maintenance inbox filters; live conversations; compose and replies; read-state persistence. Writes use transactions and report errors without clearing an unsent draft.
- Friends & Neighbors directory excludes self, unapproved accounts and staff roles. Profiles show available contact information and support telephone contact and composing messages with real participant IDs.
- Account subview with existing residency/contact fields, office contact option and access to the retained `/account` screen.
- Light/dark segmented controls and logout confirmation.
- Admin/VIP/staff administration entry with resident approval and role-change confirmation, plus News/Work Orders shortcuts. Existing Firestore permissions remain authoritative; own-access changes are excluded.

No production accounts, messages, photos or roles were changed by automated verification. Backend rules were not changed. Friend-chat matching uses real UID/email identifiers rather than name or document-ID substring matching; name-only legacy threads may need a separately reviewed identity migration.

Validation: TypeScript, ESLint and 38 regression tests passed, including added inbox isolation, namesake protection, unread flags, directory filtering, and office anonymity checks. Web, Android, and iOS bundle exports passed. Expo’s offline dependency check reports dependencies up to date; it does not verify current registry metadata.

Remaining acceptance: saved browser permissions prevented automated visual inspection of localhost. Compare matching signed-in web/native menus, check opening/closing and each subview, verify actual send/read/photo workflows with authorized test accounts, and test reduced motion, screen readers, keyboards and Android/iOS Back behavior on physical devices. Bundle exports do not verify authenticated production operations or actual-device animation quality. The new Expo image-manipulator dependency requires rebuilding an existing native development client.

Previous functional checkpoint `bd73527` and branch base `7a7bbd4` remain in history. This checkpoint also includes the preceding authorized sign-in and shared visual styling pass.

## Profile interaction polish — October 11, 2026

Matched source-defined avatar hover scale (1.05), sheen, emerald border/shadow response, and touch press scale/rotation with Reanimated and reduced-motion support. Retained the original centered modal positioning. Closing now uses the original 0.88 scale/-18px offset rather than reversing the opening 0.84/-28px geometry. Added the original 850ms opening light sweep and eased backdrop fade.

Corrected Expo web blur scaling: the former intensity 35 yielded approximately 7px; the web backdrop now specifies the reference 24px blur and the panel 36px glass blur/saturation. Android BlurViews now use the existing scene's blur target and supported blur method. Mobile/desktop radii, padding, glass colors, row geometry and icons follow the original component. Functionality/data actions are unchanged. This checkpoint also preserves the previously requested light-theme default.

Validation: TypeScript, lint, five targeted profile/native-container checks, and web bundle export passed. Direct visual and motion comparison remains unverified because the browser tool rejected localhost access due to its saved permission setting. Manual preview review is required before further visual work; no alternative browser-control method was used.


## Profile interaction correction — 2026-10-11

- Start the original scale/translate spring from Modal onShow after the initial pose paints, rather than before mounting the modal.
- Apply web backdrop filters on the animated backdrop and glass panel themselves so nested opacity layers do not isolate background blur.
- Center avatar initials and action labels explicitly; restore the header initials to the original 20px size. Hover enlargement/sheens and touch compression/tilt remain enabled, respecting reduced-motion settings.
- Validation: TypeScript, focused ESLint, five profile/text checks, and Expo web export passed. Preview returns HTTP 200 at localhost:8082.
- Direct browser visual verification remains unavailable because browser automation access is blocked; visual approval remains with the user.

## Original popup motion study — 2026-10-11

Compared directly with the original ProfileAvatar.tsx motion definitions. Preserved its opening spring (scale .84, y -28, damping 25, stiffness 280, mass .75) and 200ms card exit (scale .88, y -18). Added the missing web blur-to-focus reveal (14px opening, 8px closing). Restored the backdrop 280ms cubic easing on exit and deferred modal removal until that fade completes. Cancel pending opening frames when dismissing. iOS/Android retain Reanimated scale/translation/fade and the existing native glass backdrop; content filter blur is web-only. TypeScript, focused ESLint and Expo web export passed. Browser visual verification remains blocked by saved browser permission.

## Avatar feedback and responsive geometry — 2026-10-11

Matched original source: hover scales only the circle to 1.05, leaving badges stationary; press scales the outer trigger to .90 and circle to .95 with -2 degree tilt. Uses original 300ms easing curves through Reanimated. Header photo is 64px/mobile, 80px/desktop; close control is 36px/mobile, 40px/desktop with original offsets. No menu functionality changed. TypeScript, focused lint and Expo web export passed. Direct visual comparison remains blocked by saved browser permission; user review is required before further polish.
