# Work Orders and Social review checkpoint

Review baseline: `4919a2b97b87b306efac41cf9d5d0879b82a7e73`, still available remotely as `checkpoint/news-review` and an ancestor of this branch. Upload-only newsletter correction: `feeb2b81be4aff2d1e6b09c6c5fd9a42db8907e4`.

Stable milestones already pushed to `native/expo-migration`:

- Work Orders: `d9ebcb2` — [scope, Firebase paths and acceptance](WORK_ORDERS_MIGRATION.md).
- Social: `7308ff642d6d3da659309894c63e12a51c8acbe9` — [scope, Firebase paths and acceptance](SOCIAL_MIGRATION.md).
- Final regression checkpoint: the commit containing this report. No additional feature changes follow the Social milestone.

All migration changes since the review baseline are under `native/`. Main remains `a6567cdcbfaa578dd10a89b8c259a5650d5a0a76`, confirmed locally and on origin. Firebase configuration, authentication/approval architecture, four-tab order, schemas and rules remain unchanged. The previous untracked web lockfile remains safely stashed; it was not discarded or included in these commits. No production test records, demo routes or authentication bypass were introduced.

## Completed validation

| Check | Result |
| --- | --- |
| Native TypeScript | Pass |
| Native lint | Pass |
| Native tests | 33 pass; Home, News, auth/profile, Work Orders, Social, subscription cleanup, media gestures |
| Expo dependency compatibility | Up to date |
| Expo Doctor | 21/21 pass |
| Android bundle export | Pass, final Social source |
| iOS bundle export | Pass, final Social source |
| Work Orders / Social action emulator | 30 pass against unchanged rules, including duplicate submission/comment/message guards, concurrency, role ownership, queue/status/proof, marketplace availability, inquiry/reply/read/leave |
| News emulator regression | 28 pass: permission/concurrency/removal; existing resident RSVP denial confirmed |
| Work Orders layout/interaction regression | 28 pass at 320/390/768 px |
| Social layout/interaction regression | 40 pass at 320/390/768 px |
| News layout/interaction regression | 16 pass at 320/390/768 px |
| Uploaded-only newsletter states | 18 pass: uploaded/missing/removed/legacy metadata, resident/admin controls |
| Home interaction regression | 7 flows pass: task add/complete/restart, medication add/take/undo/refill, December and January recurring reminders, calendar-to-checklist persistence, activity filters, dark appearance, 360 px dialog |
| Home recurrence model | All 11 canonical rules preserved; 2026–2032 occurrences, year/month boundaries, leap day, fifth weekdays and DST pass |
| Browser-only API inspection | No DOM, localStorage, browser navigation, import.meta or WebView in native runtime; intentional `.web` PDF stubs provide device-build guidance |
| Listener cleanup | Late callbacks suppressed after unmount/account changes; Firestore, upload/auth, video listeners detach; video players dispose |
| Regression isolation | Home/News runtime code and tab/auth/Firebase architecture unchanged from feeb2b8 |

Visual checks use actual React Native components rendered through Expo's layout preview and actual unchanged web components with isolated fixture data. Committed screenshots are review evidence, not proof of device parity. Home tests used an isolated local resident namespace and mocked weather responses, not production resident data. Firebase suites use a disposable localhost demo-project emulator. Native build exports are JavaScript bundles, not signed APK/IPA packages.

## Remaining acceptance and limits

Test Android and iOS development builds with real existing resident/admin/crew accounts: live Firebase/Storage permissions, multi-device updates, camera/library denial and cancellation, interrupted uploads, native image/video gestures, keyboard resizing, back/close/share presentation, font scaling and screen readers, offline/reconnect and repeated taps. The native PDF module requires a development build; Expo Go/browser cannot validate it.

Work Orders' reference local Spanish translator is implemented; secure server-assisted translation remains unavailable until authenticated `/api/translate` is deployed. Social functions are implemented, with existing device-local reaction membership retained. Ambiguous network acknowledgement of a reaction counter cannot be made exactly-once without a backend change. The unchanged marketplace chat rules do not enforce participant privacy on the server; see the Social report before release. Existing News Gemini-backend and resident RSVP permission limitations remain documented in NEWS_MIGRATION.md.

No full-app visual-polish phase, unrelated general chat, notifications or additional screens were started. Stop at this checkpoint for user review.
