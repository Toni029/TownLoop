# Newsletter AI integration — 2026-10-14

The native News screen now connects to the original authenticated
POST /api/newsletter/extract-content service. On localhost web it uses port 3000;
on devices/deployed builds configure EXPO_PUBLIC_TOWNLOOP_API_URL to an HTTPS
service URL. Only a Firebase ID token and the PDF are sent; Gemini credentials
remain on the server. The backend needs GEMINI_API_KEY and, for deployed browser
clients, a comma-separated TOWNLOOP_ALLOWED_ORIGINS allowlist.

New uploads lead to the analysis review dialog after PDF publication. Existing
editions use Re-analyze with AI. The manager explicitly starts Gemini analysis,
reviews/selects results, then publishes selected events/highlights. The server
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
