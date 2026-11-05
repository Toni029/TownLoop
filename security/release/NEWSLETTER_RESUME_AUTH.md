# Newsletter connection and retained-PDF authorization correction

Verified November 4, 2026, using read-only release/cloud metadata:

- Installed replacement APK `e0371301-400a-44ac-848f-a01df22ccb8f`
  (commit `844622e`) embeds
  `https://us-central1-cc-livingcommunity-app.cloudfunctions.net/newsletterApi`.
  Published OTA `01a1a73b-7f20-717f-95da-c20854e12ac4` embeds the same URL.
  Neither compiled bundle contains the `us-centrall` hostname; Preview has no
  `EXPO_PUBLIC_TOWNLOOP_API_URL` override. The reported error is DNS resolution,
  not a verified spelling error in either release. Its device/network cause
  cannot be established from workstation checks.
- Live `newsletterapi-00005-ves` is ACTIVE with background jobs enabled and
  Secret Manager version 1 bound. Both the canonical Functions route and its
  actual Cloud Run route return health 200 and unauthenticated capabilities
  401. Credentials remain server-side. No authenticated resident was impersonated.
- The phone's confirmed account has canonical role `admin`, approval true,
  Auth enabled, no deletion-pending flag and no access-revocation record.
  No role/permission change is needed or was performed.

The native URL resolver now accepts only the two verified service URLs, avoiding
mistyped/untrusted environment overrides. Capabilities and idempotent job
reference requests can try the verified Cloud Run route after a transport
failure. HTTP authorization/model errors do not trigger failover. Existing
request deadlines, cancellation and bounded job retries remain. Tokens are not
replayed after account changes. No PDF bytes or publishing operations use this
retry path.

Resume still attempted `showMissing=true`, an IAM/server-only metadata
operation. A Firebase Admin/VIP profile does not confer IAM credentials. The
previous fallback depended on one exact 403 message and could falsely blame an
otherwise authorized account. Recovery now lists ordinary persisted manifests
directly, without that metadata operation or error-text-dependent fallback.
It refreshes Firebase identity, reads the current profile from the server and
binds subsequent metadata requests to that verified UID. Genuine denials remain
denials. Legacy parentless uploads still require secure server-side discovery;
no manifests are invented and no rules are weakened.

The retained November PDF still has 81/81 chunk metadata records, unique valid
indices, hashes and consistent totals. Prior full-byte verification established
39,435,477 original PDF bytes. Existing integrity checks still run before AI;
this change does not reupload, edit, publish or delete the PDF. The current
published edition is unchanged.

Verification: 26 focused client checks, native TypeScript, and real resume/REST
fixtures against a local emulator loaded with the current live default rules
(Admin and VIP allowed; pending account denied). No live fixture accounts,
Firebase writes or physical-phone verification. Native fingerprint remains
`50289301168f9e397d3b3d48a4ec4d14d1bf6f45`, matching the installed replacement
APK. Release requires a compatible Preview OTA only; no backend deployment or
new native build. Nothing pushed, published or deployed for this correction.
