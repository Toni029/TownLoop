# Home migration checkpoint

Source of truth: GitHub `main` at `a6567cdcbfaa578dd10a89b8c259a5650d5a0a76` (checked again after fetching origin). All changes in this phase are under `native/` on `native/expo-migration`. No web source, Firebase configuration, rules, or production records were changed.

## Migrated

The Home tab now renders actual React Native views, text, pressable controls, scroll views, modal sheets, SVG and native gradients. There is no WebView or embedded website. The existing protected authentication/approval routes and Home / News / Work Orders / Social tab order are unchanged.

The source section order is preserved:

1. **Weather:** Cecil Pines / Jacksonville location, current Fahrenheit temperature, high/low, condition and humidity, selectable next 12 hours, selectable five-day outlook, precipitation information, condition-specific color palettes and atmospheric motion. Uses the same Open-Meteo URL, coordinates, timezone and forecast transformation as `src/components/WeatherWidget.tsx`. Refreshes after 45 minutes, also checking on foreground resume. Loading, retry and explicitly labelled stale-data states replace the web's old sample-weather fallback.
2. **Daily Medications:** initially collapsed; expand/collapse, taken/total count, add/edit/delete, four time slots in their original order, quantity, bottle count, directions and all instruction shortcuts, pharmacy number, Take Now, Undo Dose, +30 Refill, low-supply notices and native phone dialer. Preserves the web's once-per-day dose model and existing medication fields.
3. **Daily Checklist:** Today, Tomorrow, selected date, All Tasks, calendar with task indicators, month navigation, Jump to Today, add with a selected date, complete/uncomplete, delete, completion counts, empty states and resident-local persistence. Original insertion order is retained.
4. **Monthly Activity Reminder:** Calendar / All Activities, month navigation, Today jump, weekday grid with category-colored activity indicators, selected-date activity count, full details, recurring rule labels, category filters, and add/remove checklist reminders. All Activities retains the web's explicit *add to today's checklist* behavior, even if that activity's next scheduled occurrence is on another date.

Home uses bundled Plus Jakarta Sans / Playfair Display, the original Lucide icon families and pill-bottle artwork, cream/slate/emerald/blue surfaces, rounded card geometry and section spacing. Native controls use larger hit areas and readable/scaling text. Home offers light/dark appearance, the existing account route, greeting, date and role label. The Home body has identical capabilities for approved residents and administrators, as on main; it contains no administrator-only data mutations.

## Calendar source and recurrence

`native/src/home/model.ts` imports `MONTHLY_ACTIVITIES_LIST` and `getMonthlyCalendarEvents` directly from the unchanged `src/data/monthlyActivities.ts`. There is one canonical rules list, not a second native event list or hand-created monthly records.

The eleven preserved activities are Garbage Day, Exercise & Movement, Puppy Play Date, Koffee Klatch, Game Night, Wii Bowling, Community Potluck Dinner, Bingo Night, Gifted Hands, Lunch Bunch and On-Site Dermatology. Weekly weekday matching and first/second/third/fourth weekday occurrence rules are evaluated for the selected year and month. Their original array order, names, times, descriptions and locations are retained. No artificial future-month cutoff is introduced.

A reminder is a `TaskItem` containing the full local date and `title (time)`. Selecting a December occurrence and a January occurrence creates independent checklist entries. Completing one does not change other dates. Removing a reminder uses the same legacy title matching used by the web's added-state indicator, avoiding the web mismatch where a legacy entry could appear added but not be removable. Task IDs are monotonic within the saved list to avoid collisions from rapid additions.

Dates use local calendar components, never UTC conversion or adding 24-hour millisecond offsets. Today and Tomorrow update at midnight (within 15 seconds) and immediately on app foreground. Viewing another month remains under the resident's control; Today returns to the new current date.

**Home reminders on main are checklist reminders.** There is no Home OS-calendar integration, push scheduler or activity RSVP submission to port. News RSVP events are a separate feature and were not changed or folded into the recurring schedule.

