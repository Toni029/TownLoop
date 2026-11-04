# Durable newsletter analysis — prepared locally, NOT deployed

## Verified failure

Live revision `newsletterapi-00003-xut` served the November 3, 2026, 9:06 PM
America/New_York request in 145.6 seconds. Its configured timeout is 360 seconds.
Retained-PDF reconstruction passed. Files API returned 404, then the existing
visual fallback rendered twelve pages. The first and last models failed with
HTTP 503; the middle model completed one group but failed response parsing for
another. The old request-local progress map was lost when the request failed.
This is not an upload failure, PDF size limit or Firebase execution timeout.
The logs did not retain the response body. A subsequent real reproduction
identified the exact defect: `gemini-3-flash-preview` returned `MAX_TOKENS`,
using 7,861 thinking tokens and only 312–316 emitted JSON tokens under the
8,192-token shared limit. It repeatedly returned truncated JSON. Concurrent
503 responses explicitly said the models were experiencing high demand.

The actual document is 39,435,477 bytes (37.6 MiB), 81 verified chunks and 12
pages. Configured model catalog checks succeeded. Successful real requests used
roughly 6,000–7,200 input tokens per group, well below the models' 1,048,576-token
input limit. No 429/quota exhaustion was observed; this is not a guarantee of
future available quota. The PDF is below the documented 50 MB / 1,000-page limit.

## Real validation, beyond mocked tests

Using the **existing retained PDF** and existing Secret Manager key in memory:

1. An initial real Gemini analysis of all twelve pages returned 2 RSVP events
   and 7 highlights, November 2026, using `gemini-3.1-flash-lite`. The final
   corrected-budget run used `gemini-3-flash-preview` successfully and returned
   **3 RSVP events and 7 highlights**, with `STOP` for all three page groups.
2. The new worker/checkpoint flow was exercised with the same real Gemini SDK
   and PDF, while job records went exclusively to a disposable local Firestore
   emulator. An intentional interruption after saving progress left 2/3 groups
   durable. The second attempt read those checkpoints and analyzed only the last
   group after recreating the worker module. Exactly three successful provider
   input hashes were observed; none was repeated. The preview fallback returned
   complete JSON with `STOP`, `LOW` thinking and the corrected 16,384-token limit.
3. Source pages were visually checked: page 1 supports the November 14 car show,
   10 AM–2 PM, and the office ticket instructions beginning November 2; page 11
   supports the December 4 holiday dinner, 5 PM, with the November 30 RSVP
   deadline. Page 9 confirms Coffee with Comrades on November 2 at 10:30 AM,
   explicitly marked RSVP for Veterans & Spouses Only; that restriction was
   preserved in its description. Event dates and RSVP deadlines remain separate.

Original bytes were not modified. No phone reupload, production data write,
newsletter publication, fake live account or live Cloud Tasks dispatch occurred.
Private result files and source-page verification images are ignored, mode 600,
under `.release/newsletter-final-diagnosis`; they are not committed. Cloud Tasks
IAM/delivery and the installed phone remain to be verified after approved rollout.

## Implementation

- Authenticated `POST /api/newsletter/native/analysis-jobs` returns a reference
  quickly; `GET /analysis-jobs/:id` returns progress/results only to its owner,
  after existing approved Admin/VIP verification. Native requests have short,
  individually bounded deadlines and carry references only. Closing a reader
  stops local polling, not the server task. Reopening reconnects to the same job.
- A stable chunk-metadata revision binds jobs to the exact retained PDF version;
  changed chunks cannot return stale cached success. Incompatible instructions
  invalidate checkpoints on explicit retry without requiring another upload.
- Server-owned `(default)` collection `newsletter_analysis_jobs` holds bounded
  parsed checkpoints and output, never PDF bytes, Gemini keys or Firebase tokens.
  Existing default-deny rules already prevent direct client reads/writes. Job IDs
  bind owner and inputs. Cloud Tasks IDs, generation numbers and transaction
  leases prevent duplicate or stale workers overwriting current work.
- Worker rechecks Auth account status, canonical manager profile, revocation and
  PDF-discard fences. It loads the exact verified PDF with workload identity,
  retaining all integrity checks. Checkpoints bind PDF content, extraction prompt,
  schema and group count; mismatched input is rejected, not silently reused.
