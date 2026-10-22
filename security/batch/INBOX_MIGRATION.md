# H1 inbox compatibility hold

Local changes only; no Firebase data was inspected or changed.

- New friend conversations use `identityVersion: 2` and two exact, case-sensitive approved UIDs. Deploy the `resident_chats` composite index with compatible clients and rules.
- Existing friend conversations without that marker are deliberately inaccessible to these clients/rules. A separate trusted dry-run migration must resolve both participants against authoritative UID records, obtain review of ambiguous/colliding identifiers, and then backfill canonical membership plus the marker. Never derive membership from names, unverified emails or sanitized aliases. Keep historical messages unchanged.
- Office and maintenance history with an authoritative `residentId` UID remains discoverable even when the document ID was formerly email-based. Email-only ownership needs separate reviewed migration; it grants no access now.
- New receipts are `readBy[uid] = messages.length`; hiding is `hiddenBy[uid] = messages.length`. Neither operation replaces messages or deletes shared history. A later incoming message reveals a hidden conversation again in the native Inbox.
- Install the source, rules, index and prepared backend policy together only after emulator validation and explicit deployment authorization.
