# TownLoop native migration

The Expo app is the primary TownLoop product. The existing React/Vite application at the repository root is the visual and functional migration reference. This isolated Expo SDK 57 / React Native client uses its own dependencies and lockfile. The web application's only configuration adjustment is excluding `native/` from its TypeScript check.

## Run

Use Node 22.13 or later. From `native/`:

```sh
npm ci
npm start -- --port 8082
```

News uses a native PDF module and now requires a **development build**, not Expo Go. With the platform SDK installed, run `npx expo run:android` or `npx expo run:ios` (Mac), then `npx expo start --dev-client --port 8082`. `eas.json` also provides development/preview profiles; no cloud build has been started. The web reference stays on port 3000. `npm run web -- --port 8082` is a layout check; PDF picking/rendering/sharing require Android or iOS.

## Implemented

- Native email/password sign-in and password reset against the existing Firebase project.
- Persistent native authentication through AsyncStorage; no passwords are stored by application code.
- Live `users/{uid}` approval/role profile, guarded routes, recovery states, sign-out.
- Existing Home / News / Work Orders / Social tab order and matching Lucide icons.
- Native News: publication cards, live events/notices, guarded RSVP/admin actions, publishing/removal and full-screen native PDF reader. Newsletters use administrator-uploaded files only, retained until removal or replacement; no default edition is bundled. See [News migration and acceptance details](NEWS_MIGRATION.md).
- Home: live weather, medication management, Daily Checklist and the complete recurring-activity calendar. See [Home migration details](HOME_MIGRATION.md).
- Shared web data types, recurrence rules and event sorting. No demo resident data or production writes.
- Existing Firestore PDF chunk storage and legacy Firebase Storage cleanup. Database is explicitly `(default)`; never use the AI Studio named database.

## Deliberately incomplete

Work Orders is paused and Social remains a placeholder. Gemini requests are explicitly deferred until the secure backend is deployed. Resident RSVP writes conflict with the checked-in manager-only Firebase rules and need a reviewed backend solution. News physical-device and signed-in production acceptance checks are listed in [NEWS_MIGRATION.md](NEWS_MIGRATION.md). Registration, Google sign-in, the full global profile/admin menu, chat and notifications remain outside this phase. Home acceptance checks remain in [HOME_MIGRATION.md](HOME_MIGRATION.md).

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
