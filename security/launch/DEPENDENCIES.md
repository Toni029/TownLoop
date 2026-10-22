# H12 — focused dependency fixes

Verified 2026-10-21 (America/New_York) against npm's live registry security endpoint. This is the requested focused advisory repair, not a comprehensive supply-chain audit. No Firebase data access, deployment, credentials, GitHub authentication, EAS build, Metro export, OTA publication, or APK creation occurred.

## Results

| npm manifest | Initial locked audit | After fixes |
| --- | --- | --- |
| root | 4 high | 0 |
| native | 36 high, 19 moderate, 1 low | 28 high, 16 moderate, 1 low |
| functions | 10 moderate | 10 moderate; unchanged runtime direct versions |

Counts include packages affected through another dependency, not just distinct advisories. A zero root npm audit result does not certify the application or other manifests as vulnerability-free.

Root previously had no tracked lockfile. Its new npm lock was seeded from the installed tree. Functions had a pnpm lock but no npm lock; npm 9 could not generate a lock directly from its pnpm symlink layout (`null.matches`). The new functions npm lock was resolved separately with the three installed direct versions pinned, then restored to the existing manifest ranges in lock metadata: functions-framework 5.0.5, firebase-admin 13.10.0, firebase-functions 7.4.0. The existing pnpm lock was preserved. These results describe **npm/package-lock.json**; use `npm ci` for this audited resolution rather than assuming pnpm resolves the same tree.

## Applied changes

Only explicit transitive overrides and their lock resolutions changed:

| Scope | Package | Before → after | Registry advisory affected range |
| --- | --- | --- | --- |
| root + native | @grpc/grpc-js | 1.9.16 → 1.13.6 | `<1.13.6` |
| native | ajv (EAS copy) | 8.11.0 → 8.20.0 | `>=7.0.0-alpha.0 <8.18.0` |
| native | joi | 17.11.0 → 17.13.8 | `<17.13.8`, including earlier Joi advisories |
| native | minimatch (EAS copy) | 5.1.2 → 5.1.9 | 5.x below 5.1.8 |
| native | nanoid (EAS copy) | 3.3.8 → 3.3.18 | `<3.3.18`, including earlier NanoID advisories |
| native | tar | 7.5.19 → 7.5.21 | `<=7.5.20` |
| native | yaml (EAS copy) | 2.6.0 → 2.8.3 | `>=2.0.0 <2.8.3` |

