const { test } = require('node:test');
const assert = require('node:assert/strict');
const { recipients, appendedMessage, member } = require('./inbox-policy.cjs');
const users = ['resident', 'other', 'admin', 'vip', 'crew'].map(role => ({ id: role, role: role === 'other' ? 'resident' : role, approved: true, email: `${role}@example.test` }));
const chat = { residentId: 'resident', residentEmail: 'resident@example.test' };
test('Office and Crew recipients stay isolated, including staff replies', () => {
  assert.deepEqual(recipients('office_chats', chat, users, 'resident').map(p => p.id), ['admin', 'vip']);
  assert.deepEqual(recipients('maintenance_chats', chat, users, 'resident').map(p => p.id), ['crew']);
  assert.deepEqual(recipients('maintenance_chats', chat, users, 'crew').map(p => p.id), ['resident']);
  assert.deepEqual(recipients('office_chats', chat, users, 'vip').map(p => p.id), ['resident', 'admin']);
});
test('Friends only notify participants; unapproved recipients are excluded', () => {
  assert.deepEqual(recipients('resident_chats', { identityVersion: 2, participantIds: ['resident', 'other'] }, users, 'resident').map(p => p.id), ['other']);
  assert.deepEqual(recipients('office_chats', chat, users.map(p => ({ ...p, approved: false })), 'resident'), []);
});
test('Only new messages from the authenticated author qualify, not receipts, replay, forged authors or history replacements', () => {
  const msg = { id: 'one', senderId: 'resident', senderRole: 'resident', senderName: 'Resident', body: 'Hello' }, sender = users[0];
  assert.equal(appendedMessage(null, { messages: [msg] }, sender), msg);
  assert.equal(appendedMessage({ messages: [msg] }, { messages: [{ ...msg, readBy: ['crew'] }] }, sender), null);
  assert.equal(appendedMessage({ messages: [msg] }, { messages: [msg, msg] }, sender), null);
  assert.equal(appendedMessage(null, { messages: [{ ...msg, senderId: 'admin' }] }, sender), null);
  assert.equal(appendedMessage({ messages: [msg] }, { messages: [{ ...msg, id: 'fake' }, { ...msg, id: 'two' }] }, sender), null);
});

test('Aliases, unversioned friend membership and noncanonical roles never grant access', () => {
  const user = users[0];
  assert.equal(member('resident_chats', {participantIds:[user.id]}, user), false);
  assert.equal(member('resident_chats', {identityVersion:2,participantIds:[user.email]}, user), false);
  assert.equal(member('resident_chats', {identityVersion:2,participantIds:[user.id.toUpperCase()]}, user), false);
  assert.equal(member('office_chats', {residentId:'someone-else',residentEmail:user.email}, user), false);
  assert.equal(member('office_chats', chat, {...user,role:'staff',isAdmin:true}), false);
});
test('Appending cannot replace a historical body, receipt or sender snapshot', () => {
  const sender = users[0], old = {id:'one',senderId:sender.id,senderName:'Resident',senderRole:'resident',body:'Original'};
  const next = {...old,id:'two',body:'Next'};
  for (const patch of [{body:'Edited'},{senderId:'admin'},{readBy:['forged-reader']}])
    assert.equal(appendedMessage({messages:[old]},{messages:[{...old,...patch},next]},sender),null);
  assert.equal(appendedMessage({messages:[old]},{messages:[old,next]},sender),next);
  assert.equal(appendedMessage(null,{messages:[{...next,senderRole:'admin'}]},sender),null);
});
