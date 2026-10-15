# Profile-menu inventory and parity review

Source: `src/components/ProfileAvatar.tsx`, `src/components/AdminPanelModal.tsx` and their Firebase services. Baseline: d6cbc6c, tagged `checkpoint/profile-menu-before-full-parity-2026-10-15`.

## Complete view/action inventory

| Original view | Controls, states and transitions | Native destination |
| --- | --- | --- |
| Avatar trigger | hover/press, unread dot, role badge, spring open, blur fade, specular sweep, close/backdrop | Shell trigger + ProfileMenu; existing opening constants preserved |
| Main | avatar upload/crop/save/error, name/role/unit/wing/email, admin conditional card, inbox unread count, directory count, account, Light/Dark selection, logout, copyright | Main menu |
| Inbox | All/Friends/Office/Crew filters, mark all read, unread rows, dates/preview, delete, empty/loading/failure, fixed three compose actions | Inbox |
| Maintenance thread | team identity, resident identity for crew, phone copy, role-specific sender labels, message stream, timestamps, inline reply, delete, All Messages back | Conversation, maintenance category |
| Office thread | office identity, resident identity for admin/VIP, contact copy, messages/replies/delete/back | Conversation, office category |
| Friend thread | avatar/name/phone, copy phone, messages/replies/delete/back | Conversation, friend category |
| Directory | search name/unit/wing/interests, avatar/unit/phone, open profile or compose, no results | Friends & Neighbors |
| Resident detail | back, centered avatar/name/address, member year, contact/copy/call, address/copy, interests, message | Friend detail |
| Compose | cancel/back, Office/Crew/Friend destination, friend dropdown/checkmark, subject/body, disabled sending, errors/success | Compose |
| Account | address/phone/emergency/dietary/safety rows, profile update request | Account; existing `/account` route retained; new in-menu Edit Profile saves contact/residency details |
| Logout | explanatory panel, Cancel/Yes, errors/busy, authenticated sign out | Logout confirmation |
| Admin residents | pending/approved totals, approval, roles/confirmation, live directory, error/empty | Admin Residents |
| Admin RSVP | counts, event date/time, expand attendees, delete attendee/event confirmations, empty | Admin RSVP |
| Admin database | destructive purge confirmation, progress/errors | Admin Database |

`onSwitchCommunity` is an unused original prop: there is no community-switch control in this original menu. No new control or collection is invented.

## Intentional retained behavior

Retain previously requested fixed larger panel height, stronger contrast, resident/crew/staff avatars and read receipts, friend-only recipient selector, and admin RSVP without search. Keep actual Firebase collections and authorization. Original fabricated online statuses, fallback resident year, placeholder telephone numbers, and hardcoded safety enrollment must not be represented as live facts. Contact/residency editing is available inside the menu, and the existing Account route remains accessible; profile-update requests actually compose an office message instead of merely showing the original toast.

## Verification limitation

The browser tool denied access to localhost:3000 through a saved permission. Source comparison is available; live side-by-side animation/visual verification and authenticated device interactions remain unverified.

## Checkpoints

- Preserved original motion: `d6cbc6c` (baseline tag above).
- Main menu / directional transitions: `e85e847`.
- Inbox / conversation contact header / fixed reply composer: `98101a1`.
- Friends / profile detail / compose: `849d717`.
- Account editing / admin transitions / role badges: `5845501`.
- Final review: commit containing this report; see `git log -1`.

## Final verification (2026-10-15)

- Native TypeScript: passed.
- ESLint on all four changed profile implementation files: passed.
- Nested interactive-button regression check: passed.
- Native suite: 59/60 passed, including profile actions, identity boundaries, role routing, read receipts, admin approval/RSVP, and directory tests.
- Remaining existing failure: `native-text.test.ts` reports four HTML `<p>` text nodes in `news/PdfPages.web.tsx`. Both that test and the web PDF file are unchanged from d6cbc6c. No unrelated News changes were made.
- Expo production web export: passed, output `/tmp/townloop-profile-parity-web`.
- No authenticated live writes, destructive actions, Firebase rule changes, or new collections were performed for verification.

## Differences / review requirements

- Browser access denial prevented a live screenshot or animation comparison; visual and touch-device parity is not certified.
- Kept the user's previously requested fixed 640/680px shell (clamped to available height), rather than shrinking back to the original 520/560px shell. Also retained the stronger panel contrast, friend-only recipient selector, conversation photos/badges/read receipts, and admin RSVP layout without search.
- Native backdrop blur uses Expo Blur; the original CSS blur-to-focus on the menu itself remains web-only. Native uses the matching scale/translation/fade spring instead.
- Original fabricated online statuses, default 2024 join year, placeholder office telephone numbers, and hardcoded safety enrollment are omitted or identified as unavailable. Real join dates/interests/contact data are displayed when present.
- Calls use the device dialer and copy uses Expo Clipboard instead of the original browser clipboard/toast-only call. Existing custom Android/iOS development builds need rebuilding to include the newly added Expo Clipboard native module.
- Account name/email/access controls are not exposed for direct self-edit; allowed contact/residency fields save to `users/{currentUid}`, including legacy field aliases. Profile-update requests still reach the office through the actual messaging flow.
- The original database purge service itself refuses cleanup without verified mock document IDs; native preserves that same refusal/confirmation UI.
- No community-switch button is rendered in the original menu (the prop is unused), so none was added.
