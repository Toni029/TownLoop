# Newsletter resume authorization correction

The recovery list requested `showMissing=true` to discover older PDFs whose
parent document was never created. Firestore rejects this metadata operation
for Firebase user ID tokens with HTTP 403 and `Metadata operations require admin
authentication.` TownLoop's approved Admin/VIP profile does not grant IAM server
authentication. The former generic 403 message incorrectly blamed the account.

The client now classifies only that specific rejection and retries a normal,
bounded, metadata-only document listing with the same Firebase identity and
unchanged rules. Genuine permission denials remain errors. Current complete and
partial uploads have persisted manifests and are discoverable normally. Hash
validation, partial-upload ownership, active-edition exclusion and explicit
publishing are unchanged. No PDF bytes are read to list recoverable drafts.

Parentless legacy uploads cannot be automatically enumerated with a client ID
token. They remain untouched; recovery of those older uploads still requires
authorized server-side discovery. Do not create parent records from guesses or
relax rules. This does not require reuploading the previously verified complete
81-chunk draft, whose parent already exists.

Verification: the local demo Firestore emulator reproduces the original 403 and
then exercises the actual client resume/REST code for Admin, VIP and unapproved
fixtures. Eighteen focused network/recovery tests and native TypeScript pass.
No production records or permissions were changed; no physical-device claim.

This correction is JavaScript-only and requires no Firebase deployment. A
newsletter-only OTA must exclude the preceding native Google configuration
commit `7b0e901` and independently pass the installed-runtime check. Publishing
the entire current branch as the older installed runtime is not safe.