All replacement versions and affected ranges were checked against the registry. The gRPC override intentionally exceeds Firestore's `~1.9.0` transitive request while staying on gRPC major 1; it avoids npm's proposed Firebase downgrade to 9.14.0. Its additional ordered-map dependency and lock deduplication are expected. This requires normal application validation before release; lock consistency alone does not prove transport behavior. Sources: [gRPC certificate authorization](https://github.com/advisories/GHSA-m9gg-hp2v-232j), [gRPC error disclosure](https://github.com/advisories/GHSA-f596-whhp-79r4), [Ajv](https://github.com/advisories/GHSA-2g4f-4pwh-qvx6), [Joi](https://github.com/advisories/GHSA-wr44-6hxh-3jwq), [minimatch](https://github.com/advisories/GHSA-23c5-xmqv-rm74), [NanoID](https://github.com/advisories/GHSA-2v37-7h3g-55p8), [tar](https://github.com/advisories/GHSA-r292-9mhp-454m), [yaml](https://github.com/advisories/GHSA-48c2-rrv3-qjmp).

## Remaining findings and boundaries

Native's remaining distinct root causes:

- [braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), affected `<=3.0.3`: registry latest 3.0.3 is still affected. Propagates into Metro, micromatch, fast-glob, Expo, and React Native audit counts.
- [node-forge](https://github.com/advisories/GHSA-86w9-cpqp-85rv), affected `<=1.4.0`: registry latest 1.4.0 is still affected. Signing/certificate tooling was preserved; no verified patch is published in the checked registry.
- [sprintf-js](https://github.com/advisories/GHSA-hp3w-g68c-fv3c), affected `<=1.1.3`: registry latest 1.1.3 is still affected. Reaches old oclif help/update tooling through argparse/js-yaml.
- [decode-uri-component](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr), affected `<=0.4.2`: published 0.5.0 lies outside query-string's `^0.2.2` compatibility range. npm proposes expo-router 58; changing the router/SDK or forcing this pre-1.0 compatibility boundary is deferred.
- [diff](https://github.com/advisories/GHSA-73rr-hh4g-fpgx): the EAS-pinned 7.0.0 is affected (`>=6.0.0 <8.0.3`); fix requires major 8+.
- [ts-deepmerge](https://github.com/advisories/GHSA-87mf-gv2c-c62c): the EAS-pinned 6.2.0 is affected (`<8.0.0`); fix requires major 8.
- [uuid](https://github.com/advisories/GHSA-w5hq-g745-h8pq): native tooling uses 7/8; fix requires 11.1.1+. Functions' ten moderate findings are this same root cause through cloudevents and Google client libraries. npm proposes firebase-admin 14.5.0 and functions-framework 2.0.0; neither was forced.

No automated `npm audit fix`, force flag, blanket override across dependency majors, SDK upgrade, React Native upgrade, Firebase upgrade/downgrade, or unsupported claim about maintainers was used. These remaining findings require upstream patches or separately reviewed compatibility changes. They are not a clean H12 result.

## Compatibility and release impact

Expo 57.0.30, React Native 0.86.3, React 19.2.3, SecureStore 57.0.4, all direct native modules, Firebase direct versions, Expo Updates, EAS CLI, and signing packages remain at their original locked versions. No native Android/iOS source or signing/runtime configuration changed. The bundled Expo module comparison and clean script-disabled installs are recorded below.

The native project uses `runtimeVersion.policy = fingerprint`. A lockfile/dependency change may change that fingerprint even when native modules are unchanged; do not assume this tree can be published to the existing APK's update runtime. No fingerprint/export/build was run here. Check compatibility through the established release process; a new APK is required if its computed runtime fingerprint differs from the installed build. This work neither generated nor published one.

Verification used `npm audit --json --package-lock-only`, registry package metadata, native direct-version comparison against the prior lock, and `npm ci --ignore-scripts --no-audit --no-fund` for each manifest. npm 9's earlier `ci --dry-run` unexpectedly emptied local node_modules; all three were then restored with script-disabled clean installs. Only the two existing native preparation scripts were run explicitly afterward. No third-party lifecycle scripts were executed. Install and application-check outcomes appear in the focused verification note below.

### Focused verification outcome

- Clean script-disabled installs succeeded: root 309, native 1287, functions 287 installed packages (optional platform packages explain differences from audit totals).
- Both existing native preparation scripts completed successfully after their source was inspected: masked-view manifest normalization and copying the pinned PDF.js worker/assets.
- Every native direct dependency version equals the prior lock; Expo's installed `bundledNativeModules.json` reported zero mismatches for the declared bundled dependencies. Expo remains 57.0.30 and SecureStore remains 57.0.4.
- No-network smoke checks passed for gRPC credentials exports, Joi validation, EAS's Ajv schema validation, minimatch, NanoID, YAML parsing, and tar exports. These are API compatibility checks, not a live Firebase or signing test.
- All three lock root dependency maps match their manifests. Functions retention tests passed (2/2).
- Final registry audits succeeded: root 0; native 45; functions 10. Remaining findings above stay open.

### Reproducible root TypeScript dependencies

The clean install exposed an existing undeclared-development-dependency gap: the root relied on extraneous React type packages. Added exact dev-only `@types/react` 19.2.18 (matching the actual native installed version) and `@types/react-dom` 19.2.2. Both versions were verified in the npm registry; react-dom's declared React-types peer range is `^19.2.0`. A targeted script-disabled install added only those two packages and their `csstype` type dependency (three packages total). No runtime package or native dependency was upgraded. The root's final installed package total is therefore 312.

After declaring those types, `npm run lint` reached full root TypeScript checking and exited 2 with 12 source typing errors: nine ErrorBoundary JSX uses, number/string at UploadNewsletterModal:371, WeatherWidget:841's `sunny` condition, and missing extraction `source` in useNewsState:854. These are reported for the source workstream; dependency validation does not claim the root typecheck passes. A fresh root npm lock audit still reports zero advisories after the type additions.

## Consolidated release disposition

The Batch 4 source fixes subsequently resolved the reported TypeScript errors; both web/native checks passed in `security/release/verification.json`. No dependency audit was repeated for consolidation. Root remains clean in the reused npm result. Remaining UUID copies are production dependencies in Functions and require a compatible upstream/major review; native decode-uri-component is also a runtime dependency. Do not describe every remaining advisory as dev-only. EAS/Metro signing-tool findings are also a build-input risk. There is no owner-approved vulnerability exception yet, and no forced Expo/Firebase/UUID major upgrade is included. Keep `npm ci` lock resolution for the proposed backend deployment (`firebase.release-backend.json` excludes the alternate pnpm lock from upload); validate the final deployed resolution at the authorized build stage.
