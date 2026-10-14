# Newsletter AI integration — 2026-10-14

The native News screen now connects to the original authenticated
POST /api/newsletter/extract-content service. On localhost web it uses port 3000;
on devices/deployed builds configure EXPO_PUBLIC_TOWNLOOP_API_URL to an HTTPS
service URL. Only a Firebase ID token and the PDF are sent; Gemini credentials
remain on the server. The backend needs GEMINI_API_KEY and, for deployed browser
clients, a comma-separated TOWNLOOP_ALLOWED_ORIGINS allowlist.

New uploads stage PDF chunks without replacing the current edition. AI is checked
by default. Upload & Publish runs analysis on the selected PDF, then pauses in
the same panel for review. Event/story pencil and trash controls edit or remove
drafts. Upload & Publish then commits the PDF pointer and reviewed items in one
transaction. Unchecking AI publishes PDF-only. Existing editions still use
Re-analyze with AI. Progress tracks Uploading, AI analysis, Polishing touches,
and Done; it pauses for review and never signals success after an AI failure. The server
tries gemini-3.8-flash first, with its existing gemini-3.1-flash-lite fallback;
the actual model is shown in the review.

Extraction now requires explicit RSVP evidence and isRecurring=false. Routine
recurring events are excluded even when they request RSVP. Highlights cover
important community stories/notices. Unknown event dates are rejected before
publishing; administrators can still add items manually.

Items have stable edition-scoped IDs. Saving does not overwrite an existing
item, so repeated analysis cannot erase RSVP rosters or manager edits. Existing
manual items remain. Existing edition filtering hides prior-edition AI items.
Unselected previously saved items are not deleted by this review.

Validation: 10 backend/client integration tests (mock Gemini responses), 2 native
analysis model tests, TypeScript and focused lint; local endpoint returns 401
without authentication and 204 for allowed Expo preflight. No live Gemini
extraction was performed: GEMINI_API_KEY is absent on this computer. No live
newsletter or event data was changed during tests. User browser inspection is
still blocked by the saved browser permission restriction.

## Fallback recovery verification

Updated model chain: gemini-3.8-flash → gemini-3-flash-preview →
gemini-3.1-flash-lite. One attempt per model, actual HTTP abort/timeout at 40s,
short cooldowns for overload/timeouts, no fallback on invalid credentials.
Malformed response shapes trigger fallback rather than appearing as zero items.

Live synthetic-PDF test passed on gemini-3.1-flash-lite after earlier models
returned 503: two special events with reserve/sign-up language were extracted,
weekly bingo was excluded, and the library renovation story was highlighted.
Twelve regression tests passed. The server was restarted with the new chain.
This does not establish accuracy for the resident's actual newsletter: that PDF
is still needed for a document-specific audit. No production data was changed.

## Large-document recovery

Server logs showed repeated failures on the resident's roughly 16 MB October PDF.
Large PDFs (>8 MB) now try a single Gemini Files upload, reused across model
attempts and deleted in finally. This environment returned 404 from the Files
service, so a server-only PDF.js fallback extracts page-labelled text. It refuses
pages with fewer than 40 readable characters, rather than silently treating a
scan as empty. Text fallback cannot interpret illustrations or image-only text.

Large analysis tries gemini-3.1-flash-lite first, uses up to 60s/model, and the
native request budget is 300s including file processing. Small PDFs retain the
existing model order and 40s/model. The AI stage displays a spinner/status instead
of a misleading fixed percentage.

Live 16 MB synthetic PDF (known text plus padding, not a complexity-equivalent
newsletter) passed via text fallback: two RSVP events and one highlight, with
weekly bingo excluded. Fourteen regression tests passed. Actual October PDF
accuracy remains unverified; do not equate the synthetic transport test with a
full real-document acceptance test.
