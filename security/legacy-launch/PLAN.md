# Legacy named-database launch authorization plan

Goal: prepare, never deploy, a named-database-only privacy repair against baseline `224a64b96335d0b4b4e3d6ab72e12d8d640ae46d2b0aca0654741d7dc156e7e2`.

Scope approved by the user: local rules, isolated compatibility support and focused emulator tests; no live records, migration, cleanup, production write, Hosting publication or deployment. Native/default and shared source stay unchanged. Exact original hosted source is unavailable; its public bundle remains identified by SHA-256 `1dfd19fb7b3b4966a1595a18f0059c7263c4fa67dc69dd6886912b66ad5a55c5`.

- [x] Pin original hosted operations and differences from current repository web/native.
- [x] Write focused failing assertions for pending-profile and cross-user access against the known vulnerable named baseline in a disposable emulator.
- [x] Prepare dedicated named rules: approved canonical roles and deletion fences; owner/manager profiles; server-only public projection; trusted per-record authorization for formerly publicly writable private history; canonical append-only messages/own read cursors; scoped Work Orders. Unknown historical ownership fails closed, regardless of client-authored identity fields.
- [x] Prepare an isolated adapter for explicitly authorized existing-thread reads/appends and own order reads. Do not pretend this is an integrated original-site backport. New private-history provisioning remains a separate server/client gate.
- [x] Verify all four roles, pending/anonymous/revoked users, spoofing, manifest forgery, changed identities and immutable histories in the focused emulator suite. No broad suite repeat.
- [x] Write exact named-only deployment manifest, hash guard, compatibility/rollout and secure read-only fallback. Record unresolved original-source/projection/provisioning/deletion inventory gates. Root reviews and commits; no commit here.
