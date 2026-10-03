# Native migration verification

`npm test` runs Home, News, auth/profile, Work Orders, Social, subscription and media-gesture tests. See [final tab regression results](../TABS_REGRESSION_CHECKPOINT.md) for the validated checkpoint and physical-device acceptance limits.

## Local Firebase suites

Install `firebase-tools`, `@firebase/rules-unit-testing`, `firebase` and `typescript` in a disposable directory. Configure Firestore at 127.0.0.1:8885 and run from that directory:

```sh
firebase emulators:exec --project demo-townloop-news --only firestore 'node /absolute/path/TownLoop/native/verification/news-emulator.mjs /absolute/path/disposable/package.json'
firebase emulators:exec --project demo-townloop-news --only firestore 'node /absolute/path/TownLoop/native/verification/tabs-emulator.mjs /absolute/path/disposable/package.json --social'
```

News has 28 checks. Tabs has 30 (13 Work Orders and 17 Social). Tabs loads the actual native action modules through TypeScript with an emulator-only approved-user adapter; Firebase writes use the real SDK and unchanged repository rules. Both scripts refuse remote emulator hosts, load rules explicitly and use no production credentials. Expected permission denials are assertions, not failed tests. The manager-only News event-write restriction is an existing backend mismatch, not permission to widen production access.

## Visual and interaction checks

External fixture harnesses import the actual native Home/News/Work Orders/Social components and unchanged web reference screens. No fixture routes, seeded production records or authentication bypass are included in the app. Screenshots in `screenshots/` capture review layouts; the new Social reference/native pairs use identical fixtures. Home reminder persistence checks use an isolated local resident namespace. Real Firebase/Storage and physical-device acceptance remain open as documented in the migration reports.
