# Profile submenus — 2026-10-14

Reference: original ProfileAvatar.tsx and AdminPanelModal.tsx served by the original app. Browser automation remains blocked by a saved browser permission; this pass compares source, without claiming pixel-level visual verification.

## Mail (Inbox)

Restored header/Mark all read, fixed four-way filter tabs, category-colored compact conversation cards, role/category tags, timestamp/unread marker, subject/body preview, delete-conversation button and confirmation, and fixed Msg Office / Msg Crew / Msg Friend footer. Existing message subscription, recipient identity, compose, reply, and unread mechanisms remain. Delete verifies membership before issuing a transaction; no messages were actually deleted during verification.

## Friends & Residents

Restored neighbor count, search icon and exact name/apt/wing prompt, instructional copy, responsive 48/56px avatars, contact rows including phone, direct message action, and original empty-state text. Resident detail and calling/message behavior remain available.

## Resident Account

Restored icon-and-label/value information rows for address, phone, emergency contact, dietary preference and daily safety check-in, Active label, and Request Profile Update button. Profile Update opens an office message draft rather than presenting a false sent confirmation. The existing /account route remains available through a secondary Open Account / Profile control.

## Admin Portal

Restored larger 672px/88vh portal, amber header, Cecil Pines emblem, Back control, Directory / RSVP Upcoming / privileged Database Clean tabs, pending badges, resident avatars/role/contact information, approval controls and approved status. Retained existing native role changes behind Role controls with confirmation. Directory excludes privileged accounts and deduplicates IDs/emails as the reference does.

RSVP roster uses existing live community_events data and chronological sorting, search, expandable attendees, event and attendee deletion confirmations. Mutations require the existing manager authorization; no production events were changed. Attendee count and capacity update atomically and removal is idempotent.

Database Clean reproduces the original utility's text and controls. It preserves the original safe backend response: cleanup requires a verified mock-document allowlist, and performs no collection-wide wipe.

Validation: native TypeScript, focused ESLint, 9 focused unit/JSX checks and Expo web export passed. No production data or backend rules changed. Original menu motion and the recently increased panel/button contrast are preserved.
