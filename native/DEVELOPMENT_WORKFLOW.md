# TownLoop development and manual releases

## Setup status (2026-10-15)

Recovery commit: `1d1bdea`; pushed tag `checkpoint/before-eas-workflow-2026-10-15`.
Linked project: `@seeds4clix/townloop-native`, UUID `9f970d26-beed-44d6-a590-9dcdc00e85de`. EAS Update URL is configured. Separate remote `preview` and `production` channels map to their own branches. Android remote versionCode was initialized to 2 (the prior APK used 1). Preview and development APKs built successfully. The user explicitly approved the first Preview OTA, which is published; on-phone delivery, Fast Refresh and signed-in feature verification remain pending user confirmation. Production has no updates.

Package remains `com.toni029.townloop`. Firebase client configuration, data, rules, app screens and functionality are unchanged. OTA channels isolate bundles, not Firebase data: both builds use the existing backend. Do not create test records without approval.

## Local verification

TypeScript, all 62 existing tests and Expo dependency compatibility passed. Lint has zero errors and one pre-existing unused-variable warning. Both Metro servers started on their assigned ports. Browser-tool inspection was blocked by its URL policy; visual review and device Fast Refresh/OTA delivery have not been verified. Web production export also passed.

## Daily development

On this computer, the executable launcher also finds Codex’s bundled Node runtime: run `./dev web` or `./dev android` from `native/`. These are equivalent to the npm scripts below and avoid requiring a global npm install.

Use Node 22.13+ and npm 10 for this lockfile (cloud-install compatibility checked with npm 10). From the repository's `native/` directory:

```sh
npm ci
npm run dev:web
```

Open http://localhost:8082. Expo watches source changes automatically. In a second terminal:

```sh
npm run dev:android
```

This uses port 8081 so web and Android can run simultaneously. Install the development APK once, put the phone and computer on the same Wi-Fi, open the TownLoop development client and scan its terminal QR code or enter its displayed LAN URL. `localhost` on the phone means the phone, not the computer. Keep Fast Refresh enabled in the developer menu. USB alternative: `adb reverse tcp:8081 tcp:8081`, then connect the development client to the forwarded server. VPNs, guest Wi-Fi isolation or firewalls can prevent LAN access.

Development builds support the existing PDF, camera and media native modules; Expo Go does not replace this build. The standalone Preview APK uses downloaded/embedded bundles, not Metro Fast Refresh. Both APKs intentionally retain the same package name, so installing one replaces the other rather than creating two apps. Keep the same certificate and a nondecreasing versionCode; do not uninstall or clear app data to solve installation errors.

## Complete EAS linking after account authorization

```sh
npm run eas -- login --device
npm run eas -- whoami
npm run eas -- project:info
```

Use an existing TownLoop project if one exists. Link its verified UUID with `eas init --id PROJECT_ID`; otherwise create the project in the authorized account. Then run `eas update:configure` and retain the fingerprint runtime policy and launch settings in app.json. Confirm `extra.eas.projectId` and `updates.url` refer to that same project. Never insert a guessed project ID.

Inspect existing channels/branches before creating or changing them:

```sh
npm run eas -- channel:list
npm run eas -- branch:list
# Only if absent:
npm run eas -- branch:create preview
npm run eas -- branch:create production
npm run eas -- channel:create preview
npm run eas -- channel:create production
```

Preview must map only to the preview branch; Production only to production. Git branches and EAS branches are independent. Do not repoint an existing production channel or publish to it during setup.

## Signing and APKs

The last local APK was signed with the existing generated Android debug certificate. A restricted local backup is in `credentials/townloop-existing.keystore`, with `credentials.json`; both are Git-ignored. Development and Preview profiles use these local credentials to avoid generating a different key. They are review builds, not official Play signing credentials. Production credential settings remain unchanged. Back up the key securely outside this computer before cleanup.

After EAS linking and environment review:

```sh
npm run build:development
npm run build:preview
```

