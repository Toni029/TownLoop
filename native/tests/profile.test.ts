import test from 'node:test';
import assert from 'node:assert/strict';
import { readProfile, friendlyError } from '../src/lib/profile.ts';

test('pending users remain pending even with a privileged role or legacy flag', () => {
  for (const role of ['resident', 'admin', 'staff', 'vip', 'crew']) {
    assert.equal(readProfile({ approved: false, role, isAdmin: true }).approved, false);
  }
});
test('approved resident and legacy display fields remain readable', () => {
  assert.deepEqual(readProfile({ approved: true, display_name: 'Alex', email: 'a@example.com', unit: '10', role: 'resident' }),
    { approved: true, name: 'Alex', email: 'a@example.com', address: '10', role: 'resident', source: { approved: true, display_name: 'Alex', email: 'a@example.com', unit: '10', role: 'resident' } });
});
test('permission and network failures produce recoverable messages', () => {
  assert.match(friendlyError({ code: 'permission-denied' }), /community office/);
  assert.match(friendlyError({ code: 'auth/network-request-failed' }), /internet connection/);
});
