import test from 'node:test';
import assert from 'node:assert/strict';
import {authenticatedStoragePath,ownsStorageReference} from '../../src/services/storageReferences.ts';
const bucket='demo.firebasestorage.app';
test('legacy Firebase token links become object paths without preserving capabilities',()=>{
 for(const path of ['work_orders/a.jpg','feed/a.jpg','marketplace/a.jpg','newsletters/current/document.pdf']){
  assert.equal(authenticatedStoragePath(`gs://${bucket}/${path}`,bucket),path);
  const link=`https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media&token=secret`;
  assert.equal(authenticatedStoragePath(link,bucket),path);assert.equal(ownsStorageReference(link,bucket),true);
 }
});
test('rejects cross-bucket, traversal, malformed and unsupported private references',()=>{
 for(const link of [`gs://other/feed/a.jpg`,`gs://${bucket}/feed/../a.jpg`,`gs://${bucket}/feed/a/b.jpg`,`gs://${bucket}/unknown/a.jpg`,`https://firebasestorage.googleapis.com/v0/b/${bucket}/o/%ZZ`])assert.equal(authenticatedStoragePath(link,bucket),null);
});

test('owned historical Firebase links with normalized authority and encoded bucket remain private', () => {
 const link=`https://FIREBASESTORAGE.GOOGLEAPIS.COM/v0/b/${encodeURIComponent(bucket).replaceAll('.', '%2E')}/o/feed%2Fa.jpg?token=old-secret`;
 assert.equal(ownsStorageReference(link,bucket),true);
 assert.equal(authenticatedStoragePath(link,bucket),'feed/a.jpg');
 for(const link of [
  `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/inbox%2Fquarantined.jpg?token=secret`,
  `https://user:password@firebasestorage.googleapis.com/v0/b/${bucket}/o/feed%2Fa.jpg?token=secret`,
  `https://firebasestorage.googleapis.com:444/v0/b/${bucket}/o/feed%2Fa.jpg?token=secret`,
  `gs://${bucket}/feed/a.jpg?token=secret`,
 ]) { assert.equal(ownsStorageReference(link,bucket),true); assert.equal(authenticatedStoragePath(link,bucket),null); }
});
