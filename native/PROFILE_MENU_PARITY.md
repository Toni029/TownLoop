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
| Account | address/phone/emergency/dietary/safety rows, profile update request | Account; existing editable `/account` retained |
| Logout | explanatory panel, Cancel/Yes, errors/busy, authenticated sign out | Logout confirmation |
| Admin residents | pending/approved totals, approval, roles/confirmation, live directory, error/empty | Admin Residents |
| Admin RSVP | counts, event date/time, expand attendees, delete attendee/event confirmations, empty | Admin RSVP |
| Admin database | destructive purge confirmation, progress/errors | Admin Database |

`onSwitchCommunity` is an unused original prop: there is no community-switch control in this original menu. No new control or collection is invented.

## Intentional retained behavior

Retain previously requested fixed larger panel height, stronger contrast, resident/crew/staff avatars and read receipts, friend-only recipient selector, and admin RSVP without search. Keep actual Firebase collections and authorization. Original fabricated online statuses, fallback resident year, placeholder telephone numbers, and hardcoded safety enrollment must not be represented as live facts. Profile editing stays available via the existing Account screen; profile-update requests actually compose an office message instead of merely showing the original toast.

## Verification limitation

The browser tool denied access to localhost:3000 through a saved permission. Source comparison is available; live side-by-side animation/visual verification and authenticated device interactions remain unverified.