## Firebase and resident state

- Existing session: Firebase Auth and live `users/{uid}` in `(default)` for name, role, approval and access.
- Home does not read or write any additional Firestore collections/documents. This follows the current web implementation and rules: recurring Home activities are source rules; tasks and medications are browser-local. `community_events`, `community_highlights` and `newsletters/current` belong to News and are untouched by this phase.
- Native tasks/medications retain the shared web models and persist through AsyncStorage under `townloop:home:v1:<Firebase UID>`. They survive process restarts and remain separate when accounts switch. There is no new database or collection.
- Writes are serialized; a failed save retains the previous state and shows an error. Corrupt/unreadable records are not silently replaced or reset. Empty lists stay empty after reload.
- Browser-local reminders cannot automatically be read by a native app. No cross-device synchronization or transfer of existing browser-local tasks/medications is implied.

## Deliberate differences and boundaries

- No starter medications, sample personal tasks, sample forecast or placeholder pharmacy number are presented as real resident data. Empty medication/task lists are intentional. A real pharmacy number must be entered before dialing.
- Native Modal/KeyboardAvoidingView/SafeAreaView, animated sheets and a native date grid replace HTML dialogs/date inputs. Android Back, a close button, backdrop dismissal and downward handle gestures dismiss sheets.
- Native Animated/SVG/gradient effects preserve weather-motion intent; browser turbulence/blur filters and exact CSS particle effects are not pixel-identical. Reduced-motion settings suppress continuous animations and sheet motion.
- Text/hit targets are larger than the web's 10–12px microtext and 32px icon buttons. Long forms scroll within the keyboard-safe sheet. The seven-column calendar preserves its compact layout, with 50px-high day cells.
- Personal data is scoped per UID rather than the web's shared browser storage keys. No medication or activity information is copied between residents.
- The full global profile/avatar menu and admin management panel are not part of this Home-body migration; the existing native Account route is retained. Home's role label and approval guard remain functional. Home appearance is local to Home; a unified app-wide theme belongs to the shell migration.
- Work Orders, Social, the native PDF reader and News RSVP submission have not been started or changed.

## Verification

Commands from `native/`:

```sh
npm run typecheck
npm run lint
TZ=America/New_York npm test
TZ=Pacific/Auckland npm test
npx expo install --check
npx expo export --platform android --output-dir /tmp/townloop-home-android
npx expo export --platform ios --output-dir /tmp/townloop-home-ios
```

Regression tests exercise every day of 2026–2032 against independent weekday/ordinal expectations, leap February, fifth weekdays, December/January, US DST changes, local date formatting, dated reminder add/remove/serialization, two resident stores, concurrent writes, restart/empty persistence, corrupt storage and failed-save recovery, medication daily state, and weather hours crossing midnight.

An isolated Expo web-rendering harness outside the app (no Firebase imports or auth bypass in production routes) was used for phone-size UI checks. It verifies task add/complete/restart, medication add/take/undo/refill, December and January reminders, calendar-to-checklist persistence, category filters, dark appearance and scrolling dialogs at 360px. Weather fixtures exist only in the test browser; no production test records are created. Browser rendering checks do not substitute for device tests.

The native Home code and its shared recurrence import were checked for DOM APIs, browser storage, HTML, WebView, browser-only icon imports and unintended Firestore writes.

## Physical-device acceptance still required

Before treating this as release-ready, use existing resident/admin accounts on Android and iOS to check: approval and profile loading; restart/sign-out/account switching with persisted reminders; offline/save recovery; foregrounding over midnight and timezone changes; keyboard visibility and long-form scrolling; Android Back and iOS gestures/safe areas; VoiceOver/TalkBack, large system text and reduced motion; dialer availability; weather network recovery and animation smoothness. APK/IPA installation and real-device testing were not performed here. The existing dependency-audit release follow-up also remains open.
