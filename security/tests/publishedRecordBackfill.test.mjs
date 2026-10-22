import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planPublishedRecordBackfill } from '../plan-published-record-backfill.mjs';
const reviewed = {reviewedPublished: true, updateTime: '2026-10-21T12:00:00.000Z'};
test('backfill emits marker-only conditional patches for reviewed WorkOrders and social records', () => {
  const records = ['work_orders', 'discussion_feed', 'marketplace_posts', 'posts', 'marketItems'].map(collection => ({...reviewed, collection, id: 'record', data: {userId: 'owner', authorId: 'owner'}}));
  const result = planPublishedRecordBackfill({records});
  assert.equal(result.readyForReview, true);
  assert.equal(result.plan.length, 5);
  for (const item of result.plan) { assert.deepEqual(item.update, {storageDraft: false}); assert.deepEqual(item.precondition, {updateTime: reviewed.updateTime}); }
});
test('backfill never publishes drafts or changes existing markers', () => {
  const records = [true, false, 'unknown'].map((storageDraft, index) => ({...reviewed, collection: 'work_orders', id: `record${index}`, data: {userId: 'owner', storageDraft}}));
  const result = planPublishedRecordBackfill({records});
  assert.equal(result.plan.length, 0);
  assert.equal(result.skipped.length, 2);
  assert.equal(result.blocked.length, 1);
});
test('unreviewed, ownerless and unsupported records fail closed', () => {
  const result = planPublishedRecordBackfill({records: [
    {collection: 'work_orders', id: 'unreviewed', data: {userId: 'owner'}},
    {...reviewed, collection: 'posts', id: 'ownerless', data: {}},
    {...reviewed, collection: 'users', id: 'unsupported', data: {userId: 'owner'}},
  ]});
  assert.equal(result.plan.length, 0);
  assert.equal(result.blocked.length, 3);
});
