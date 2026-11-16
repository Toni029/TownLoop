# Final media requirements — local only

This supersedes the Marketplace preview-copy behavior and activation suggestions in
RELEASE_STATUS_2026_11_16.md. The user explicitly withdrew the earlier instruction
to retain listing preview images. No production copy was created by this work.

## Completed changes

- Deleted listing events remove itemMediaUrl and set listingDeleted on existing
  Marketplace chats. The native conversation displays "This listing has been
  deleted." rather than opening a nonexistent listing. Ordinary messages, reply
  controls and independently owned attachments are untouched. The existing
  deleted-listing function performs this non-destructive preview retirement even
  while the Storage-deletion flag is off. Transient errors use existing event retry.
- Removed marketplacePreviewCopy entirely. No replacement media copies are made.
  Any independently existing historical duplicate would still need verified scope
  and ownership before deletion; this change does not blindly purge old files.
- Existing post-sharing removal remains intact; PDF sharing/viewing is preserved.
- Per-record media authorization still rejects other parents' files. Publication
  now also rejects unmodeled attachment aliases (e.g. smuggled photos/imageUrl)
  rather than accepting them outside the media-ticket comparison.

## Confirmed blocker — do not enable destructive cleanup

Default rules also allow profile avatar URLs to change independently of a deleted
post's ownership ticket. A reference can therefore be inserted after an inventory
scan. Rules hashes, file-generation preconditions and a source tombstone alone do
not serialize that writer. Trusted backend reference writers pose the same general
requirement. Removing Share buttons does not enforce it.

Removed the unsafe production assumption that checking rule hashes provides the
withReferenceProtection capability. Production cleanup now holds files with
concurrent_reference_protection_required instead of deleting them under an unproven
guard. Protected, shared, legacy/unverifiable files also remain held with reasons.
No success assertion may imply that all exclusively owned media is now being purged.

Closing this remaining gap requires an explicitly scoped policy for every permitted
media-reference writer (including profile/media reuse and privileged writers). That
extends beyond a source-record deletion guard. No global freeze, new registry,
scheduler, identity or broader feature change was added to manufacture a solution.
This is a release blocker for the requested fully automatic Storage deletion.

## Deployment boundary

Nothing deployed, pushed, published, built or changed in production. No account-
deletion source, receipt, retention policy, registration or Database Cleanup changed.

The safe subset would require cleanupDeleted_marketplace_posts plus compatible
native JS release to show deleted listing status; its Storage-deletion flag must
stay false. Sharing removal is also native JS. Verify installed Production runtime
before choosing OTA; do not override the fingerprint or bundle an unrelated native
module. The helpers introduce no native dependency.

Full automatic media deletion cannot safely be activated yet. Its prepared scope
remains the three deletion handlers, issueMediaUpload, completeMediaUpload and the
candidate default-database ownership rules. Storage and named rules are unchanged.
Any default-rule rollout must separately account for the existing worker hash guard;
no account-deletion changes are authorized here.

## Single focused verification

One Auth/Firestore/Storage emulator scenario exercises the real candidate rules,
real per-record authorization, owner and Admin/VIP parent deletion, later Crew
attachments, forbidden cross-parent claims/alias fields, deleted-listing chat
retirement, repeated retirement, continuing replies and preservation of messages.
It also checks the actual late profile-reference write and fail-closed Storage
behavior. It does NOT establish successful production Storage deletion. No synthetic
reference-lock callback is injected as a substitute for production protection.
Result is recorded below after that sole run; no broad suite is authorized.

Sole run result: 1 scenario passed, 0 failed (Auth/Firestore/Storage emulators).
The synthetic profile update was accepted after an earlier clean reference scan,
then appeared in the next inventory. All real Storage delete calls remained at
zero under the unproven production guard. Chat history/replies stayed intact and
no preview-copy objects were created. This is explicit evidence of the remaining
blocker, not a claim that successful automatic media purging is operational.
