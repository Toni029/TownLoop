# C1 — Marketplace conversation security (local proposal)

> **Latest status:** the full Console baseline has now been supplied. See
> [Console-baseline candidate and rollout](c1/README.md) for the composed C1-only
> file, preservation checks and remaining rollout gates. Earlier missing-baseline
> notes below are historical and superseded by that review.

Date: October 21, 2026. Branch: `native/expo-migration`.
Recovery checkpoint **1804071** includes all pre-C1 local UI/PDF work.

**Nothing deployed or published. No production resident documents or media were read.**
An existing-token GET of the Firebase Rules release API returned **HTTP 401**.
No credential refresh/login/change was attempted. The user subsequently confirmed
from Firebase Console that the published Marketplace block is unrestricted.
That confirms live C1; the complete published rules have not yet been supplied
in this chat, so the rest of the live ruleset remains unverified.
The web Marketplace service at `origin/main` matches the pre-C1 native branch
byte-for-byte; the changes here therefore also represent the required web fix.
Main itself has not been changed.

## Cause and proposed correction

`marketplace_chats` had unrestricted rule access, both clients listened to the
whole collection, and web participant matching accepted display-name/case-folded
fallbacks. Its global localStorage chat cache could retain other users' chats,
and failed server writes silently fell back to locally “sent” messages.

- `native/src/lib/liveCollection.ts` now uses a UID-constrained seller-or-buyer
  query for Marketplace chats; refresh uses the same scoped query. It retains
  the existing account-keyed subscription lifecycle.
- `src/services/marketplaceChat.ts` uses the same query and actual Firebase Auth
  UID. No unscoped persistent-chat fallback. New code discards the old global
  cache on client startup; this was **not executed against resident data** here.
- `src/services/marketplaceChatProtocol.ts` is the shared transactional protocol
  used by native `social/actions.ts` and the web service. It obtains fresh
  approved canonical profiles, verifies listing/seller linkage, preserves chat
  IDs, appends messages atomically and maintains operation IDs across retries.
- `src/components/community/MarketplaceChatModal.tsx` uses exact UIDs for sides,
  read state and message alignment. Replies retain drafts on failed writes.
- `firestore.rules` changes **only** the Marketplace authorization block and adds
  its narrowly named helpers. Approval must be explicitly true; valid roles are
  resident/Admin/VIP/Crew. Neither elevated roles nor matching names grant access
  unless that exact UID is the buyer or seller.
- Creates require the authenticated buyer, a different approved seller backed
  by the referenced Marketplace listing, canonical participants, authenticated
  sender identity, matching profile names/avatars, and a single initial message.
- Seller/buyer and all chat metadata are immutable after creation. Replies must
  append exactly one message without changing any prior entry. Acknowledgment
  changes only the acting participant's unread flag to false.
- First leave changes only the actor's leave flags and appends the fixed system
  notice, with actor UID. Arbitrary system messages are denied. Sending after
  either participant left is denied. Permanent deletion is allowed only to a
  participant whose counterpart has already left, preserving the second-leave
  behavior. Ordinary participants cannot delete another person's active chat.

Rules may allow a no-op update whose resulting document is unchanged; this is
not permission to alter the counterpart's read flag or message data.

Strict append validation exposed an emulator contention case: stale optimistic
transactions could get permission-denied before the SDK's normal ABORTED retry.
The shared client has at most two additional retries **only** when a server read
proves another append happened since its last observed snapshot. It never changes
rules or falls back to an unprotected write; actual authorization failures still
fail. Stable operation IDs prevent replaying an already saved message.

## Existing conversation compatibility

No new collection and no automatic production migration. Existing document IDs,
message arrays, photos and listing links are preserved. Existing conversations
with exact Firebase UID strings in `sellerId` and `buyerId` remain accessible.
Legacy sanitized `participantIds` do not need rewriting: they are retained and
ignored as access-control authority.

Records using display names, email aliases, sanitized/noncanonical UIDs, absent
participant IDs, malformed message arrays, missing approval or unsupported legacy
roles require an individually verified migration/repair. Legacy leave state must use explicit buyer/seller flags or role markers; a
sanitized UID alone is not permission to delete history. New listing inquiries
require an existing listing with a canonical owner and an approved seller.
Existing chat reads/replies do not require that an old listing still exists.

