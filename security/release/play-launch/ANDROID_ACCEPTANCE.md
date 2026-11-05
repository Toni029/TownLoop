# One-pass Android candidate acceptance

**Not executed in this preparation.** Use the actual approved Play internal-test
artifact on the Samsung and one smaller supported Android phone. Record build ID,
versionCode, runtime, OTA ID, Android version and PASS/FAIL per row. Use authorized
test accounts/fixtures, never real resident deletions or private screenshots.
Avoid repeated whole-suite runs; investigate only a failed row and its shared seam.

| Check | Required result |
| --- | --- |
| Install/update and startup | Check Play-vs-sideload signing compatibility before install; preserve local reminders/data. Cold launch shows the unchanged approved video and smooth exit, no blank/black hang; background/resume does not replay it or interrupt other Bluetooth audio. |
| Login/roles/account switch | Email/password and Google login/cancel/conflict work with the **Play app-signing** certificate. Pending users remain approval-gated; Admin/VIP/Crew/Resident retain their actual permissions and account isolation. |
| Keyboard and accessibility | Discussion Feed inline/detail comments and Marketplace comments: short/long multiline text, Send visible above keyboard, larger font, small screen, navigation bar and two keyboard heights. Check Inbox/composer/Work Order active inputs with the same shared fix; no layout jumps or dismissal. |
| Selected media/upload failure | Feed, Marketplace and image-only Work Orders: select photo before text, preview/remove/replace, cancel picker, permission denied, network interruption/retry; UI stays usable, no duplicate posts/uploads. Preserve existing video support where offered. |
| Inbox privacy and leaving | Private/Office/Crew authorized test threads: own one-tap leave disappears only after success, remaining member's history/read-only private state survives, join/leave events are genuine, new member cannot fetch prejoin history/attachments, errors preserve the conversation. Marketplace stays separate. |
| Four push categories | New private Inbox, Marketplace, Discussion reply and DONE Work Order events from another eligible account: foreground/background/normally closed, privacy-safe shade/banner, correct authorized deep link, no sender self-notification/duplicates. Do not force-stop and expect OS delivery; user settings/launcher determine dots and lock-screen display. |
| Permission/settings/unread | Fresh install allow/deny native permission; no custom introduction popup, no repeated request after denial, system-settings link works. Four Account toggles persist across restart/account changes and respect existing choices; leave/block/token revocation stops unauthorized notifications. |
| News/PDF/upload/Gemini | Read current PDF, page/position retained on focal pinch release and reopen. Admin/VIP upload/cancel/interruption/resume of approved test PDF, accurate progress, retained integrity, Gemini analysis/retry without another upload. RSVP coverage excludes routine Home activities; highlights/coverage issues review correctly. Never publish over the real edition as a smoke test. |
| Work Orders and Home | Image-only photo-first request, ID, permitted edit, Crew reply/DONE and role-safe deletion. Weather, medication/checklist persistence and monthly recurring activities unchanged. |
| Offline/error/deletion/policy | Temporary DNS/network loss is recoverable, no indefinite busy overlay. Account request/review/status tested only with approved fixtures, with the live receipt hold preserved in this pass. Open real privacy/terms/deletion pages without app login. |
| Final artifact and observability | Confirm API36, increasing versionCode, notification icon, compiled silent-startup protection, merged permissions and 16-KB packaging/device behavior on actual AAB-generated APKs. After separate monitoring approval, one synthetic crash/error arrives symbolicated without private content, collection-off works, and harmless backend alert reaches its approved contact. |

**Exit rule:** unresolved access/privacy, data loss, essential upload/keyboard,
notification or repeatable crash failures stop widening distribution. Play's
prelaunch report is additional evidence, not a replacement for these account- and
hardware-specific checks. A physical iPhone pass remains separately required for
an iOS launch; do not infer its results from this checklist.

Recovery: halt a bad rollout; use an approved higher-version-code corrective AAB
or runtime-compatible JS fix where appropriate. Never restore permissive rules,
reuse retired tokens or resurrect deleted records. An OTA cannot reverse backend
deletion, install a missing native module or change signing/compiled permissions.
