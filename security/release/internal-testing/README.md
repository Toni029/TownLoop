> Android identity update: the next builds target `com.townloop.app`. The old Android package and registrations mentioned below describe historical Preview builds. iOS remains `com.toni029.townloop`. See [Android identity preparation](../../../native/ANDROID_IDENTITY_CHANGE.md).

# First Google Play Internal Testing preparation — 2026-11-05

Baseline `1261793`; reuse `../play-launch/` and `../blocker-prerequisites/` rather
than repeating their audits. Nothing was deployed, pushed, built or activated.
No resident data, deletion receipt, SDK dependency or working native UI changed.

## Standalone legal pages: prepared, not approved or published

Updated `public/privacy.html`, `terms.html` and `delete-account.html` preserve the
exact URLs linked by the native app. They use responsive cream/green styling and
contain no SPA root, app bundle or service-worker registration. Privacy/Terms now
describe the native app, configured Google sign-in, four notification categories,
Gemini/translation, device reminders and actual deletion/recovery limits. Obsolete
web medication implementation and “worker not deployed” claims were removed.

The deletion page retains the existing request-only callable and recent verified
Firebase authentication. It uses a separate in-memory browser session, one
case-insensitive DELETE confirmation, duplicate-submit protection, safe errors,
status lookup and session clearing. It never imports Firestore/Storage or a worker.
An email fallback gives usable outside-the-app instructions without collecting a
password by email. Neither success wording nor retention status claims that
permanent deletion has occurred. No live request was submitted as a test.

**Owner approval required before publication:**

- Seeds4Clix's exact legal/operator identification and any required address or
  jurisdiction; no missing legal details were invented.
- Confirm `support@seeds4Clix.com` is monitored for privacy, deletion and moderation,
  and approve who verifies and handles email requests. Email alone is not deletion
  authorization. Approve the actual moderation/appeal route and staffing.
- Approve effective date, final Privacy/Terms text and any missing contractual or
  jurisdiction-specific provisions. Native acceptance remains `2026-10-draft1`;
  this update does not silently re-consent users or change that version.
- Confirm Google/Gemini/translation processing contracts, locations, training and
  retention settings, data-sharing classifications, technical logs and accurate
  disclosures for all distributed versions. No zero-retention/no-sharing claim.
- Confirm deletion-processing status at publication: worker deployed, receipt
  currently held. Preserve original policy targets and disclosed evidence/shared
  content/recovery exceptions; acknowledgment is separately authorized work.

### Hosting publication plan — separate approval required

`node security/release/internal-testing/prepare-legal-pages.cjs` stages only three
HTML files under ignored `.release/legal-pages` and prints source hashes. It has
no network/deploy capability and includes no index, service worker or old web assets.
**Do not deploy that directory as an entire Hosting site:** doing so can omit
unrelated existing files. Root `firebase.json` is intentionally unchanged.

For a later approved publication to site `townloop`:

1. Snapshot the current live version ID, file manifest, redirects/rewrites/headers,
   association files and relevant domain/Auth configuration. Resolve any redirect
   affecting the three paths before release; stop if scope would expand.
2. Prepare a new version from the current Hosting contents/configuration, overlaying
   only the three approved HTML paths. The Hosting REST clone operation with
   `finalize:false` is the starting point; independently preserve/compare version
   configuration, not just files. Do not use a blanket Firebase deployment or Vite
   build, remove Hosting, rewrite Auth domains or alter `/.well-known/`/`/__/` routes.
3. Check CSP permits the existing Firebase modules/request flow without weakening
   global headers. If not, request a separate reviewed change or use the staffed
   email method; do not silently loosen CSP. Recheck association file hashes and
   reserved Auth helpers. Require exact-path content/title checks, not HTTP200 alone.
4. Test fresh/incognito and an existing browser profile; an old website service
   worker/cache may affect navigation. Do not unregister/modify it as part of this
   local preparation. Test hosted Google popup and request/status flow only with
   separate approval and an authorized fixture; never trigger a resident deletion.
