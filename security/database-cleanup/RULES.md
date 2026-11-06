# Local Firestore and Storage rules candidates

`firestore.rules` and `storage.rules` in this directory are **undeployed candidates**. Root rules,
Firebase configuration, deletion workers, and deletion policy receipts are not
modified by its preparation or emulator tests.

Pinned current default source SHA256:
`4d1c449fc847c8273efdee3b813d16a1e996dd0fdfc766e3cfb09c4ace8eb6d0`.
That source matches `../account-deletion/firestore.default.candidate.rules`.

Candidate SHA256:
`3f4a221d543783499b0b0cd53369f2177f6137fb5d3f8446137309f6ac941360`.

Pinned Storage source `../c2/storage.compatible.rules` SHA256:
`9aac5f82b7e31fef034b92340714136ec943232de88b1a0076c001331958c3e9`.
Separate local Storage candidate SHA256:
`06d24519f84deb79f2cd6d24248f1ac45242e841cdd69d2ac56a5b3ee4fcbdae`.

## Coordination blocker

This candidate changes the default rules hash. It must remain undeployed until
the existing account-deletion worker's exact default-rules hash compatibility,
matching policy/activation receipt, and release coordination are resolved
together. A database-cleanup worker receipt alone does not update or authorize
the existing account-deletion worker. No worker or policy changes are included
in this candidate.

## Global reference-write barrier

The server-only default-database control
`database_cleanup_control/active.referenceWritesBlocked == true` denies **all**
Firestore client writes before collection whitelist evaluation. This includes
profiles and avatar URLs, every Inbox/chat family, marketplace chats, reports,
nested documents, and any other root with an existing write declaration.
The existing authorization predicates still apply when the field is missing or
false or the control document is absent. Reads remain unchanged for every role.

The separate Storage candidate checks that same default-database control with
`firestore.exists()` and `firestore.get()` before every create, update, delete,
or write predicate. This blocks uploads, byte replacements, metadata
finalization, and deletions while the barrier is true. Every existing
metadata/auth predicate and every read predicate is preserved. No root Storage
rules or Firebase configuration are changed. Missing controls/fields are checked
without dereferencing missing document data.

Preview remains read-only and does not acquire this barrier. Only after explicit
confirmation, execution must acquire it before building a fresh Storage inventory
and verifying all references, retain it through Storage deletion, and release it
on completion or cancellation. Server SDK writes bypass client rules; the worker
must separately coordinate server reference writers. The global barrier and the
existing selected-root locks/permanent fences serve separate purposes.

## Write fences

Server-only `database_cleanup_control/active.collections` contains the root
collection names selected for the confirmed executing cleanup. Missing control,
a missing `collections` field, and an empty list mean no selected-root lock.
They do not bypass a true global `referenceWritesBlocked` barrier. Only
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

Regenerate only the two local candidates:

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
It also verifies that the global barrier denies profile/avatar, resident Inbox
cursor, marketplace chat, and selected-root mutations for every role while
preserving baseline reads, and that missing/false/removed barriers restore the
original authorization. It verifies every Firestore read predicate is unchanged
and every write predicate is guarded. Storage validation in this test is static
preparation validation only: exact pinned baseline, deterministic output,
unchanged read and metadata/auth predicates, guard coverage for every write,
and drift rejection.

The focused `storage.rules.runtime.test.mjs` additionally runs against paired
loopback Firestore and Storage emulators loaded with the candidates, using only
`demo-townloop-cleanup-storage`. Start those emulators with a temporary local
configuration pointing to these candidate rules and run:

```sh
FIRESTORE_EMULATOR_HOST=127.0.0.1:8190 FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199 node --test security/database-cleanup/storage.rules.runtime.test.mjs
```

Verified locally with cached Firebase CLI 15.34.1 and Storage rules runtime
v1.1.3: the Storage candidate compiles; missing/false/absent default-database
controls preserve newsletter PDF upload authorization; true blocks Admin/VIP
creation, metadata updates, and deletion while protected reads still work. A
resumable upload started before the barrier cannot finalize during it. Clearing
the barrier restores create/update/delete behavior. Resident/Crew manager-only
upload denials remain intact. This focused runtime test does not claim exhaustive
coverage of every historical Storage linkage case. These tests validate client rules, not production release compatibility
or the correctness of server-side deletion.
