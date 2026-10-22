import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planWorkOrderStorageMigration } from '../plan-workorder-storage-migration.mjs';
const bucket = 'reviewed-bucket';
test('offline migration only trusts references, detects orphans and never invents uploader', () => {
  const result = planWorkOrderStorageMigration({bucket, records: [{id: 'ticket', data: {userId: 'real-owner', photos: [`gs://${bucket}/work_orders/proof.jpg`]}}],
    objects: [{name: 'work_orders/proof.jpg', metadata: {uploadedBy: 'spoofed'}}, {name: 'work_orders/orphan.jpg'}]});
  assert.equal(result.readyForReview, false);
  assert.deepEqual(result.plan[0].mergeCustomMetadata, {securityVersion: '1', collection: 'work_orders', recordId: 'ticket'});
  assert.equal('uploadedBy' in result.plan[0].mergeCustomMetadata, false);
  assert.equal(result.blocked[0].reason, 'No verified parent reference');
});
test('shared references are blocked, not assigned arbitrarily', () => {
  const result = planWorkOrderStorageMigration({bucket, records: ['one','two'].map(id => ({id, data: {userId: id, photos: [`gs://${bucket}/work_orders/shared.jpg`]}})), objects: [{name: 'work_orders/shared.jpg'}]});
  assert.equal(result.plan.length, 0);
  assert.equal(result.blocked[0].reason, 'Ambiguous parent records');
});