5. Keep the prior Hosting version as rollback evidence. If a release must be halted,
   roll back Hosting only, without changing Firebase rules, workers or resident data.

[Clone API](https://firebase.google.com/docs/reference/hosting/rest/v1beta1/sites.versions/clone),
[Hosting response precedence](https://firebase.google.com/docs/hosting/full-config#hosting_priority_order).

## Recovery: smallest practical implementation, no activation

Reuse the existing guarded helper/plan: **PITR seven days; daily backups retained
seven days; weekly Sunday backups retained 28 days**, for both `(default)` (`nam5`)
and the retained named database (`us-east1`). Keeping the inexpensive weekly copy
adds a longer recovery point beyond the overlapping daily/PITR window. No new
export service, scheduler function, IAM grant or library is needed. Activation and
optional database-resource deletion protection still require separate approval.

Read-only size metrics total approximately **0.187 GiB** (200,619,394 bytes default,
3,519 named). Current monthly rates: PITR $0.18/GiB in `nam5`, $0.15 in `us-east1`;
backup storage $0.03/GiB in both. Seven daily plus roughly four weekly copies yields
about **$0.0953/month additional storage** at constant current size, rounded to
**$0.10/month**. This is an estimate, not a spending cap or invoice. Growth, restores,
other services and tax are excluded. No free quota is assumed for recovery.
`recovery-costs.json` records the observed sizes, rates and assumptions.
[Pricing](https://cloud.google.com/firestore/pricing).

**Coverage:** Firestore backups include documents and indexes: profiles,
conversations/membership, posts/listings, Work Orders, newsletter records/chunks,
notification state, approval and deletion receipts in their actual database.
They do not back up Auth identities, Storage media bytes, secrets, signing keys,
security rules or TTL policies. Retain the existing Storage seven-day soft-delete
recovery; independently approve any longer media/Auth recovery strategy. Keep keys
in controlled encrypted custody, never Git. No claim of complete Firebase backup.

**Safe verification/restore drill:** after a separately approved enablement, list
successful backups and check source database, location, state and retention. Check
PITR earliest-version time as history fills. Restore one approved backup into a
new isolated database, never overwrite either live database or point clients at
the restored copy. Apply deny-all client access and controlled operator IAM before
inspection, and verify no existing trigger/worker targets the temporary name.
Check aggregate counts/indexes and approved synthetic fixtures, not private content.
Reconcile current deletion/access-fence receipts before any possible cutover; never
recreate erased identities or infer ownership. Restore TTL/rules separately. If
reconciliation evidence is incomplete, block cutover. Bound the temporary copy's
lifetime and request separate cleanup approval. No restore was attempted here.
[Backup contents and restore](https://firebase.google.com/docs/firestore/backups).

## Crash reporting

Recommend **Sentry** using the existing inactive proposal, not both Sentry and
Crashlytics. It fits Expo/React Native while preserving the Firebase JS SDK.
A native crash-reporting SDK needs a **new binary**; nothing was installed.
Approve provider project/region, access/retention, payload/consent/privacy and budget
before integration. Keep symbol-upload credentials build-only and verify native
and JS scrubbing separately. Start without replay, screenshots, tracing or resident
identity/content. The existing Cloud Monitoring proposal covers essential backend
health/failures without adding an SDK; it also remains inactive.
[Expo integration](https://docs.expo.dev/guides/using-sentry/).

## Signed Android candidate

| Item | Local preparation / remaining gate |
| --- | --- |
| Package and project | `com.toni029.townloop`, existing EAS/Firebase projects unchanged. |
| Signing | Existing local keystore preserved; integrity/password, valid certificate and matching Preview certificate rechecked without exposing keys. No key generated/uploaded/signing operation. |
| Production Firebase | **New build-time guard rejects a missing explicit `GOOGLE_SERVICES_JSON`** rather than silently using the ignored Preview fallback. A validated explicit file resolves correctly. Link the existing verified client file into EAS Production after approval. Preview/iOS fallback behavior is unchanged. |
| Play/OAuth | Enroll/verify Play App Signing; download its public **app-signing** certificate and register SHA-1/SHA-256 with the existing Firebase/Google Android app. Preserve the upload/Preview certificate too. Refresh the production client file as needed. Play-installed Google login needs that certificate; upload-key matching alone is insufficient. |
| Version | App version `0.1.0`, remote-code/auto-increment workflow preserved. Previous read-only remote code was 2; verify again immediately before build and choose the approved display version. No counter increment/reset now. |
| SDK/artifact | Source catalog targets/compiles API36, min API24. Final merged manifest, permissions, 16-KB support and actual signing remain unbuilt-artifact gates. |
| Endpoint | Explicit Production HTTPS origin is `https://us-central1-cc-livingcommunity-app.cloudfunctions.net/newsletterApi`; no API secret is bundled. |
| Build isolation | Store AAB, Production channel/environment, no development client, local existing key and fingerprint runtime validated. Production shares the existing live backend; it is not a sandbox. Never seed real resident data for testing. |
| Approved fixes | Source ancestry includes the keyboard, decoder and `1261793` preparation commits. No native UI, startup, uploader, Gemini or messaging code changed. Actual inclusion/behavior in an AAB must be verified after its separately approved build. |

First release does not require generating a Play submission service-account key:
manual AAB upload in Console is sufficient. Existing submit-once/open-browser
helper remains unchanged; no build was submitted. Do not uninstall the current
Preview app to address a Play signing mismatch without explaining local-data loss.

## Owner's Play Console checklist

**Internal testing:** verify developer identity/account and app record, choose
Google Play App Signing, confirm the immutable package, approved version and upload
key, add tester emails/Google Group and opt-in link, and upload one approved signed
AAB. Supply access instructions and a separately approved nonresident reviewer/test
account that passes community approval without bypassing role restrictions. Do not
send its password in chat or add it to Git. Use the existing Android acceptance
checklist and actual Play-installed artifact. Internal-only apps are exempt from
the Data Safety form; follow any Console-required setup fields and privacy/security
requirements. Internal testing does not require the 12-person/14-day closed test.

**Prepare for closed/public release:** app title, short/full description, category,
countries/audience, content rating, ads declaration, support/operator details,
512×512 store icon, 1024×500 feature graphic and at least two accurate phone
screenshots without resident data. Approve the final Privacy/Terms/deletion pages,
staffed request/moderation process and Data Safety answers covering Firebase/Expo,
messages/media/UGC, device tokens, Google AI/translation and actual diagnostics.
Complete the Health declaration for medication/treatment management; local-only
reminders do not remove that feature declaration. Agree final policy version and
re-consent handling separately. Complete the account-deletion operational gate
before claiming automatic fulfillment is active.

For personal developer accounts created after November 13, 2023, production access
requires at least 12 continuously opted-in closed testers for 14 days and approval
of the production-access application. Confirm this account's actual type/date and
Console requirements. Preview sideloads and internal tests do not count toward it.
[Internal testing](https://support.google.com/googleplay/android-developer/answer/9845334?hl=en),
[closed-testing requirement](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en),
[Data Safety](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en),
[Health](https://support.google.com/googleplay/android-developer/answer/14738291?hl=en).

## Before the first Internal Testing AAB upload

1. Approve and separately publish only the final legal-page overlay; confirm the
   external request route with authorized fixtures and no resident processing.
2. Supply/link Production Firebase client file; approve display version and Play
   developer/App Signing/tester/reviewer setup. No secret is requested in chat.
3. Approve one AAB build, inspect the final artifact and Play certificate/OAuth
   behavior, then approve/upload to Internal Testing and perform the device checklist.
4. Keep recovery, Sentry/monitoring and deletion receipt activation separately gated;
   internal testing is not authorization to turn them on. They remain explicit
   operational decisions before public launch.

Focused verification: six offline legal/form/staging checks, four Android
configuration/production guard checks and five existing recovery-helper checks
pass. Production profile resolves with an explicit validated client file and no
development client; missing-file rejection was observed failing before the guard
and passing after. Browser/mobile layout and live request submission are not yet
device-tested. No live approval/deletion/request writes were used for verification.
