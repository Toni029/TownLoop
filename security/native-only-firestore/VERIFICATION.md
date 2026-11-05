# Focused native-only verification — 2026-11-05

Baseline `fb654e5`. No repeated full audit or historical hundreds-case test suite.
Only new rules/preparation and their existing deletion safety boundaries were tested.

| Check | Evidence and limits |
| --- | --- |
| Known vulnerable named baseline | The new denial regression went red: a synthetic pending user's other-profile request returned **200 instead of 403**. Baseline source was the exact audit snapshot, not a live probe. |
| New containment/default emulator suite | **5/5 pass**, zero skips, 19.598s. Anonymous/pending/Resident/Crew/VIP/Admin named GET/list/write/delete denied, nested/unknown paths denied, synthetic history preserved, server owner bypass retained. Unchanged default roles still read their profiles, directory, Work Orders, Social, Marketplace, newsletter, RSVP/highlights; Admin/VIP approve synthetic pending profiles. Native private/group history membership, join epoch and left-member denial remain. |
| Native graph + packaging + existing deletion-scope/runner checks | **10/10 pass**, zero skips, 1.866s. Includes both-platform literal-import tracing, exact project/default/bucket, no reachable old web Firebase bootstrap, manifest/config scope, pin/source hash drift refusal, both database completion requirements, ownership ambiguity and worker fail-closed on changed rules. |
| Local scoped worker packaging | Prepared locally, sole export `fulfillApprovedAccountDeletions`, entry byte-identical to current worker, both database scopes preserved and staged pin equals reviewed containment manifest. New config excludes `.env*` from deployment archive. Pre-existing local staging environment files were not read, modified, copied into Git or asserted absent. A first overstrict assertion that staging contained no `.env*` was corrected to verify archive exclusion. No service was deployed or activated. |
| Static differential review | Changed production tool has one packaging caller; native source and worker business logic have zero edits. The optional flag affects only local artifact preparation; default packaging retains its reviewed prior pin. Config has one named-only rules target; worker config requires explicit single-function filtering. All changed files reviewed; no removed role/membership checks, IAM expansion, extra exported function, client history access or destructive API. |

## Reproduce locally

The existing cached JRE, emulator and Firebase CLI were reused. One disposable
loopback Firestore session, demo project only:

```sh
PATH=/home/tonio/.cache/townloop-build/tools/zulu21.54.107-ca-jre21.0.13-linux_x64/bin:$PATH node /home/tonio/.npm/_npx/7750544ccf494d8b/node_modules/firebase-tools/lib/bin/firebase.js emulators:start --project demo-townloop-native-retirement --config security/legacy-launch/firebase.emulator.json --only firestore
FIRESTORE_EMULATOR_HOST=127.0.0.1:8898 CONTAINMENT_RULES=security/account-deletion/firestore.website.candidate.rules node --test --test-name-pattern='denies every client role' security/native-only-firestore/containment.rules.test.mjs
FIRESTORE_EMULATOR_HOST=127.0.0.1:8898 node --test security/native-only-firestore/containment.rules.test.mjs
node --test security/native-only-firestore/preflight.test.cjs functions/accountDeletionScope.test.cjs functions/accountDeletionRunner.test.cjs
node security/native-only-firestore/trace-native.cjs
node functions/tools/prepare-deletion-processing.cjs --native-only-rules
```

Rules API fixtures use two isolated demo project scopes to prove deny-all versus
unchanged default behavior. Their emulator document routes use `(default)`;
the production config's exact named-database binding is independently asserted
by preflight tests. The test setup installs each rule source before assertions;
the emulator's initial unconfigured/open demo state is not evidence. No HTTP500
is accepted as authorization success. No real Auth users or cloud data were used.

Logs outside Git: `/tmp/townloop-native-containment-red.log`,
`/tmp/townloop-native-containment-green.log`,
`/tmp/townloop-native-retirement-local-tests.log`. `dependency-trace.json` records
the actual bounded Android/iOS graph result. This is not a runtime traffic capture,
signed binary proof, current cloud inventory or physical Android/iPhone test.

No fresh Gemini inference, PDF upload, push event, deletion, retention worker,
resident attachment read or provider credential investigation was performed.
Existing prelaunch tests/receipts are reused for unchanged feature behavior.
Cloud service IAM, deployed source hashes and actual mobile smoke checks remain
the explicit read-only preflight/authorized acceptance gates in the rollout plan.