These invoke EAS cloud builds (subject to account quotas). Review remote Android versionCode before building; the existing APK used code 1, and replacement builds must not go backwards. Never replace existing remote signing credentials. Install the downloaded APK as an update over the existing app. If Android reports a certificate/version conflict, stop and compare the installed build's signing identity/version; do not uninstall it.

The old edge-to-edge APK has no expo-updates module/update URL/channel. It cannot acquire OTA capability through OTA: one new Preview APK is required. Do not use direct `assembleRelease` as a substitute for the configured EAS Preview build: its channel must be embedded during native generation. Generated `android/` and `ios/` are ignored; EAS generates them from the checked-in config.

## Environment consistency

The same public runtime environment must be used when building and publishing. EAS profiles select development, preview and production environments explicitly; the Preview publishing command uses `--environment preview`. Firebase public client config is already checked in and is not a server secret.

The newsletter service reads `EXPO_PUBLIC_TOWNLOOP_API_URL`. It needs the existing, reachable HTTPS service URL on phones. This variable is currently not configured in native local env files. Establish its actual value with the owner before setting it in EAS; never use a phone's localhost or invent a backend URL. Keep Gemini/server secrets on the backend, never in EXPO_PUBLIC variables. Do not silently change Production environment values. Promoting a Preview bundle copies its baked-in values, so verify they are appropriate for Production first.

## Manual Preview approval

1. Edit source and review live previews.
2. Run relevant checks (`npm run typecheck`, `npm run lint`, `npm test`, `npx expo install --check`).
3. Commit the reviewed change and push `native/expo-migration`.
4. Obtain explicit permission for this specific Preview update.
5. Run:

```sh
npm run update:preview -- "Approved description of the change"
```

The script requires a clean tree on the correct branch, fetches GitHub and requires HEAD to equal the remote branch. It then requires an interactive `PUBLISH PREVIEW` confirmation. It publishes Android only, explicitly to Preview with the Preview environment. This guard prevents accidental routine publishing; it is not an account-level security boundary. Codex must still obtain the user's approval before invoking it.

There are no added Git hooks, GitHub Actions, EAS Workflows or push-triggered OTA jobs. A Git push alone never invokes this script. This EAS project was newly created during setup; no GitHub App integration or cloud workflow was configured. The EAS project and Git repository are linked only through the manual CLI workflow.

## Verify the first OTA on the phone

After the new Preview APK is installed, verify the embedded build first. The app includes a one-time Preview-only “Preview update received” notice with the actual update ID/runtime. It is silent for embedded APK launches, development clients, web and Production. Obtain approval to publish the unchanged reviewed bundle as the harmless first OTA test. Record the update group ID, runtime fingerprint and source commit. Open the app online to download the update, close it completely and reopen to apply it. Launch checks use ON_LOAD with zero blocking wait, so an update may appear on the next launch. Do not force a reload while someone is typing.

Ask the phone owner to confirm the Preview notice and its update ID, sign-in persistence, community selection, navigation and existing PDF/media functionality. The notice is acknowledged once per update using a separate local diagnostic key; it does not change account/community storage. Server-side publication success is not proof the phone downloaded or ran it. Record the phone result before calling the setup complete. Fast Refresh also requires an actual development-client connection and an observed source edit on that device.

## Compatibility and production promotion — NOT executed during setup

The fingerprint runtime policy computes compatibility from native dependencies/configuration. Only updates matching the installed runtime and platform are eligible. Keep this policy; do not force runtime strings to make an incompatible update load. SDK, native dependency/plugin, permissions, native configuration, package/scheme and update-channel changes generally require a new APK. JS/TS/UI and compatible asset changes can use OTA. Fingerprints can conservatively require a new build; inspect mismatches rather than bypassing them.

Production remains reserved for an appropriately signed Play build with its Production channel. After explicit user approval, and only when its runtime and baked-in environment match the tested group, promote the exact tested bundle:

```sh
npm run eas -- update:republish --group TESTED_PREVIEW_GROUP_ID --destination-channel production --platform android --message "Approved tested release"
```

