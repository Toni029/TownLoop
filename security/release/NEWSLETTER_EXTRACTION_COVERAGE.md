# Exhaustive RSVP extraction and meaningful highlights — local only

The old prompt, system instruction and final filter excluded recurring Home
activities even with printed RSVP instructions. Highlights were limited to seven
in both the prompt/schema description and batch merge. A model-only reminder to
check coverage produced no independently verifiable coverage record. Cached
successful jobs could also return the previous seven-story result on reanalysis.

The existing visual PDF renderer now supplies every page to the same bounded
batch/checkpoint pipeline, including PDF images and columns that text-only
fallback could miss. Each page group has a separate, persisted RSVP inventory
call that is not given the extracted event list. It reports actual audited page
numbers, literal RSVP passages and associated event identity. Missing page
checks fail safely; unmatched/ambiguous references and incomplete details are
reported for Admin/VIP review. A model audit is not a mathematical guarantee of
OCR completeness; source review remains required.

All printed RSVP announcements are candidates, including recurring and optional
ones. Non-RSVP explicit attendee registrations remain supported. Negative or
uncertain requirements are flagged, not invented. Genuine repeats are merged by
event identity/date/time/location, preserving different sessions. Output
truncation still fails explicitly rather than accepting partial JSON. Existing
payload fields remain; provenance and coverage are additive. Missing dates can
be reviewed/edited; strict publication validation still rejects incomplete
selected items. Unselected incomplete items do not block valid selections.

The seven-highlight cap is removed. All substantive supported stories are
combined, with a whole-newsletter target of ten or more. Routine invitations and
unchanged directory/credit cards are not quota filler; substantive changes,
achievements and useful notices are retained. A shortfall returns available
items with a review explanation. Review warnings recalculate after draft edits
or removal. Distinct same-title sessions/stories no longer collide in native IDs;
ordinary single-item IDs remain compatible with previously published items.

`rsvp-coverage-v2` versions both job identity and checkpoint inputs, so reanalysis
cannot silently return an older successful extraction. It reuses the retained
Firebase PDF, with the existing ownership/integrity/auth checks unchanged.

Real local Gemini analysis used the unchanged 39,435,477-byte November PDF:
12/12 pages independently audited, four literal RSVP references matched, five
RSVP/registration events and 22 meaningful highlights. The recovered Lunch
Bunch (November 6, noon) and Thanksgiving Potluck (November 26, 1 PM; RSVP
November 20) were checked against source pages 5 and 10. Existing holiday dinner
event/deadline separation and veterans/spouses eligibility were also verified.
A real model summary omitted the eligibility line even while its source quote
retained it; mapping now preserves quoted source details alongside descriptions,
preventing that loss without inventing text.
All 27 items pass native publication-data validation locally. Six persisted
operations survive model fallback/restart; the final resume makes zero new
provider calls. Public verification metadata is in
`newsletter-extraction-coverage-verification.json`. PDF/results/checkpoints and
page images stay ignored and private under `.release/newsletter-coverage`.

Validation: 15 focused pipeline checks, seven coverage/native-model checks,
server/native TypeScript and isolated function packaging. No live Firebase data
writes, publication, deployment, OTA, push, native build or phone verification.

After separate approval: deploy only the existing isolated `newsletterApi` and
`runNewsletterAnalysis` functions, preserving their background-jobs flag and
current security/credentials. Then release compatible Android Preview JS for
coverage/provenance and review handling. No new indexes, rules, uploader/reader
changes, native dependencies or APK are required. Reanalyze the retained PDF;
publishing remains an explicit Admin/VIP action. Existing edition is unchanged.
