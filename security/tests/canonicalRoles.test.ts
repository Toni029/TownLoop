import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getUserRole, isAdmin, canCreatePost } from '../../src/utils/permissions';
import type { UserProfile } from '../../src/types';
test('privileges require explicit approved canonical role, never aliases or flags', () => {
  const user = (input: object) => input as UserProfile;
  assert.equal(getUserRole(user({ role: 'resident', approved: true, isAdmin: true, roles: ['vip'] })), 'resident');
  assert.equal(isAdmin(user({ role: 'admin', approved: false })), false);
  assert.equal(getUserRole(user({ role: 'administrator', approved: true })), '');
  assert.equal(getUserRole(user({ role: 'staff', approved: true, isAdmin: true })), '');
  assert.equal(canCreatePost(user({ role: 'resident' })), false);
  assert.equal(isAdmin(user({ role: 'admin', approved: true })), true);
});
