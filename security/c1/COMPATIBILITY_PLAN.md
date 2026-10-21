# C1 compatibility and OTA activation review

**Follow-up:** the separately approved metadata scan and local client fixes are
complete. See [CLIENT_COMPATIBILITY_RESOLVED.md](CLIENT_COMPATIBILITY_RESOLVED.md)
for the current status. The remainder of this file preserves the original plan
and its historical gates; it is not a statement that those checks remain undone.

Read-only source/config review, October 21, 2026. This is a plan, not permission to
execute it. No live conversation/profile/Auth data was read, no tests rerun, no
credentials changed, and no publication/deployment/build performed.

## Decision

Legacy conversations can be preserved **conditionally**, without rewriting their
IDs/history: exact `sellerId` and `buyerId` Firebase UIDs are the authority. The
old code proves that name-based records could have been created; source inspection
cannot tell how many exist. A narrowly authorized metadata check is needed before
claiming uninterrupted access for all residents. Migration is not automatically
necessary, and none is prepared to guess identities or copy message bodies.

C1 is not yet cleared for a universal, no-interruption production cutover. The
rules candidate is ready for review, but unresolved data/client compatibility
must be addressed first. Earlier 51 emulator results remain valid for the cases
they cover; they do not certify real records or all old client versions.

## Source inventory and compatibility matrix

Original `src/services/marketplaceChat.ts` at checkpoint 1804071 created:
- sellerId = String(item.authorId), or the seller display name if unavailable;
- buyerId = String(buyer.id), or the buyer display name if unavailable;
- participantIds = lowercased/sanitized seller and buyer references;
- document ID = mkt_{sanitized item ID}_{sanitized buyer reference};
- a global localStorage cache, written before attempted Firestore synchronization.

Native `social/actions.ts` previously stored seller/buyer UID strings and sanitized
participantIds. The prepared shared protocol stores canonical IDs for new rows,
uses scoped seller-or-buyer queries, preserves existing document IDs, and only
validates newly appended messages rather than rewriting historical entries.

| Existing condition | Secure behavior / necessary action |
|---|---|
| Exact sellerId/buyerId Firebase UIDs, valid approved accounts | Supported by prepared queries/rules; preserve document/history |
| Sanitized, missing or unusable participantIds, but exact seller/buyer UIDs | Not an access blocker: participantIds is ignored for authorization on existing documents; no migration just for this field |
| Missing sellerId or buyerId | Cannot restore the missing person's access by guessing; any exact remaining UID may still match the read query, but the record needs review before full read/reply continuity can be promised |
| Names/emails/case-folded or sanitized values in sellerId/buyerId | Do not infer identity; affected party's exact UID query will not match. Reviewed authoritative mapping required |
| Equal seller/buyer IDs, numeric references, malformed identity values | Flag for review; do not invent a second account or silently coerce identities |
| approved missing/false or unsupported role | Secure rule denies that account; approval/role normalization requires separate authorization, not automatic migration |
| Deleted listing with otherwise valid existing chat | Reading/replying in the existing open chat remains supported; new inquiries still need a valid available listing and approved seller |
| Missing data.id with valid Firestore document ID | Document-reference ID is used by readers; no renumbering required |
| Legacy explicit leave flags or buyer/seller role markers | Supported by shared protocol/rules |
| Only a sanitized UID in deletedBy | Not authority for deletion. Native UI still interprets these markers more broadly than the shared protocol; align the C1 client behavior before release, without using lossy IDs for permissions |
| Missing/non-array messages or other malformed history | Not certified by the proposed metadata-only identity check. No automatic history reset or replacement; existing source types do not prove real schema validity |
| Legitimate messages stored only in old web localStorage | Not recoverable by Firestore migration. Must not auto-import an untrusted globally cached history into secured chats |

A UID-shaped string is not proof of historical ownership: the live public rules
allowed arbitrary record changes. The metadata check can establish reference
consistency, not certify that old messages/ownership claims were authentic.
Document-ID parsing and name matches are never evidence sufficient to authorize
access. Returning results to previously unauthorized viewers is not compatibility.

## Privacy-preserving verification plan — DO NOT RUN without separate approval

### Authorization and scope

Obtain explicit approval for a read-only Marketplace **identity metadata** check
in the named Firebase project/default database, plus the minimal account-reference
checks described below. Do not create accounts or query Auth message/user lists.
Use an already-authorized read-only identity; no new administrative key embedded
in either app. If adequate access is unavailable, stop and report it.

### Server-side projection, not fetch-then-redact

Use a reviewed server-side Firestore projection (`select` / REST structuredQuery
field mask) for only:

- Firestore document reference/name;
- sellerId, buyerId, participantIds, itemId;
- sellerLeft, buyerLeft, deletedBySeller, deletedByBuyer.

Do **not** request messages, lastMessage, sellerName/buyerName, avatars, addresses,
contact details, photos, or attachment URLs. Do not use an ordinary collection
snapshot followed by client-side stripping: that would already download private
message contents. Do not open Firebase Console documents, which can fetch whole
records. Do not broadly export the collection.

`deletedBy` can contain both names and UIDs, so omit it in the first pass. A second
metadata pass for that field, if truly needed to resolve leave-state compatibility,
requires explicit scoped approval and must never print its raw values.

Process bounded pages locally/in memory. Cross-check only the referenced UID
strings against trusted account keys with projected id/approved/role metadata.
If Firebase Auth UID existence must also be verified, obtain explicit read-only
Auth-lookup approval for those referenced IDs; do not enumerate unrelated users,
change accounts or output names/emails. An exact document key alone is not proof
of an active Auth account or rightful history ownership.

