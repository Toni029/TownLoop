# Crew response translation composer

November 12, 2026. Local implementation only; no push, deployment, OTA or binary build.

The medium Languages/Translate action is immediately right of the existing Crew
Resolution Note / Description label, above its unchanged editable note box. It
appears only in the authorized Crew response workflow. Resident controls, Admin/VIP
oversight and the existing full-ticket Spanish translation button are preserved.

`TranslationComposer` is a large native modal with safe areas, keyboard avoidance,
focus-aware scrolling, Spanish/English source and target choices, swap, large source
and reviewable output boxes, explicit Translate and green USE THIS. Spanish → English
is the default; language choices always maintain a valid opposite pair. Typing and
swapping never call the service. Changed source/direction invalidates stale output.
A synchronous lock prevents duplicate taps; closing/unmounting aborts the client
request and discards late results. There is no sensitive-text logging or local
word-replacement fallback.

USE THIS only populates the original draft. A nonempty draft requires an inline
Replace or Append choice. Append retains the original draft verbatim. Busy parent
operations disable insertion without losing the reviewed output. Nothing submits a
reply or marks an order Done until the existing explicit action is tapped. Photos,
request data, comment/completion security, notifications and schemas are unchanged.

## Existing service verification

The transport is shared with existing `translateWorkOrder`. The new response call
uses an empty title, response in description, no comments and `targetLang: en/es`.
The existing provider detects source automatically. Authentication, approved
Admin/VIP/Crew checks, HTTPS validation, server credentials and response validation
remain. Account checks before/after asynchronous boundaries reject stale sessions.

A focused READ-ONLY deployed-source check confirmed in `cc-livingcommunity-app`,
`us-central1`:

- `translateWorkOrder` is ACTIVE, revision `translateworkorder-00001-foh`.
- Both English and Spanish targets, automatic source detection, and empty-title
  payloads are already supported.
- Crew authorization and the existing server Secret Manager binding are present.
- No provider request, secret value retrieval, deployment or production data write
  was performed.

Therefore this feature needs no backend change/deployment, rules or schema change.
It is JavaScript-only and can use a compatible Production OTA after approval;
no new AAB/dependency is needed for this feature. Separately pending App Check native
work must remain excluded from any installed-runtime OTA, as in previous releases.

## Focused checks

26 checks cover service directions/auth/validation, existing ticket translation,
modal duplicate taps/errors/close/late results, Replace/Append, stale-output reset,
busy parent protection, Crew-only UI, Android/iOS keyboard/safe-area configuration,
real existing Crew completion code against a synthetic transaction, duplicate
submission protection, Resident rejection, and existing Work Order/keyboard rules.
Native TypeScript and new/modified translation modules' lint are checked before
commit. Existing WorkOrdersFeed lint matches HEAD: one effect-state error and two
dependency warnings; no unrelated refactor was made.

These are local/synthetic checks, not physical Android/iPhone testing or an actual
paid provider translation. Actual keyboard motion, presentation and translation
quality (especially maintenance terms, dates and quantities) still need phone review.
