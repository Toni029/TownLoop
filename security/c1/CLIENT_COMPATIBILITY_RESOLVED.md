# C1 client compatibility follow-up — local only

This supersedes the outstanding leave-marker/cache gates in the earlier plan.
No live data access, production writes, deployment, push, OTA, or build was done
in this follow-up. The previously approved projected metadata check found 2 chats,
2 identity-metadata compatible, 0 needing identity migration, 0 unclassified.
Message authenticity/history schemas were not inspected or certified.

## Leave markers

Native model, shared write protocol, and web display use one pure helper. It accepts
explicit boolean seller/buyer flags and exact `seller`/`buyer` role markers only.
Names, sanitized/case-folded UIDs, and local hide-cache entries are not authority.
An old alias-only hidden conversation may reappear for its authorized participant;
they can leave again using explicit flags. No stored aliases/history are rewritten.

The shared leave action only sets the acting participant's flags and appends its
authenticated system notice. Repeated leave is a no-op. It no longer physically
deletes a conversation when the second participant leaves, preserving all history
and participant fields. The C1 candidate still permits a direct final deletion
only after the counterpart has left (previous reviewed rule); updated clients do
not invoke that permission. Rules are unchanged in this follow-up.

## Untrusted legacy cache and draft recovery

- Keep `townloop_marketplace_chats_v1` byte-for-byte. Never remove it at startup,
  overwrite it from snapshots, merge it into live history, or auto-upload it.
- The existing inbox composer has a small **Recover local message** action. Only
  this explicit action reads the archive, after rechecking the authenticated UID
  and fetching that conversation from the server to verify exact participation.
- Offer only this user's own non-system text for an exact matching chat and both
  exact participant IDs. Compare against fresh server message IDs and the user's
  already-sent text; suppress duplicate local candidates and previously recovered
  IDs. No other resident's cached messages, names, media, or contact fields are
  displayed as recovery material.
- Selecting text restores it into an empty composer, never overwriting a current
  draft. The user must separately press Send. The new message uses authenticated
  sender metadata from the shared protocol, not cached claims.
- Web reply and inquiry drafts are saved separately by exact UID and chat/listing.
  Inquiry contact-info preference is retained. Account/conversation switching
  cannot reuse another draft. Only acknowledged sends clear the matching draft;
  failure retains text and a stable operation ID for idempotent retry. An old
  acknowledgment cannot erase a newer draft written in another tab.
- The inquiry callback no longer reports success/closes the form on failure.
  Storage/quota/corruption failures show a warning; corrupt archives/drafts are
  not overwritten automatically. Keep the window open if local saving fails.

Ambiguous/name-based cached identities and cache-only chats with no verifiable
server record remain untouched, but are not automatically exposed or imported.
Any recovery of these needs separately approved identity review. Browser storage
remains local/unencrypted and may be lost if the user clears site data; this change
cannot reconstruct text the old client never persisted or previously deleted.
There is no new cloud cache collection or data migration.

## Focused verification

- Synthetic in-memory checks cover alias handling, user/chat isolation, archive
  preservation, sent-message deduplication, acknowledgment-safe draft cleanup,
  persisted inquiry preferences, malformed data, and storage failures.
- 51 C1 assertions passed against the **Console-baseline C1 candidate**, in a
  disposable loopback Firestore emulator with mocked auth. They include the real
  shared protocol, concurrent/idempotent replies, denied nonparticipant access,
  and both leave actions retaining original messages. No Auth accounts created.
- Native TypeScript and focused web TypeScript checks passed. No real resident
  chat UI was opened for testing. Real browser/device acceptance remains for the
  separately approved release; these checks do not establish rollout activation.

## Coordinated deployment readiness

The two client gates are resolved locally; no identity migration is indicated by
the approved metadata scan. This is ready for release review, not permission to
deploy. Remaining operational gates: approve outgoing commits (including/isolate
the prior UI/PDF checkpoint), Preview OTA for supported runtimes, separate web
deployment, confirm client activation or an agreed upgrade cutoff, recheck the
live rules baseline, and separately approve the C1-only rules candidate. Prepare
and verify a participant-only restricted fallback before rule cutover. Never use
the root pending rules file or restore public chat access as rollback. C2 is out
of scope. These JavaScript changes add no native dependencies; matching-runtime
OTA can deliver the native portion, with no new APK inherently required.
