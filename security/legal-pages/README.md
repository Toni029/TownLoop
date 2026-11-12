# Public legal pages — local preparation, November 12, 2026

## Scope and design

Three standalone documents use the approved Child Safety Standards theme through
`public/legal.css`: cream background `#f7f3ea`, green `#047857`, pale green `#eaf2e8`,
amber accents, system typography, responsive 860px reading column, rounded panels,
accessible section links, green contact buttons and a shared policy footer.
No app, authentication, database, Storage, rules, backend or consent-version code
was changed. No live deployment, data read/write or account operation was performed.

All public legal HTML sources were searched. No previous community/company name or
personal operator name appears in their content, metadata, titles or footers.
TownLoop is the app, Seeds4Clix is the supplied developer/operator identity, and
support@seeds4clix.com is the public contact. The Child Safety page names the
Seeds4Clix Safety Team; its existing standards/report instructions are preserved.
No legal entity, address, jurisdiction or property-management affiliation is invented.

## November 12 owner follow-up

See `TERMS_REVIEW.md`, `gemini-readonly-verification.json` and `retirement/README.md`.
The owner confirmed support mailbox and manual safety escalation maintenance.
Publication uses the actual publication day in America/New_York (November 12 only
if published that day). Final wording/deployment remain unapproved. Live key-project
lookup and Cloud Billing show the deployed Gemini key project has billing disabled.
The Privacy draft now specifically discloses unpaid-service data use; provider
personal-data restrictions require an operational decision, not just a disclosure.
No billable service or backend change was activated.

## Wording evidence and decisions

Preserves the existing live Privacy Policy's account/content/diagnostics, purposes,
Firebase, AI, no-sale/rental/trade, retention and contact coverage, expanding it with
actual native feature-specific handling. Replaces the old under-13-only wording
with the owner's adults-18+ scope without implying technical age verification.

| Disclosure | Inspected source/evidence |
| --- | --- |
| Local medication/checklist data; account-scoped, sign-out preservation, older storage fallback | `native/src/home/store.ts`, `hooks.ts`, `model.ts`, `native/src/localData/nativeStorage.ts`, `chunkedStorage.ts` |
| Profile fields and permission-based visibility | `native/src/profile/model.ts`, `data.ts`, existing verified default rules baseline |
| Push tokens, installation IDs, permission/category/unread state | `native/src/notifications/device.ts`, `protocol.ts` |
| Gemini PDF analysis and Google translation | `server.ts`, `server/translation.ts`, `functions/translation.cjs`, `native/src/workorders/translator.ts` |
| Community-coordinate weather, not device GPS | `native/src/home/weatherModel.ts`, `Weather.tsx` |
| Messaging history isolation, receipts, retained threads | existing Inbox membership/receipt implementation; `functions/inbox-retention-entry.cjs` is separately gated, not promised active |
| Deletion targets, receipts, evidence/ownership exceptions, recovery caveats | `security/release/account-deletion-policy.APPROVED-LOCAL.json`, `security/account-deletion/automatic-processing.md`, `security/native-only-firestore/worker-compatibility-deployment-receipt.json` |
| Existing private bearer-link limitation | existing `SECURITY_GAPS_2026_11_11.md` and private-media follow-up; no token changes under this task |

No absolute encryption, immediate erasure, exact provider retention/training,
round-the-clock moderation, guaranteed uptime or automated suspension is promised.
The policy does not claim local reminders are synced to Firebase or sent to Gemini.
If health information is deliberately included in online content, that distinction
is explicit. No native crash SDK is claimed active.

Before publication the owner must approve:

- Effective date, final wording and Seeds4Clix operator designation. No extra entity
  or address is assumed. Confirm mailbox monitoring for privacy, deletion and safety.
- Proposed limited content-operation permission, moderation/restriction/contact
  procedure and qualified warranty/liability wording. No arbitration, monetary cap
  or governing law was invented. Obtain jurisdiction-specific legal review if needed.
- Current deletion processing/exception handling and recovery configuration; the
  draft preserves existing 3-business-day / 7-calendar-day targets and original
  60-day receipt window without inventing guarantees or activating processing.
