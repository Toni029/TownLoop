import assert from 'node:assert/strict';
import { test } from 'node:test';
import { privateWorkOrderPath } from '../../src/services/mediaAuthorization';
const bucket = 'example.firebasestorage.app';
test('private WorkOrder references keep identities and strip legacy bearer tokens', () => {
  assert.equal(privateWorkOrderPath(`gs://${bucket}/work_orders/proof.jpg`, bucket), 'work_orders/proof.jpg');
  assert.equal(privateWorkOrderPath(`https://firebasestorage.googleapis.com/v0/b/${bucket}/o/work_orders%2Fproof.jpg?alt=media&token=old-token`, bucket), 'work_orders/proof.jpg');
});
test('private URL parsing rejects other buckets, hosts, schemes, namespaces and nested paths', () => {
  for (const value of [
    'gs://other/work_orders/proof.jpg',
    `https://evil.example/v0/b/${bucket}/o/work_orders%2Fproof.jpg`,
    `http://firebasestorage.googleapis.com/v0/b/${bucket}/o/work_orders%2Fproof.jpg`,
    `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/feed%2Fproof.jpg`,
    `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/work_orders%2Fextra%2Fproof.jpg`,
    `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/%ZZ`,
  ]) assert.equal(privateWorkOrderPath(value, bucket), null);
});
