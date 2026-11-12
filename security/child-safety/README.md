# Child Safety Standards preparation — November 12, 2026

Scope: `com.townloop.app`, native adults-only Social app. Reuses existing reporting
and Hosting. No native/auth/rules/function changes, live reports or account actions,
Hosting deployment, OTA, AAB, notification, email or authority report was executed.

## Owner-supplied contact and pending approval

- Official mailbox: **support@seeds4clix.com**.
- Designated child-safety lead: **Antonio Merlano**.
- Source: `public/child-safety.html`, expected public URL:
  `https://townloop.web.app/child-safety.html`.
- Draft is explicitly marked unapproved/not effective. The owner supplied the name
  and email but has not yet confirmed the operational procedure or authorized
  Hosting deployment. Confirm mailbox monitoring, operator access, evidence/media
  containment and required authority reporting before publication/self-certifying.
  No 24/7 monitoring, response deadline, age-verification system or automatic NCMEC
  integration is claimed.

The page uses cream, green and amber styling, responsive widths, keyboard-accessible
links and no scripts, sign-in, app bundle, external fonts, trackers or forms. It
prohibits CSAE, CSAM (including exploitative manipulated/generated imagery), grooming,
sexual solicitation/exploitation, trafficking and sextortion. It describes actual
Unsafe/Other report controls, Report user for private-chat concerns, Community Office
follow-up, emergency services, the official contact and NCMEC/regional reporting
where required. No suspect files are requested by email or the Report form.

## Verification: existing reporting

Read-only production check in `cc-livingcommunity-app`, `us-central1`:

| Callable | State | Revision | Unauthenticated request |
| --- | --- | --- | --- |
| `submitSafetyReport` | ACTIVE | `submitsafetyreport-00001-kom` | HTTP 401 |
| `reviewSafetyReport` | ACTIVE | `reviewsafetyreport-00001-mug` | HTTP 401 |

Current default Firestore rules SHA-256:
`4d1c449fc847c8273efdee3b813d16a1e996dd0fdfc766e3cfb09c4ace8eb6d0`.
Exact source matches the already reviewed baseline used by the focused emulator
checks. No rules were altered. No resident records were read and no live report
was created. No secret was retrieved or printed.

Source tracing:
- `native/src/components/SafetyActions.tsx`: Report/Report user/comment, Unsafe/Other,
  optional 1,000-character context, submission result and error handling.
- `native/src/social/SocialFeed.tsx`, `profile/ProfileMenu.tsx`, `social/Inbox.tsx`:
  post/listing/comment/profile/private-person entry points. Inbox reports target
  the person, not an individual message or attached file. Admin receives no new
  private-message access through a report.
- `functions/safety.cjs` / `safetyPolicy.cjs`: verified non-revoked identity,
  canonical approval, target validation, 20-new-reports/day and deduplication;
  `moderation_reports` is written only by backend operations.
- `native/src/profile/ModerationPanel.tsx`: Admin Portal → Reports, at most 50 open
  reports; review note, dismiss/handled and confirmed content removal. It does not
  automatically notify external authorities or suspend users.
- Server review independently requires approved Admin/VIP, records reviewer/time/
  note/outcome and removes eligible posts/listings or the specific comment. Residents,
  Crew and pending accounts cannot read the report collection; even managers cannot
  directly write report decisions through client Firestore.

## Confirmed limitations and the required manual procedure

1. **No account-suspension control:** Directory has Approve and Role controls, but no
   dedicated suspension/revoke-session action. `manageResident` accepts approval
   changes, but that is not a tested incident-suspension workflow; changing a role
   or blocking a user is not suspension. Antonio must confirm use of authorized
   Firebase administrative tools for disabling/restricting involved accounts and
   handling active sessions, or separately approve a focused suspension feature.
   Do not use account deletion as an incident response shortcut.
2. **Evidence and media containment:** Generic content removal deletes the target
   Firestore post/listing or comment; the report retains references/notes, not a full
   evidence snapshot. Removing a post is not proof that all Storage download links
   have stopped working. Existing bearer links and evidence/retention holds need
   operator handling. Do not bulk rotate tokens, delete files, activate cleanup
   workers or destroy potential evidence under this webpage task.