- Actual Google Gemini paid/unpaid service tier, provider contract/region/data-use
  settings and matching Play Data Safety disclosures. Provider terms differ by tier;
  this task did not inspect secret contents, contracts or billing to infer them.
- The previously identified manual child-safety account restriction, evidence/media
  containment and authority-reporting procedure. No new implementation is claimed.

Publishing revised terms is not re-consent. The native accepted terms version is
unchanged (`2026-10-draft1`); any later acceptance-version rollout is separate scope.

## Live Hosting inspection — read only

Site `townloop`, current release version `sites/townloop/versions/d7e22df49f9e4bbf`,
23 manifest entries. Current catch-all is `** → /index.html`.

- `/privacy.html` returns a dedicated existing policy.
- `/terms.html`, `/child-safety.html` and `/delete-account.html` return HTTP 200
  **with the retired app root**, not their requested documents. This is an internal
  SPA fallback, not an HTTP redirect. HTTP 200 alone is insufficient verification.
- Additional unwanted branding remains in `/assets/index-C_3tBUcg.js` and
  `/cecil-pines-logo.svg`; personal attribution remains in the old index shell,
  old main bundle and service worker. These are not imported by the new legal pages.
- Firebase reserved `/__/firebase/*` resources and `/.well-known/assetlinks.json`
  were inventoried; do not remove or alter OAuth/app-link associations.

The existing live assets were not modified. Fully removing old branding from the
entire public site requires separately approving retirement/replacement of those
legacy assets and handling previously cached service workers. Do not rebuild or
re-publish the retired website. This is an identified remaining Hosting scope,
not a claim that public branding has already been erased everywhere.

## Local route preparation and safe deployment plan

`node security/legal-pages/prepare.cjs` creates an ignored, review-only package in
`.release/legal-review`: three pages, `legal.css`, the unchanged previously prepared
`delete-account.html` supporting link, an emulator-only Hosting config and a scope
manifest. No SPA rewrite or redirects are present in the local review config.
The unchanged account-deletion page's verification/form logic remains untouched;
it is an additional existing draft requiring owner approval before publication.

**Do not deploy this partial directory as a full Hosting release.** After explicit
approval, snapshot/recheck the current live version/config/file hashes, preserve all
existing required files/headers/OAuth/app-link associations, overlay the reviewed
HTML/CSS paths and deploy Hosting only. Existing static-file precedence serves
`/privacy.html`, `/terms.html` and `/child-safety.html` before the old catch-all;
no change to native routing, Firebase backend configuration or default rules is needed.
The shared CSS must be included atomically. Ensure the supporting deletion page is
also present rather than leaving a broken footer destination. Remove draft notices
and set only the owner-approved effective date at publication staging; never publish
review notes as an effective policy. Prior single-page/legal staging helpers were
updated to include their new shared dependencies.

Use appropriate revalidation/no-store headers during the approved Hosting release
and check cached-browser behavior; avoid changing unrelated caching policies.
Preserve the prior Hosting version for rollback; no database rollback applies.
Post-deployment: anonymous exact URL, correct title/heading/contact, CSS MIME/body,
no app root or redirect, shared footer and mail links, and unchanged OAuth/app links.
Public production verification is pending because nothing has been deployed.

## Verification

14 focused page/staging and existing external-deletion-form checks pass. Real Firebase
Hosting emulator direct requests return 200 without redirect or retired app root for
all three HTML pages, their shared CSS and the supporting deletion page. A second
bounded Hosting emulator run preserved the actual catch-all plus a retired-app
sentinel and confirmed that these static paths still take precedence. Browser
responsive checks/screenshots and actual footer navigation are recorded separately
in `verification.json`; no physical Android/iPhone verification is claimed.

Sources checked November 12, 2026:
- https://support.google.com/googleplay/android-developer/answer/10144311?hl=en
- https://firebase.google.com/support/privacy
- https://ai.google.dev/gemini-api/terms

No legal certification or guarantee of Google Play acceptance is claimed.
