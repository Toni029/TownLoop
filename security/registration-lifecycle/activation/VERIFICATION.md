# Verification for infrastructure preparation

November13,2026. Reused commit5f83f0e; no repeat broad audit.

- Red/green: the three API/worker flag tests failed against the shared flag, then passed
  after separation. Old shared flags, absent flags and wrong-project worker invocations
  cannot load policy or invoke sweep. Media queue can record a synthetic job without
  Storage access/deletion while the worker is disabled.
- 24 focused backend checks passed: lifecycleActivation, referenceWriteBarrier,
  socialMediaLifecycle, socialMediaLifecycleReadiness, accountDeletionRunner.
- 26 Auth/Firestore/Storage emulator checks passed: registrationLifecycle (15), social
  lifecycle/rules (9), existing real transaction barrier/newsletter checks (2).
  Includes approved identity preservation, no legacy expiry, exact14day expiry,
  denial/reapplication/HMAC restriction, races, Auth failure/retry, protected/shared
  media and private reference preservation. Named scope in emulators is synthetic;
  no production resident/chat/file was changed.
- Local packaging produced both isolated codebases with all four new flagsfalse,
  minInstances0 and256MiB settings. Account-deletion source, policy, rules manifests,
  root Functions exports, active Firebase config, native app and secrets unchanged.
- Fresh read-only cloud check confirmed current default/named/Storage hashes and
  active worker00005-kux. Current receipt's named hash differs, so its existing guard
  remains blocked; no receipt acknowledgment or execution test was performed.
- git diff --check passed. No native code changed in this preparation; no new binary
  or repeated native test suite was necessary. Old-version runtime/signup acceptance
  after a future rules cutover is explicitly NOT claimed; see COMPATIBILITY.md.

Not verified by these tests: live IAM grants/custom-role support, OIDC/trigger identity,
real bucket generation deletion/recovery, physical Android/iPhone behavior, live writer
source/revision provenance and arbitrary external writers. These are rollout gates,
not reasons to bypass readiness checks. Current implementation is disabled preparation.
