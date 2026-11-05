# Focused local verification — November 5, 2026

Only the new named candidate/compatibility boundaries were exercised. No broad
historical/native suite rerun, production record read/write, Auth account creation,
private history/media download, deployment, source execution from the web, cleanup,
notification, OTA or build. Public HTML/bundle were fetched as static bytes only;
known main bundle remains SHA `1dfd19fb7b3b4966a1595a18f0059c7263c4fa67dc69dd6886912b66ad5a55c5`.

## Evidence

| Check | Result |
| --- | --- |
| Vulnerable named baseline, focused private-profile regression | **RED:** expected denial, actual HTTP200; confirms the test detects current broad profiles/list access. An initial request raced emulator startup and was retried only after readiness; it is not counted as security evidence. |
| New candidate + secure read-only fallback emulator cases | **13/13 pass**, no skips/cancellations, 26.356s. Covers all four canonical roles, pending/anonymous/alias/revoked/frozen users; private profiles, self privilege escalation, signup, independent attestation, forged identity/markers/source namespace, unassigned staff, canonical append/history preservation, duplicate IDs/historical collision, own cursors, unread mutation denial, mailbox/projection denial, Work Order ownership/Crew completion, deletion fences, privileged rewrite hold/fresh epoch and fallback mutation denial. |
| Final legacy sideLeft resident/team read guards + same fallback | **2/2 pass**, no skips/cancellations, 2.502s. This targeted follow-up tested the final change without repeating the whole candidate suite. Departed resident/team loses read, remaining party retains history, client flag clearing denied. |
| Unintegrated compatibility adapter boundary fixtures | **3/3 pass**, 4.313s. Explicit named DB, pending denial, canonical immutable append, count/epoch IDs, acknowledged retry without duplicate write, own read cursor and account-switch failure before write. SDK boundary mocks; not a browser acceptance claim. |
| Adapter strict standalone TypeScript | **Pass**, no output, exit0. |
| Offline config/hash/scope/fallback validation and syntax/whitespace checks | **Pass**, exit0. Named-only configs; no default, Hosting, Storage, functions or indexes; default candidate unchanged; fallback denies all client mutations. |

During implementation the first complex dynamic ternary expression hit a local
rules-runtime error (HTTP500). It was replaced with explicit boolean branches;
all final cases above require successful intended access or HTTP403 denials, never
accept HTTP500 as security success. Review iterations were confined to these new
local files. No production-rule mutation occurred.

## Commands

Existing cached JRE and existing Firebase CLI; one disposable emulator session:

```sh
PATH=/home/tonio/.cache/townloop-build/tools/zulu21.54.107-ca-jre21.0.13-linux_x64/bin:$PATH node /home/tonio/.npm/_npx/7750544ccf494d8b/node_modules/firebase-tools/lib/bin/firebase.js emulators:start --project demo-townloop-legacy-launch --config security/legacy-launch/firebase.emulator.json --only firestore
```

Tests install their own rule source through the **loopback emulator** API. The
emulator CLI warns about an absent default rules entry; that initial open demo
state is not used as policy evidence. The baseline/candidate source is explicitly
loaded and assertions require exact expected responses. Demo project only.

```sh
FIRESTORE_EMULATOR_HOST=127.0.0.1:8898 LEGACY_LAUNCH_RULES=security/account-deletion/firestore.website.candidate.rules node --test --test-name-pattern='pending signup gets own profile' security/legacy-launch/authorization.rules.test.mjs
FIRESTORE_EMULATOR_HOST=127.0.0.1:8898 node --test --test-concurrency=1 security/legacy-launch/authorization.rules.test.mjs security/legacy-launch/readonly.rules.test.mjs
FIRESTORE_EMULATOR_HOST=127.0.0.1:8898 node --test --test-concurrency=1 --test-name-pattern='legacy service side-left|secure fallback' security/legacy-launch/authorization.rules.test.mjs security/legacy-launch/readonly.rules.test.mjs
node --test security/legacy-launch/client.test.cjs
node node_modules/typescript/bin/tsc --noEmit --skipLibCheck --target es2022 --moduleResolution bundler --module esnext --strict security/legacy-launch/client.ts
node security/legacy-launch/check-scope.cjs
```

Logs outside Git: `/tmp/townloop-legacy-launch-red.log`,
`/tmp/townloop-legacy-launch-final.log`, `/tmp/townloop-legacy-launch-final-guards.log`,
`/tmp/townloop-legacy-launch-client.log`, `/tmp/townloop-legacy-launch-types.log`.
No actual named/private record, grant or mailbox was read or created. Fixtures
explicitly seed independent server authorization; they **do not prove any existing
resident's historical ownership or message authenticity**. The original website
is not integrated/verified against this adapter. Current workers do not claim the
new rewrite/inventory contract. All README/manifest gates remain blocking before
any provisioning or rollout. The live named-database P0 is still unresolved.
