# Local default-database rules candidate

`firestore.rules` in this directory is an **undeployed candidate**. Root rules,
Firebase configuration, deletion workers, and deletion policy receipts are not
modified by its preparation or emulator tests.

Pinned current default source SHA256:
`4d1c449fc847c8273efdee3b813d16a1e996dd0fdfc766e3cfb09c4ace8eb6d0`.
That source matches `../account-deletion/firestore.default.candidate.rules`.

Candidate SHA256:
`f8b5557e491b852a2ee2f755ac8020b3cbcb76817a4f8598c7f28c58c361d5d0`.

## Coordination blocker

This candidate changes the default rules hash. It must remain undeployed until
the existing account-deletion worker's exact default-rules hash compatibility,
matching policy/activation receipt, and release coordination are resolved
together. A database-cleanup worker receipt alone does not update or authorize
the existing account-deletion worker. No worker or policy changes are included
in this candidate.

## Write fences

Server-only `database_cleanup_control/active.collections` contains the root
collection names selected for the confirmed executing cleanup. Missing control,
a missing `collections` field, and an empty list mean no temporary lock. Only
these roots are eligible: `work_orders`, `discussion_feed`, `posts`,
`marketplace_posts`, `marketItems`, `newsletters`, `community_events`,
`community_highlights`, `newsletter_analysis_jobs`.

The existence of server-only
`database_cleanup_fences/{rootCollection}/records/{rootId}` permanently blocks
client writes to ordinary root records and all descendants, even after the active
lock is cleared or the root is deleted. The cleanup server must write the fence
before processing/deleting the root and retain it afterward. Server SDKs bypass
these client rules, so server-side cleanup authorization remains necessary.

AI-derived `community_events` and `community_highlights` instead share their
parent edition fence at `database_cleanup_fences/newsletters/records/{newsletterId}`.
This keeps a normal atomic publish of many generated records within Firestore's
rule-access limits: repeated reads of the same edition fence can be cached. The
cleanup server must establish that edition fence before deleting any linked
derived root and retain it afterward. Creates check the proposed AI attribution;
deletes check the existing attribution; updates check both, preventing stripping
or changing the old link to bypass a fence. Manual or unlinked records are not
cleanup targets and retain the original authorization. The selected collection
lock still applies to every write in these collections.

The stable `newsletters/current` pointer has one explicit exception: its fence
may contain `descendantsOnly: true`. After the active lock clears, the existing
manager authorization may publish or replace that root pointer, while every
legacy or newly attempted descendant write remains denied permanently. The
exception requires exact `request.path` equality with
`/databases/$(database)/documents/newsletters/current`; the marker cannot relax
any other root's fence. Without
the marker, the ordinary permanent fence still blocks the pointer itself.

Every pre-existing write declaration receives the same guard using
`request.path[3]` and `request.path[4]`; original predicates are retained inside
parentheses. Mixed read/write declarations are split. All pre-existing read
predicates are retained exactly. No client role can access cleanup controls,
fences, jobs, or nested job records. `newsletter_analysis_jobs` remains
server-only under the original default deny; adding it to the whitelist grants
no new client permission.

## Local verification

Regenerate only the candidate:

```sh
node security/database-cleanup/prepare-rules.cjs
```

Against an already running loopback Firestore emulator:

```sh
FIRESTORE_EMULATOR_HOST=127.0.0.1:8189 node --test security/database-cleanup/rules.emulator.test.mjs
```

The test refuses non-loopback hosts, uses disposable `demo-townloop-*` projects,
loads both pinned baseline and candidate into the emulator, and uses synthetic
fixtures only. It neither starts an emulator nor accesses a cloud project.
It checks role/account-deletion boundaries, protected reads, selected root and
nested chunk mutations, unaffected sibling categories and profile/directory
behavior, missing/empty scopes, durable fences, and cleanup metadata denials.
It also proves a 27-document authenticated Admin publish (25 generated
events/highlights plus edition and current pointer) succeeds, while fenced
edition recreation and old-attribution stripping remain denied.
It also verifies every read predicate is unchanged and every write predicate is
guarded. These tests validate client rules, not production release compatibility
or the correctness of server-side deletion.