**No live inventory was performed, so not all existing conversations can be
certified compatible.** Since old rules permitted arbitrary writes, historical
ownership claims may have been tampered with: an existing UID-looking field is
not proof of provenance. A separately authorized migration must corroborate
ownership using trustworthy evidence, never guessed names/aliases. Do not allow
a resident to self-upgrade a legacy chat's participants to bypass this review.

No “fallback to public access” is provided. Old web/native clients that request
the whole collection or submit stale full chat snapshots will stop working under
these rules. The updated web service must be released too; native OTA alone is
insufficient to protect or preserve older clients.

## Focused verification

`native/verification/marketplace-c1-rules.mjs` loads the actual proposed rules into
an isolated `demo-townloop-marketplace-c1` Firestore emulator bound to loopback.
It refuses non-loopback endpoints and uses only unsigned mocked-auth contexts,
not Firebase Authentication accounts or the Auth emulator.

**51 assertions passed**, covering:
- approved participant reads and seller/buyer OR queries;
- unauthenticated, pending, missing-approval and unrelated users denied;
- nonparticipant Admin/VIP/Crew denied (no moderator access to private chats);
- whole-collection queries and forged membership denied;
- forged seller/listing, participant IDs and message senders denied;
- message rewriting/removal, wrong read-flag mutations and arbitrary deletion denied;
- legitimate multiline replies, read acknowledgment and two-stage leave/delete;
- immutable historical prefix, legacy sanitized participant arrays, ambiguous names denied;
- actual shared write implementation: create, idempotent retry, concurrent replies
  preserving both messages, scoped querying, receipts, leave and closed-chat rejection.

Reproduction (temporary tools directory with `firebase@12.19.0` and
`@firebase/rules-unit-testing@5`; Java emulator already installed):

```sh
FIRESTORE_EMULATOR_HOST=127.0.0.1:8897 node native/verification/marketplace-c1-rules.mjs /absolute/path/to/disposable/tools/package.json
```

No Auth accounts were created and no real conversations were used. Native
TypeScript, focused web type-check and targeted native lint were run. A full web
project type-check also exposed unrelated existing ErrorBoundary/Auth-nullability
errors in unchanged paths; the focused changed-web-path check passes. No full test suite or build.

## Safest rollout, after separate approval

1. Obtain authorized read-only access, export/snapshot the **actual deployed**
   Firestore rule source and identify supported client versions. Do not deploy
   the repository's entire rules file: it already contains other pending fixes.
   Apply only this C1 block to the reviewed live baseline.
2. With separate authorization for resident-data review, inventory compatibility
   using minimal metadata; resolve ambiguous ownership conservatively. If a
   migration is needed, make it backed up, reviewable and idempotent. None is
   implemented or executed here.
3. Release the updated web client and the approved native OTA to the matching
   runtime. Ensure active clients have switched. During this gap, existing open
   rules are still insecure; keep the staging window short or arrange a clearly
   announced messaging maintenance window rather than claiming protection early.
4. Deploy only the reviewed C1 rules after approval. Older clients cannot retain
   whole-collection access securely: require client update or show an upgrade/
   temporary-unavailability message. Truly zero interruption cannot be promised
   while old insecure clients remain active.
5. Verify authorized queries with consenting participants and monitor aggregate
   permission errors after explicit approval. Do not log message contents. Keep
   the client checkpoint and rule snapshot for recovery; do not roll back to
   public chat access to solve compatibility problems.

Native changes use the existing Firebase SDK and are OTA-compatible; no APK is
inherently required. Web deployment and Firestore rules deployment are also
required. Client changes by themselves do not remediate live C1.

C2 and every other audit issue remain untouched. C1 does not repair the separate
Marketplace listing/profile rules, previously public Storage, other Inbox
collections, existing message authenticity or account-deletion/moderation gaps.


## Follow-up: coordinated deployment readiness

**Status: local implementation ready for review; coordinated production deployment
NOT yet certified ready. Nothing deployed.** No additional emulator run was
needed: reuse the 51 existing assertions for this unchanged C1 rules/protocol.
They were not run against a Console export because only the three-line live
Marketplace excerpt was received. This follow-up made documentation changes only.

### Remaining gates

