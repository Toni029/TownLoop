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

All RSVP references remain in the independent inventory. Routine Home reminders
are excluded from News; a related activity qualifies only as a separately
advertised occurrence with its own explicit attendee instruction and quoted source
evidence. Names alone never disqualify a genuine special occurrence. Non-RSVP explicit attendee registrations remain supported. Negative or
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

`rsvp-coverage-v3` versions both job identity and checkpoint inputs, so reanalysis
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

## Clarified Home / News separation (follow-up correction)

The v2 real-analysis numbers above are a historical baseline, not a claim that
v3 has been rerun through Gemini. V2 was too broad about recurring activities.
V3 passes the existing read-only Home routine names/schedules as model context,
requires source-grounded occurrence classification, and rejects routine or
unsupported recurring candidates before mapping News events. The independent
inventory still scans every RSVP reference; exclusions/uncertainty remain
visible for review rather than being counted as extracted matches. No Home
calendar code, recurrence rules, or live event data is changed.

Manual November review: none of the five candidates is an ordinary weekly
calendar reminder. Lunch Bunch (page 5) advertises November 6 at a named restaurant
with an occurrence-specific RSVP; Home's standing reminder is second Friday.
Thanksgiving Potluck (page 10) is November 26 at 1 PM with a November 20 deadline;
page 5 explicitly cancels the ordinary monthly potluck in favor of that holiday
flyer. Coffee with Comrades (page 9) and Holiday Dinner (page 11) have their own
printed RSVP announcements. The Antique Car Show (page 1) has ticket sales and
volunteer signup, but no explicit attendee RSVP requirement; its eligibility
needs Admin review, not a claim that all five are confirmed RSVP-required events.
The revised generic prompt distinguishes ticket/volunteer instructions from
required attendee registration. Four literal RSVP references remain supported.

Focused recurrence tests cover ordinary Wii Bowling exclusion, uncertain Bingo
exclusion, a same-name special tournament exception, fabricated evidence rejection,
and retaining an excluded routine's RSVP reference for review. All 23 focused
pipeline/coverage/native-model checks passed. The ten-highlight
target and all-page audit are unchanged. No new provider analysis, deployment,
publication, PDF upload or Home schedule mutation was performed in this follow-up.
