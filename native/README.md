# TownLoop native migration

The existing React/Vite application remains at the repository root. This isolated Expo SDK 57 / React Native client uses its own dependencies and lockfile. The web application's only configuration adjustment is excluding `native/` from its TypeScript check.

## Run

Use Node 22.13 or later. From `native/`:

```sh
npm ci
npm start -- --port 8082
```

Scan the QR code with a compatible Expo Go client on Android or iOS. For a local Android emulator use `npm run android -- --port 8082`. The web app stays on port 3000. `npm run web -- --port 8082` is a layout check, not proof of native device behavior.

## Implemented

- Native email/password sign-in and password reset against the existing Firebase project.
- Persistent native authentication through AsyncStorage; no passwords are stored by application code.
- Live `users/{uid}` approval/role profile, guarded routes, recovery states, sign-out.
- Existing Home / News / Work Orders / Social tab order and matching Lucide icons.
- Live News: publication metadata, RSVP event dates/details, pinned highlights, loading/error/empty states, subscriptions disposed on navigation/session changes.
- Home: live weather, medication management, Daily Checklist and the complete recurring-activity calendar. See [Home migration details](HOME_MIGRATION.md).
- Shared web data types, recurrence rules and event sorting. No demo resident data or production writes.
- Firebase Storage initialized for the next upload/PDF phase. Database is explicitly `(default)`; never use the AI Studio named database.

## Deliberately incomplete

Work Orders and Social are marked as unavailable in this preview. Native RSVP submission, newsletter/PDF reading, upload/extraction, registration, Google sign-in, the full global profile/admin menu, chat, and notifications remain to be migrated. Home implementation and remaining physical-device acceptance checks are documented in [HOME_MIGRATION.md](HOME_MIGRATION.md). The new web PDF canvas cannot be copied into React Native; the native PDF implementation must preserve full-screen reading and admin removal behavior.

No backend rules, user records, or credentials are changed by setup. A missing profile is reported, never silently overwritten with a new unapproved profile. An explicit `approved: false` remains blocked, matching deployed Firestore rules even if legacy role flags claim admin status.

The Firebase client configuration is public and matches `../firebase-applet-config.json`. Never copy `.env`, Gemini keys, service account keys, or private signing keys into this directory. Gemini must remain behind the authenticated backend. A phone cannot use the computer's `localhost`; production API features require a reachable HTTPS backend URL in the next phase.

## Checks

```sh
npm run typecheck
npm run lint
npm test
npx expo install --check
npx expo export --platform android --output-dir /tmp/townloop-android
npx expo export --platform ios --output-dir /tmp/townloop-ios
```

Bundle exports are not APK/IPA builds or signed-in device tests. Before distribution verify a real existing admin and resident account, pending/denied access, process-restart persistence, sign-out, live News updates, and offline/recovery on Android and iOS. Do not add fake production accounts for testing.

## Dependency audit

Compatible patch updates have been applied. The npm audit still flags transitive Expo/Metro tooling and Firebase Node/gRPC dependencies. Do not force the suggested downgrades to Expo 44 or Firebase 9. Reassess reachability and supported upgrades before any production release; this branch is a development preview.