### Output and retention

Output aggregate counts only: total scanned, identity structurally consistent,
missing ID, unresolved ID, equal IDs, unapproved/unsupported account, and legacy
participantIds category. Counts may overlap; do not imply disjoint categories.
If a later approved repair needs per-record tracking, use run-local opaque/HMAC
references in a protected, short-lived local map; no resident UIDs, document paths,
participantIds or personal identifiers in chat/logs. Delete temporary maps after
review under the agreed retention policy. Perform zero writes and create no
production audit collections.

### What this check cannot prove

It cannot inspect message-array contents or validate historical sender authenticity,
recover local-only messages, or verify actual APK activation. It also cannot infer
ownership of ambiguous name-based records safely. Field projection must not be
expanded to download messages merely to check their type. If these issues prevent
certification, report the limitation and stop for a new, specifically scoped plan.
Any migration is a separate approval: trusted identity mapping, backups, dry-run
counts, per-record preconditions and idempotence; preserve document IDs/history,
never guess names, never rewrite/delete messages, and quarantine ambiguity.
No migration script is implemented or executed in this review.

## Original web client risks to resolve

1. Older web clients request the whole collection and merge stale complete chat
   snapshots. The secure rules must reject these operations; refresh/updated
   deployment is required, not a temporary public-read exception.
2. The original web implementation accepted display-name and sanitized-ID matching.
   The prepared version correctly removes those as authority; ambiguous histories
   therefore need review rather than permissive compatibility.
3. Original writes were placed in the global cache before Firestore success. The
   prepared web subscriber removes that old cache at startup. It may contain
   unacknowledged local-only messages as well as improperly cached conversations.
   **Resolve preservation/quarantine policy before deploying this destructive
   local-cache step.** Do not automatically display, upload or associate cached
   history based on names. This source review has not opened or deleted a cache.
4. Native `social/model.ts::hasLeft` still accepts sanitized UID leave markers;
   shared `marketLeft` and rules accept only explicit flags/role markers. This
   can cause differing visibility between clients. A small C1 client alignment
   is still needed before calling the secure client release complete. No product
   code was changed during this planning task.

## Existing Android APK update path

Confirmed from `native/app.json`, `native/eas.json`,
`native/src/development/PreviewUpdateNotice.tsx`, and the Preview publish script:

- Existing Expo project ID: 9f970d26-beed-44d6-a590-9dcdc00e85de.
- Android identity unchanged: com.toni029.townloop.
- `preview` builds use the Preview channel/environment; Production is separate.
- Updates are enabled at the configured EAS URL, with fingerprint runtime policy,
  checkAutomatically=ON_LOAD and fallbackToCacheTimeout=0.
- An approved matching-runtime Android Preview OTA can carry the C1 JavaScript
  changes using existing Firebase/native dependencies; no new APK is inherently
  needed for this security fix.
- A supported APK checks on app startup while online, can run its current cached
  bundle immediately, and downloads a compatible update. Download is not activation.
  The existing UI offers Download/Retry and user-confirmed Restart to apply.
  A later cold launch can use an already-downloaded update. Never interrupt an
  active form automatically or clear app data to force activation.
- Different-runtime APKs need a compatible approved update for their own runtime,
  or eventually a reviewed new APK if their runtime cannot support the client.
  Do not override fingerprints. APKs without EAS Update cannot receive it.
- Development builds and Production-channel installations are not updated simply
  by publishing Preview. No live EAS channel mapping, artifact runtime inventory
  or device update activation was queried in this task. Previously reported
  runtime 34fdc17d0432044445e5789a549f8e9bfbcf8b3c is historical evidence, not a
  fresh certification of every installation.
- No mandatory-version gate or reliable activation telemetry was added by C1.
  Do not confuse publishing to EAS with every resident having activated the fix.

## Safest sequence and separate approvals

1. Approve only the metadata verification scope above if universal legacy-access
   assurance is required. Run that later, report counts, stop on ambiguity.
2. Approve focused C1 client work for the leave-marker mismatch and a safe old-cache
   preservation/quarantine decision. If actual record repairs are needed, approve
   their mapping/dry-run/migration separately; do not bundle those into permission
   to run a metadata check.
3. Review/approve the outgoing commit range. C1 work sits after local recovery
   checkpoint 1804071, which includes earlier unpushed UI/PDF changes. Either
   approve that whole release scope or authorize an isolated C1-only release.
4. Approve the GitHub commit/push, then the matching-runtime Preview OTA, then the
   separate web deployment. These are distinct actions; none is authorized now.
   Verify the user has activated the Preview update and browsers refresh. If
   other runtimes/channels are in use, obtain their separate release approval.
5. Recheck the Console baseline has not changed and approve only the composed
   candidate `security/c1/firestore.c1-candidate.rules`. Preserve every unrelated
   rule. Do not deploy root firestore.rules, which contains other pending changes.
   Arrange an update cutoff/short messaging maintenance window if older clients
   cannot be confirmed ready; zero interruption cannot otherwise be guaranteed.
6. After explicit approval, publish that C1-only rules candidate and verify the
   published version/hash. Use only separately consented checks; do not log
   message bodies. Other security findings remain out of scope.
7. If necessary, keep participant-only reads and temporarily restrict writes or
   messaging while fixing forward. Prepare/review a secure fallback before
   cutover. Never restore public access, restore an old client with broad queries
   as a working secure fallback, or modify chat history to resolve errors.

**Current hold:** production record compatibility, local-cache preservation,
leave-marker UI alignment and client activation/version coverage remain unresolved.
This does not mean all legacy chats need migration or that stored data must be
removed. No further action is taken until the user approves the next scoped step.
