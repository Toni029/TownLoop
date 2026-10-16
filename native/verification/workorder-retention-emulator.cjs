// Never run against a real project. This exercises the deployed scheduler handler locally.
if (!process.env.FIRESTORE_EMULATOR_HOST?.startsWith('127.0.0.1:')) throw Error('Local emulator required');
process.env.GCLOUD_PROJECT = 'demo-townloop-retention';
const { cleanupCompletedWorkOrders } = require('../../functions/index.cjs');
const dependencies = require('node:module').createRequire(require('node:path').resolve(__dirname, '../../functions/package.json'));
const { getFirestore, Timestamp } = dependencies('firebase-admin/firestore');
const assert = require('node:assert/strict');
const { RETENTION_MS } = require('../../functions/retention.cjs');
(async () => {
  const db = getFirestore();
  const collection = db.collection('work_orders');
  const old = Timestamp.fromMillis(Date.now() - RETENTION_MS - 10000);
  const data = { status:'Done', retentionVersion:1, completedAt:old, photos:['preserved-storage-reference'] };
  await Promise.all([
    collection.doc('expired').set(data),
    collection.doc('reopened').set({...data,status:'In Progress'}),
    collection.doc('recompleted').set({...data,completedAt:Timestamp.now()}),
    collection.doc('historical').set({status:'Done',completedAt:old}),
    db.doc('work_order_numbers/1000').set({orderId:'expired'}),
    db.doc('discussion_feed/unrelated').set({text:'preserve'}),
  ]);
  await cleanupCompletedWorkOrders.run({scheduleTime:new Date().toISOString()});
  assert.equal((await collection.doc('expired').get()).exists,false);
  for(const id of ['reopened','recompleted','historical']) assert.equal((await collection.doc(id).get()).exists,true);
  assert.equal((await db.doc('work_order_numbers/1000').get()).exists,true);
  assert.equal((await db.doc('discussion_feed/unrelated').get()).exists,true);
  await cleanupCompletedWorkOrders.run({scheduleTime:new Date().toISOString()});
  console.log('PASS: actual scheduled handler deletes only expired eligible tickets, preserving reopened, recompleted, historical, unrelated records and reservations.');
  await db.terminate();
})().catch(error => {console.error(error);process.exitCode=1;});