Do not rebuild/re-export the JS as part of promotion if the goal is to ship the exact tested bundle. This command publishes to Production; it is documentation only and must not be run now. No Play submission command is part of this workflow.

## Recovery

Keep the original APK and pushed recovery tag. If native recovery is needed after versionCode 2 is installed, rebuild the recovery source with the same certificate and a nondecreasing versionCode; Android may reject installing the old versionCode 1 APK as a downgrade. A Git revert alone does not roll back phones. With explicit authorization, republish a known-good compatible update to the affected channel:

```sh
npm run eas -- update:republish --group KNOWN_GOOD_GROUP_ID --destination-channel preview --platform android --message "Approved Preview recovery"
```

Or `npm run eas -- update:rollback` and choose the correct Preview branch/runtime and previous or embedded update. Read the interactive selection carefully. Returning to the embedded bundle restores the one packaged in that APK, not an arbitrary old Git commit. Recovery must cover each affected runtime. Devices must reconnect and check for updates; offline devices cannot receive a remote rollback. Automatic error recovery is a fallback, not a guarantee against all bugs or data changes. OTA rollback cannot undo Firebase writes. Preserve app data and avoid uninstalling.

## References

- https://docs.expo.dev/eas-update/getting-started/
- https://docs.expo.dev/eas-update/runtime-versions/
- https://docs.expo.dev/eas-update/rollbacks/
- https://docs.expo.dev/eas/environment-variables/usage/

## Reproducible native dependencies

`prepare-native-dependencies.cjs` normalizes masked-view’s Android manifest during postinstall, matching the rewrite its own Gradle script performs. Without this, an already-built workstation and a fresh EAS worker calculate different fingerprints. The safety check caught and rejected that mismatch during setup; it was fixed rather than disabled. Preview and Production both calculated runtime `7a4f52ca67cc7391c6bd746696462930f71df303` at checkpoint `9b5914b`.

## Built artifacts and approved OTA (2026-10-15)

- Preview build: `2aa5009d-dd74-465d-84ed-8ad7bcb51e48`; `/home/tonio/Downloads/TownLoop-preview-OTA-2026-10-15.apk` (about 131 MiB).
- Development build: `82df7c94-b6f1-4685-bb14-505cb4d9b7b9`; `/home/tonio/Downloads/TownLoop-development-2026-10-15.apk` (about 280 MiB).
- Both builds use source checkpoint `9b5914b`, package `com.toni029.townloop`, versionName `0.1.0`, versionCode `2`.
- Certificate SHA-256 for both and the prior installed-review APK: `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`.
- The actual Preview APK manifest has updates enabled, launch checks enabled with zero blocking wait, the project update URL, and only the `preview` channel header. Its `assets/fingerprint` is `7a4f52ca67cc7391c6bd746696462930f71df303`.
- Approved Android Preview group: `558d774c-e39b-4347-98c9-df4b70e405a6`.
- Android update: `01a1415e-ee0c-76b1-920b-dec9dd07e8ef`.
- Published from clean, pushed checkpoint `be58514`; runtime matches the APK exactly. Later changes in this checkpoint only added the local launcher/documentation; app code matches the built APK.
- EAS channel inspection confirms Preview points to the Preview branch and this group. Production points to the separate Production branch with zero updates. No production build, OTA publication or Play submission was performed.

These are static APK/configuration and EAS server-record checks, not device execution tests. A direct Python HTTP probe of the update endpoint was rejected by Cloudflare's client-signature policy (403); it was not bypassed or treated as proof of an app update failure. Phone delivery remains the required end-to-end verification.

Install Preview over the existing APK without uninstalling, open online, allow the download, fully close and reopen. Confirm the one-time notice shows update ID beginning `01a1415e`, then confirm existing sign-in/community and key screens/PDF still work. After that, install the development APK over Preview, connect to `./dev android` on the same Wi-Fi, and verify a reversible source edit refreshes on the phone. These two builds share one package and replace each other.
