const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { initializeApp, deleteApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { assertReferenceWritesAllowed, REFERENCE_WRITE_CONTROL } = require('./referenceWriteBarrier.cjs');
if (!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) throw Error('Disposable loopback emulator required.');
const projectId = 'demo-townloop-reference-write-barrier', app = initializeApp({ projectId }, projectId);
after(() => deleteApp(app));
const media = 'https://firebasestorage.googleapis.com/v0/b/demo.test/o/shared%2Fcandidate.jpg?alt=media';
test('Firestore serializes barrier acquisition with an already-running reference writer in each database', async () => {
  for (const databaseId of ['(default)', 'townloop-test']) {
    const db = getFirestore(app, databaseId), control = db.doc(REFERENCE_WRITE_CONTROL), target = db.doc('posts/racing');
    await control.set({ referenceWritesBlocked: false }); await target.delete();
    let entered, release;
    const ready = new Promise(resolve => { entered = resolve; }), pause = new Promise(resolve => { release = resolve; });
    const writer = db.runTransaction(async tx => { await assertReferenceWritesAllowed(tx, db); entered(); await pause; tx.set(target, { photoUrl: media }); });
    await ready;
    const barrier = db.runTransaction(async tx => { await tx.get(control); tx.set(control, { referenceWritesBlocked: true }); });
    // Both operations overlap; Firestore must serialize the writer before the barrier,
    // or abort/retry it and reject on the new barrier. Either outcome is safe.
    release();
    const [write, acquire] = await Promise.allSettled([writer, barrier]);
    assert.equal(acquire.status, 'fulfilled');
    if (write.status === 'rejected') assert.equal(write.reason.code, 'failed-precondition');
    else assert.equal((await target.get()).data().photoUrl, media);
    await assert.rejects(db.runTransaction(async tx => { await assertReferenceWritesAllowed(tx, db); tx.set(db.doc('posts/blocked'), { photoUrl: media }); }), error => error.code === 'failed-precondition');
    assert.equal((await db.doc('posts/blocked').get()).exists, false);
    await control.delete(); await target.delete();
  }
});
test('newsletter start, claim and already-running output commits stop at the barrier', async () => {
  const { build } = require('../node_modules/esbuild');
  const bundle = await build({ entryPoints: ['server/newsletterJobs.ts'], bundle: true, platform: 'node', format: 'cjs', write: false, packages: 'external' });
  const module = { exports: {} }; new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(require, module, module.exports);
  const api = module.exports, db = getFirestore(app), control = db.doc(REFERENCE_WRITE_CONTROL), owner = 'manager';
  const request = { newsletterId: 'barrier-draft', isNewUpload: true }, revision = async () => 'fixture-revision', enqueue = async () => {};
  await db.doc('users/' + owner).set({ approved: true, role: 'admin' });
  await control.set({ referenceWritesBlocked: true });
  await assert.rejects(api.startNewsletterJob(owner, request, db, enqueue, revision), error => error.status === 503);
  assert.equal((await db.collection('newsletter_analysis_jobs').get()).size, 0);
  await control.set({ referenceWritesBlocked: false });
  const created = await api.startNewsletterJob(owner, request, db, enqueue, revision), task = { jobId: created.jobId, generation: 1 }, ref = db.doc('newsletter_analysis_jobs/' + created.jobId);
  await control.set({ referenceWritesBlocked: true });
  await assert.rejects(api.runNewsletterJob(task, { db, enabled: true }), error => error.status === 503);
  assert.equal((await ref.get()).data().state, 'queued');
  await control.set({ referenceWritesBlocked: false });
  const deps = { db, enabled: true, account: async () => ({ disabled: false }), revision, loadPdf: async () => 'fixture', extract: async (_, checkpoints) => {
    await checkpoints.load('fixture-hash', 1);
    // Simulates maintenance starting while the external extraction request runs.
    await control.set({ referenceWritesBlocked: true });
    await assert.rejects(checkpoints.save('fixture-hash', 0, 1, { imageUrl: media }, 'fixture'), error => error.status === 503);
    return { imageUrl: media };
  } };
  await assert.rejects(api.runNewsletterJob(task, deps), /Retryable/);
  const after = (await ref.get()).data();
  assert.equal(after.state, 'retrying'); assert.equal(after.result, undefined); assert.deepEqual(after.checkpoints, {});
  await control.delete(); await ref.delete(); await db.doc('users/' + owner).delete();
});
