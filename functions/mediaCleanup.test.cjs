const test = require('node:test');
const assert = require('node:assert/strict');
const { linkedMedia, approvedMediaPolicy, trustedMedia } = require('./mediaCleanupPolicy.cjs');
const parent = { collection: 'work_orders', recordId: 'ticket_1', uid: 'resident_1' };
const object = { name: 'work_orders/photo.jpg', generation: '123', metadata: { securityVersion: '1', collection: 'work_orders', recordId: 'ticket_1', uploadedBy: 'crew_1' } };
test('only canonical Storage metadata authorizes linked cleanup, including crew attachments', () => {
  assert.equal(linkedMedia(object, parent), true);
  for (const value of [undefined, {}, { ...object, generation: '' }, { ...object, name: 'https://example.test/photo.jpg' },
    { ...object, name: 'feed/photo.jpg' }, { ...object, name: 'work_orders/nested/photo.jpg' },
    ...[{ recordId: 'ticket_2' }, { collection: 'posts' }, { securityVersion: '0' }, { uploadedBy: '' }].map(patch => ({ ...object, metadata: { ...object.metadata, ...patch } }))]) assert.equal(linkedMedia(value, parent), false);
});
test('unknown/legacy parent types do not authorize cleanup even with matching URL or record ID', () => {
  assert.equal(linkedMedia(object, { ...parent, collection: 'work_order_numbers' }), false);
  assert.equal(linkedMedia(object, { ...parent, uid: '' }), false);
});
test('legacy forgeable metadata cannot delete media without approved policy and server creation after secured-rules cutover', () => {
  const policy = { ownerApproved: true, approvalReference: 'review-123', trustedUploadsAfter: { toMillis: () => Date.parse('2026-10-21T12:00:00Z') },
    collections: { work_orders: { action: 'delete_linked_media_on_parent_deletion', reason: 'Approved record deletion decision' } } };
  const postCutover = { ...object, timeCreated: '2026-10-21T12:00:01Z' };
  assert.ok(approvedMediaPolicy(policy, 'work_orders')); assert.equal(trustedMedia(postCutover, parent, policy), true);
  for (const value of [undefined, {}, { ...policy, ownerApproved: false }, { ...policy, trustedUploadsAfter: '2026-10-21' }, { ...policy, collections: {} }]) assert.equal(trustedMedia(postCutover, parent, value), false);
  for (const value of [{ ...object, timeCreated: '2026-10-21T11:59:59Z' }, { ...object, metadata: { ...object.metadata, uploadedAt: '2027-01-01T00:00:00Z' } }, { ...object, timeCreated: 'untrusted' }]) assert.equal(trustedMedia(value, parent, policy), false);
});
test('detached cleanup only permits a server-redacted parent with personal/media fields absent',()=>{
 const {parentBlocksCleanup}=require('./mediaCleanupPolicy.cjs');
 const snapshot=data=>({exists:true,data:()=>data});
 assert.equal(parentBlocksCleanup(snapshot({personalDataRemoved:true,comments:[]}),{detached:true}),false);
 for(const data of [{personalDataRemoved:false},{personalDataRemoved:true,userId:'resident'},{personalDataRemoved:true,photos:['keep']},{personalDataRemoved:true,comments:[{photoUrl:'keep'}]}])assert.equal(parentBlocksCleanup(snapshot(data),{detached:true}),true);
 assert.equal(parentBlocksCleanup(snapshot({personalDataRemoved:true}),{}),true);
});