1. Receive the complete published Firestore rules text/export. Check all matches,
   recursive wildcards and helpers: Firestore matching allows are additive, so a
   broader allow could defeat the new Marketplace block. Compare helper/profile
   semantics and naming against the actual live baseline. The C1 patch must be
   inserted into that baseline without importing other pending local rule fixes.
2. No real conversations were inspected. Canonical seller/buyer UID fields and
   sanitized participantIds are covered by synthetic fixtures, but actual identity
   provenance, malformed records, approval flags and legacy leave markers are
   unknown. Do not promise universal continuity. If metadata review or migration
   is necessary, stop for separate authorization; do not migrate by guessed name.
3. Installed older clients query the entire chat collection and/or submit stale
   full-document writes. There is no new mandatory-version gate in this C1 patch.
   Update availability is not proof every resident has activated it. Establish
   a supported-version cutoff/upgrade plan or a communicated messaging window;
   otherwise zero interruption cannot be guaranteed without retaining the hole.
4. A release from current HEAD also includes recovery checkpoint 1804071's prior
   unpushed UI/PDF changes. GitHub push and EAS Update do not magically include
   only the C1 files. Review those ancestor changes too, or separately authorize
   preparation of a C1-only release based on the last deployed compatible source.

### Exact approval-gated rollout sequence

1. **Before publishing:** resolve gates 1–4, snapshot/version the actual live rules,
   identify the currently deployed web and OTA versions, and prepare an exact
   Marketplace-only rules candidate with an outside-C1 byte comparison. The
   existing 51 results can be reused if the candidate is equivalent; if live
   helpers/overlapping rules differ, run only necessary focused emulator checks
   against the composed candidate using mocked contexts.
2. **GitHub:** after approval, commit C1 code, shared protocol/types, scoped
   queries, rules candidate, tests and review notes as a distinct checkpoint on
   native/expo-migration. Review the whole outgoing commit range, then push.
   Pushing source must not automatically deploy rules or publish an OTA.
3. **Preview:** after approval, publish the compatible Android EAS Preview OTA.
   It is needed for the installed Preview APK's queries and writes to obey the
   proposed rules; no new APK is inherently needed. User activates it by restart
   when safe. Test using mocked data or separately consented user workflows; no
   resident conversations may be inspected under this authorization. Preview
   does not update future/existing Production-channel builds.
4. **Web:** separately deploy the approved web Marketplace service/modal changes
   to the actual web hosting target, retaining all unrelated code/config. Do not
   assume GitHub or EAS publishes the web app. Ensure active tabs refresh or
   adopt the approved version. Main has not been changed here.
5. **Client readiness/migration gate:** confirm intended users have the compatible
   client. If there are Production-channel residents, obtain separate approval
   for a compatible Production client release: a Preview OTA cannot reach them.
   Complete only separately authorized identity repairs, with backup/dry-run and
   verified ownership, before depending on the new rules. If these conditions
   cannot be established, pause or arrange a short messaging maintenance window;
   do not add a public-read fallback or names/aliases as authority.
6. **Rules cutover:** after explicit approval, publish the exact reviewed full
   rules candidate containing only C1 changes relative to the Console baseline.
   For CLI deployment use a reviewed temporary Firebase config that references
   that candidate and the explicit project/database; a scoped Firestore-rules
   deployment still replaces the entire ruleset, so scope flags alone do not
   protect unrelated rules. Do not deploy Storage/functions/indexes or other
   pending rules. Verify the published ruleset/version/hash after cutover.
7. **Post-cutover:** monitor aggregate denied requests and verify authorized
   participant operations only under separately approved/consented access.
   Unauthorized clients must stay denied. Preserve conversation documents/IDs;
   a UI permission failure is not data deletion. Avoid logging message contents.
8. **Safe recovery:** keep an approved participant-only read policy while repairing
   client/write compatibility, or temporarily disable Marketplace messaging.
   Publish a forward client fix compatible with strict rules. If a secure rules
   regression is identified, revert only to a reviewed secure C1 policy on the
   same live baseline. Never restore allow read, write: if true, widen access,
   roll back unrelated rules, or automatically restore/migrate conversation data.
   No pre-existing secure live C1 rollback policy is currently verified, so that
   restricted fallback should be prepared and emulator-checked before cutover.

We stop here until the complete published rules are provided and remaining gates
are resolved. This is not authorization to view real data, publish any client,
change credentials or deploy rules. C2 and all other vulnerabilities remain out
of scope.
