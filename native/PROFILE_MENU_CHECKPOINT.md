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
