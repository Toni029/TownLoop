# TownLoop Storage security proposal — October 19, 2026

**Review only. Nothing deployed.** Proposed file: `storage.proposed.rules`.
Not connected to firebase.json, so an ordinary deployment will not pick it up.
Existing icon edits are unrelated and preserved.

## Evidence and inventory

Inspected refreshed `origin/main` (`a6567cd`), native/expo-migration,
`src/services/storage.ts`, original WorkOrderModal/CreatePostModal/ProfileAvatar,
native components/media.ts, media/uploadFile.ts, profile/data.ts and news/edition.ts.
Read the deployed Storage rules through the Firebase Rules API. They contain a
recursive public-read allow and a write allow based only on size <25*1024*1024
and image/*, video/* or application/pdf. No authentication or ownership check.
That permits anonymous creation and overwrites. Deletion actually fails because
request.resource is absent on delete; it is not an explicit secure deletion policy.

Read-only bucket metadata inventory (no media bodies downloaded):
`cc-livingcommunity-app.firebasestorage.app`, 21 objects total, no truncated pages:

| Path | Observed | Writers / Firestore association | Proposed policy |
|---|---:|---|---|
| work_orders/{timestamp}_{uid}_{filename}, native adds random suffix | 6 images (5 JPEG, 1 PNG) | resident submission and staff reply/proof; work_orders/{id}, userId, photos/comments | approved ticket owner or Admin/VIP/Crew reads and uploads to non-Done tickets; Admin/VIP deletion, resident-owned non-Done deletion; Crew never deletes |
| feed/{timestamp}_{uid}_{filename} | 4 JPEG | discussion_feed/{id}, userId; legacy posts/{id}, authorId | approved-community reads; authenticated record owner creates; owner or Admin/VIP deletes |
| marketplace/{timestamp}_{uid}_{filename} | 6 JPEG | marketplace_posts/{id}, userId; legacy marketItems/{id}, authorId | same as feed |
| newsletters/{editionId}/document.pdf | 5 PDFs | newsletters/{id} and newsletters/current | approved reads, Admin/VIP create/replace/delete |

All 21 objects have uploadedBy metadata, but none has orderId. Current common
uploaders do not attach a verifiable record link. Web media uses uploadedBy=UID;
web newsletter uploadedBy is a DISPLAY NAME, not an ownership credential.
Profiles are not a Storage folder: web FileReader and native ImagePicker base64
write avatar_url/avatarUrl in users/{uid}. Storage rules cannot secure those
Firestore fields. No Storage avatar namespace is added speculatively.
Native newsletter uploads currently use existing Firestore PDF chunks, not
Storage; edition deletion also attempts cleanup of legacy Storage PDFs.
Web newsletters additionally have local/chunk fallback representations.

## Rules design

- Default deny, no bucket listing, no wildcard upload permissions.
- Require a real authenticated users/{uid} profile, approved==true and one of the
  four existing roles. Missing/false approvals fail closed; audit legacy profiles
  before rollout because current app checks sometimes treat missing as approved.
- Read roles from existing default Firestore, not client-provided metadata.
- Under 25 MiB, matching the current STRICT less-than limit, nonempty files.
- Work Orders: image types only. Feed/marketplace: images and common video MIME
  types. Newsletter: application/pdf only. SVG/HTML, executable/unknown MIME,
  generic application/octet-stream are denied. Client contentType is not malware
  inspection: MIME declarations can be forged; no claim of content scanning.
- Media objects are create-only. No client overwrite or metadata relabeling,
  including by staff. Replace by uploading a new filename and updating the record.
  Newsletter replacement is an explicit manager-only exception already used by web.
- Two distinct Firestore documents maximum per evaluation: current profile and
  associated record. Repeated accesses to the same document are cached.
- No backend SDK/service-account permission is constrained by these client rules.
  Existing server cleanup and bucket IAM require separate least-privilege review.

## REQUIRED compatibility work BEFORE deployment

This is the complete strict target ruleset, NOT a drop-in deployment for unchanged
clients. Uploads deliberately fail closed until these prerequisites are resolved:

1. Add string customMetadata `securityVersion: '1'`, `recordId`, `collection`,
   and `uploadedBy: auth.currentUser.uid` to both clients' common media uploaders.
   Retain exact current folder paths. Allowed collection names are the existing
   ones listed above. An upload's record must already exist and belong to its
   uploader, except authorized staff may attach Work Order photos to a resident's
   ticket. No new bucket or collection required.
2. Current forms upload BEFORE saving the parent record. Choose and implement a
   secured draft/finalization workflow within the existing collection (hide drafts
   from feeds/queues and validate immutable ownership), or use a trusted backend
   to coordinate upload and record creation. Do not simply reorder code and expose
   abandoned/incomplete tickets, and do not weaken the rules to trust uploadedBy.
   Staff completion proof uploads must occur before transitioning status to Done.
3. Audit deployed Firestore rules for immutable userId/authorId, protected roles
   and approval flags, and draft visibility. The local broad owner-update rules
   must not permit ownership reassignment. Storage lookups are only as trustworthy
   as the parent records. Storage rules alone cannot fix Firestore authorization.
4. Inventory/reference-check legacy objects using existing Firestore media URLs
   and records; after a write freeze or controlled migration, backfill verified
   linkage metadata with Admin SDK. Publicly writable historical uploadedBy and
   filenames are NOT proof of ownership. Do not authorize based on sanitized UID
   regexes (UID sanitization is lossy). Audit any existing version-1 metadata too.
   Unmapped Work Order attachments fail closed under these proposed rules; don't
   deploy until resolved. Social legacy authenticated reads continue, but owner
   deletes need verified links. Admin/VIP may clean orphaned files after review.
5. Delete media before deleting the associated parent, or use trusted server
   cleanup; otherwise owner-based deletion loses its reference. Cross-service
   Firestore/Storage changes are not atomic. Rules deny a resident's deletion once
   the ticket is Done at evaluation, but a strict simultaneous completion/delete
   guarantee needs server orchestration. Do not automatically delete old media
   during this review. Already downloaded files cannot be recalled.
6. Web currently falls back to a data URL after Storage upload errors. That can
   conceal permission failures and move large private media into Firestore.
   Surface permission errors instead. Native resumable uploads already send a
   Firebase ID token; keep Authorization and metadata when adding record links.

## Download URLs and privacy

Existing getDownloadURL token URLs are bearer links. Tightening Storage rules does
not revoke existing tokens, saved copies, or public bucket IAM grants. Someone with
a token URL may still retrieve the object without signing in. This proposal gates
SDK/API reads evaluated by Rules; it does not claim all URL-based access becomes
private. This also means existing URL displays may keep working despite a denied
SDK get, masking problems during rollout.

For genuinely private Work Orders, replace long-lived token delivery in BOTH
clients with authenticated Storage bytes/file downloads or an authorized backend
proxy/short-lived links. Preserve file identities/Firestore relationships, and
rotate/revoke tokens only after that reader migration is tested. Image/video/PDF
components currently consume URLs; just calling getDownloadURL while logged in
is not a solution. Apply the same decision to resident-only social and newsletters.
No token revocation, URL replacement or IAM change was performed here.

## Community boundaries

The current bucket/collections serve Cecil Pines. `selected_community` is local
UI state with a forthcoming-community placeholder, not trusted membership. No
verified communityId is stored in the inspected upload paths/profiles to enforce
multi-community partitioning. Approval in this dedicated Firebase project is the
proposed current community boundary. Do not admit a second community into the same
collections with these rules. Before that, add server-controlled membership and
immutable community linkage to existing profiles/records, then compare it on all
reads/writes. No fictional collection or community field was assumed in the rules.

## Rollout (requires separate approval)

Resolve client/link/token prerequisites, audit legacy roles and object ownership,
then run a small Storage emulator matrix for unauthenticated/pending/resident/
Admin/VIP/Crew, owner vs other resident, Done tickets, wrong types, size limits,
overwrite/delete and legacy links. Validate Firestore cross-service IAM permission
when enabling the rules. Snapshot existing live rules before deploying. Only then
wire storage.rules into firebase.json and approve a scoped Storage deployment.
No emulator suite or build was run in this proposal phase; syntax/behavior still
needs that focused validation before deployment. No live documents, metadata,
objects, rules, IAM, or tokens were changed.

References:
- https://firebase.google.com/docs/storage/security/rules-conditions
- https://firebase.google.com/docs/reference/security/storage
- https://firebase.google.com/docs/storage/web/download-files