3. **Closed-report repeats:** Deduplication keys reporter + immutable target. A new
   Unsafe report after that reporter's prior report was dismissed returns the old
   dismissed report and does not re-enter the queue; the native success notice is
   generic. This was reproduced with synthetic data, not assumed. The page directs
   continuing/new concerns to existing Community Office Inbox and the lead's email.
   A separately scoped retry/reopen protocol and accurate acknowledgement UI are
   recommended; no silent backend/native change was bundled here.
4. **Queue/context operations:** The visible queue caps at 50; no priority-specific
   child-safety queue, attachment evidence submission or message-by-message review
   access is present. A human lead must triage/track serious cases and arrange only
   appropriately authorized context. No unrestricted admin access is proposed.
5. **External escalation is manual:** Antonio must adopt a procedure for assessing
   reports, immediate safety actions, lawful restricted evidence preservation,
   removing/restricting related content/media, authorized account restrictions and
   reporting confirmed CSAM/other reportable exploitation to NCMEC or relevant
   regional authorities as applicable. Confirm the reporting arrangements and any
   applicable retention obligations; no jurisdiction or new legal deadline is invented.

These are operational conditions for an accurate declaration. Google does not
require a newly invented automated detector or automatic reporting integration.
Do not certify these manual processes as operational merely because the page exists.
No native changes were made: the working in-app report mechanism already exists,
and proposed workflow changes would need a separate focused approval.

## Hosting release plan — approval required

Current read-only HTTP checks: proposed child-safety URL returns HTTP 200 **with the
retired app root**, not Child Safety Standards. Privacy returns HTML without that
app root. A 200 alone is not proof of a compliant standards page.

Existing `firebase.json` serves Hosting site `townloop` from `dist`, with a catch-all
rewrite to `/index.html`. A real static `/child-safety.html` file must be included;
static-file routing then avoids the shell. This task did not edit Hosting config.

1. Owner approves the wording, contact monitoring and operator procedure; set the
   real effective date. `stage.cjs` rejects missing explicit approval/procedure/date
   and only stages a single-file overlay, removing the draft marker.
2. Before a separately approved deployment, snapshot the current live Hosting
   version/config/file manifest and verify project/site ownership. Preserve all
   existing files, headers, redirects, OAuth and `.well-known` app associations.
   Overlay only `/child-safety.html` onto that preserved release. **Never deploy the
   one-file staging folder as the entire Hosting site**, or run an obsolete web
   build that could replace legal pages/associations.
3. Deploy Hosting only. No rules, functions, auth, native release or app data changes.
4. Check the public HTTPS URL anonymously, actual heading/contact/text, mobile
   layout, fragment/mail links and absence of the retired app shell. Check existing
   privacy/terms/deletion and app associations against the snapshot. Rollback is
   the prior Hosting version only; no database/security rollback.
5. Only after page is live and operational conditions are accepted, use the exact URL
   and confirmed contact in Play Console. No Play Console form was submitted here.

## Focused checks and remaining limits

Six page/policy checks and three synthetic Firestore-emulator scenarios cover page
structure/contact/prohibitions, guarded staging, role/target policy, actual reporting
transactions, manager-only reads, client-write denial, audited removal, no automatic
account suspension, and the closed-report limitation. Synthetic authentication is
explicitly a fixture; production unauthenticated rejection was verified separately.
No actual report, child-safety incident, resident content, Storage file or user
account was used. Physical-phone and public post-deployment verification remain.

Sources checked November 12, 2026:
- Google Play requirements and adults-only scope:
  https://support.google.com/googleplay/android-developer/answer/14747720?hl=en
- Google Play Child Endangerment / Child Safety Standards:
  https://support.google.com/googleplay/android-developer/answer/9878809?hl=en
- NCMEC CyberTipline:
  https://www.missingkids.org/gethelpnow/cybertipline
  https://report.cybertip.org/

The page is a proposed TownLoop policy; approval is not a claim that Google will
accept the declaration or that any particular jurisdiction's obligations have been
independently certified.
