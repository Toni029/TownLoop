# Read-only Preview release — prepared, not released

The separate `previewDatabaseCleanup` callable has only the `preview` action.
It neither imports the purge engine nor writes jobs/controls/audit records. It
has no scheduler or destructive export. It counts default-database selected
roots and nested documents, excludes manual News, inventories bucket file
metadata/retained generations, and warns about protection/ownership markers.
All files remain held: a nontransactional read-only preview does not certify
exclusive ownership. Bounded inventories fail visibly rather than show partial
counts as complete. Published content and PDF bytes are never changed/read back.

The dedicated runtime identity `townloop-cleanup-preview@cc-livingcommunity-app.iam.gserviceaccount.com`
was provisioned with only custom role `projects/cc-livingcommunity-app/roles/townloopCleanupPreviewReader`:
`datastore.databases.get`, `datastore.entities.get`, `datastore.entities.list`,
`firebaseauth.users.get`, `storage.buckets.get`, `storage.objects.get`,
`storage.objects.list`. No write/delete permissions or other direct project
bindings were granted. No resident data was changed. A production preflight
must still check inherited/folder/organization and bucket-specific grants if
this identity is reused outside the narrowly scoped read-only endpoint.

Native client release mode routes to the separate preview callable. Server
responses are `readOnly:true`, `enabled:false`, lack a confirmation plan hash,
and cannot be confirmed. Refresh and file paging rerun read-only inventory;
there is no stored job. Counts are live observations, not a transactional
snapshot. All four checkboxes begin unchecked. The original committed purge
implementation is preserved for a separate coordinated activation.

Release stopped 2026-11-06. Latest finished Preview APK:
`e0371301-400a-44ac-848f-a01df22ccb8f`, runtime fingerprint
`50289301168f9e397d3b3d48a4ec4d14d1bf6f45`.
Current source fingerprint from EAS Preview environment:
`c6594bbe15c1df2f9b7a31a8a9937ecfddae62ab`.
The compatibility guard rejected release; no runtime was overridden and no
OTA/build was started. The scoped function deployment stopped during local
source discovery (local package dependencies unavailable) before function
creation. No rules, account-deletion worker or policy receipt was changed.

Verification: five focused backend tests (approved Admin only; all job actions
rejected; exact nested counts; manual News exclusion; no mutation/scheduler
APIs), 26 native cleanup tests, native TypeScript and focused lint passed.
No production callable or physical-device verification is claimed.
