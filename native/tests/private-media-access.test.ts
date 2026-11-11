import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveStorageMedia } from '../../src/services/storageReferences.ts';
const bucket = 'demo.firebasestorage.app';
const legacy = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/feed%2Fphoto.jpg?alt=media&token=historical-secret`;

test('historical links invoke only the authenticated object reader and never pass download tokens', async () => {
 const paths: string[] = [];
 const value = await resolveStorageMedia(legacy, bucket, async path => { paths.push(path); return 'private-temporary-file'; }, () => { throw Error('Bearer fallback'); });
 assert.equal(value, 'private-temporary-file');
 assert.deepEqual(paths, ['feed/photo.jpg']);
});
for (const reason of ['membership-revoked', 'profile-unapproved', 'role-revoked', 'storage/unauthorized']) {
 test(`${reason}: denial is final, including historical bearer URL inputs`, async () => {
  let fallback = 0;
  await assert.rejects(resolveStorageMedia(legacy, bucket, async () => { throw Error(reason); }, value => { fallback++; return value; }), new RegExp(reason));
  assert.equal(fallback, 0);
 });
}
test('unsupported owned and quarantined Inbox media never use external delivery', async () => {
 for (const value of [
  `gs://${bucket}/inbox/quarantined.jpg`,
  `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/inbox%2Fquarantined.jpg?token=historical-secret`,
  `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/%ZZ?token=historical-secret`,
 ]) {
  let read = 0, fallback = 0;
  await assert.rejects(resolveStorageMedia(value, bucket, async () => { read++; return ''; }, () => { fallback++; return ''; }), /Invalid private attachment/);
  assert.equal(read, 0); assert.equal(fallback, 0);
 }
});
test('unrelated external and local selections retain their original source', async () => {
 for (const value of ['https://example.org/photo.jpg', 'file:///cache/photo.jpg', 'content://gallery/1', 'data:image/jpeg;base64,AAAA']) {
  assert.equal(await resolveStorageMedia(value, bucket, async () => { throw Error('Unexpected private read'); }, value => value), value);
 }
});
