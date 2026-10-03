# News verification

`npm test` runs News model/subscription tests together with existing Home/auth checks.

`news-emulator.mjs` checks existing Firestore rules, concurrent attendance updates and live removal. Install `firebase-tools`, `@firebase/rules-unit-testing`, and `firebase` in a disposable directory, configure Firestore at 127.0.0.1:8885, and run:

```
firebase emulators:exec --project demo-townloop-news --only firestore 'node /absolute/path/TownLoop/native/verification/news-emulator.mjs /absolute/path/disposable/package.json'
```

The script loads repository rules explicitly and uses no production credentials. Expected permission denials are assertions, not failed tests. The manager-only event-write restriction is an existing backend mismatch, not permission to widen production access.

Visual harnesses outside the app router import native NewsFeed and unchanged web NewsScreen with identical isolated fixtures. No authentication bypass, seeded production records or fixture routes are included in the app. Local review screenshots are under `/tmp/townloop-news-*`.