- Existing extraction prompts, strict RSVP rules and return structures are kept.
  Set supported `LOW` thinking and a 16,384-token shared output allowance so
  default high reasoning cannot starve the structured JSON response. This fixes
  the confirmed truncation, without dropping event/story fields. See Google's
  [thinking guidance](https://ai.google.dev/gemini-api/docs/generate-content/thinking).
  Visual groups contain at most four new pages, with the existing cover context.
  At most two groups run concurrently. Successful groups are saved before moving
  on and reused across models, process restarts and explicit retries. Date/time
  normalization avoids duplicate events from repeated cover context without
  discarding distinct dates/years/times. Existing seven-highlight limit remains.
- A single JSON code fence can be removed before strict JSON parsing. Truncated
  responses are rejected; no guessed or repaired content is published.
- Two transient attempts per model/group remain inside the 230-second extraction
  budget. Cloud Tasks backs off 60–300 seconds, with at most five processing
  attempts per user-requested run. Eight transport dispatches allow infrastructure
  retries without allowing infinite processing. Failed runs can be explicitly
  retried using saved groups; no upload is repeated.
- Progress, quota, timeout, unreadable-response, authorization and checkpoint-save
  failures are distinct. Logs contain identifiers, counts and categories, not
  provider response bodies, PDF text or private credentials.
- Jobs have a 24-hour `expiresAt` lifetime. Their document contains all checkpoints
  (no orphan subcollections). Prepared PDF discard also removes associated job
  documents and fences prevent subsequent recreation. PDF purging remains
  separately disabled; deploying analysis must not activate that cleanup.
- Existing `/extract-content` stays available for older clients. New clients
  require `analysisJobsVersion:1` and therefore fail safely before starting a new
  upload if the background backend is not ready. No automatic publishing occurs.

## Exact release dependencies — owner approval required

1. Create dedicated worker identity
   `townloop-newsletter-analysis@cc-livingcommunity-app.iam.gserviceaccount.com`.
   Give it default-database Firestore data access, `firebaseauth.users.get`, and
   Secret Accessor on the **existing** Gemini secret only. No new key or private
   service-account key file. Do not grant Editor/Owner. Keep named DB excluded
   with database IAM conditions/scoping where available; code also fixes `(default)`.
2. Existing API identity needs default-database job data access and Cloud Tasks
   enqueue access for this one queue. Its OIDC identity needs invoker permission
   on this worker (including gen-2 Run invoker), and the narrowly required
   service-account actAs/token-generation setup. Verify Cloud Tasks service-agent
   configuration, not just function HTTP reachability. Worker is IAM-protected,
   never public; clients cannot dispatch tasks.
3. Configure a default-database TTL policy for collection group
   `newsletter_analysis_jobs`, field `expiresAt`, to enforce bounded temporary
   result retention. No composite index is required. Verify direct client denial
   against current live rules; no weakening or general rules rollout is needed.
4. Package with `node security/newsletter-api/prepare.cjs`. Deploy only the
   isolated `newsletter-api` codebase: `newsletterApi` and `runNewsletterAnalysis`.
   Both default to jobs disabled. No root function codebase, schedule, Hosting,
   named database, Storage rule, notifications or account-deletion export.
5. After IAM/queue/TTL checks, explicitly set
   `TOWNLOOP_NEWSLETTER_ANALYSIS_JOBS_ENABLED=true` on both functions. Verify
   capabilities advertise version 1 and a signed-in Admin/VIP can queue/retrieve
   only their own job. Test Cloud Tasks delivery and restart/resume before wide use.
6. Release the compatible JavaScript client subset to Android Preview; iOS uses
   the same protocol. No new native dependency is introduced. Do not force the
   old installed runtime or include unrelated Google native configuration or the
   separately prepared draft-cleanup UI from earlier commits in this analysis OTA. Keep API v1 compatibility for old clients.
7. Retry the retained November PDF in the installed app. Confirm the two event
   dates/deadlines and seven stories in review. **Only the owner may explicitly
   finish publishing.** Local success is not a claim of installed-app verification.

No deployment, IAM/TTL mutation, push, OTA or native build was performed here.
