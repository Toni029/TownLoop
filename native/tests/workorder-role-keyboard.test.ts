import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canDeleteWorkOrder, canTranslateWorkOrder } from '../../src/utils/permissions.ts';
import { displayWorkOrderCode } from '../../src/data/workOrderNumber.ts';
import { revealOffset } from '../src/keyboard/geometry.ts';
import type { UserProfile } from '../../src/types';
test('work order role and ownership matrix preserves manager privileges', () => {
  for (const role of ['admin','vip','crew','resident'] as const) {
    const user = { id:'owner', role, approved:true } as UserProfile;
    assert.equal(canTranslateWorkOrder(user), role !== 'resident');
    for (const status of ['Queued','In Progress','Done']) for (const owner of ['owner','other']) {
      assert.equal(canDeleteWorkOrder({ status, userId:owner }, user), ['admin','vip'].includes(role) || (role==='resident' && status!=='Done' && owner==='owner'));
    }
  }
  assert.equal(canTranslateWorkOrder({role:'crew',approved:false} as UserProfile),false);
});
test('display prefix does not change numeric assignment or legacy IDs', () => {
  for(const n of [1000,1001,1888,8888,9999]) assert.equal(displayWorkOrderCode(String(n)),`WO-${n}`);
  assert.equal(displayWorkOrderCode('WO-1000'),'WO-1000');
  assert.equal(displayWorkOrderCode('WO-10000'),'WO-10000');
});
test('keyboard scrolling reveals bottom fields without moving already-visible fields', () => {
  assert.equal(revealOffset(0,100,600,500,450,50),16);
  assert.equal(revealOffset(100,100,400,500,200,50),100);
  assert.equal(revealOffset(100,100,400,500,90,50),82);
  assert.equal(revealOffset(0,100,400,500,450,300),266);
  assert.equal(revealOffset(0,100,400,80,450,50),0);
});

test('comment focus keeps its Send action visible on small and resized keyboard viewports',()=>{
  assert.equal(revealOffset(0,100,600,500,450,50,56),72);
  assert.equal(revealOffset(100,100,400,500,200,90,56),100);
  assert.equal(revealOffset(0,100,600,500,450,120,56),142);
});

test('Crew resolution uses the keyboard-aware viewport and gives the completion controls room', () => {
  const source = readFileSync(new URL('../src/workorders/WorkOrdersFeed.tsx', import.meta.url), 'utf8');
  assert.match(source, /<ScrollView\s+refreshControl=[\s\S]*?\bextraKeyboardSpace\b[\s\S]*?keyboardShouldPersistTaps="handled"/);
  const field = source.match(/<TextInput accessibilityLabel="Resolution Note \/ Description \*"[^>]*keyboardActionSpace=\{(\d+)\}/);
  assert.ok(field, 'Reserve space after the focused resolution note');
  const actionSpace = Number(field[1]);
  for (const height of [400, 650]) {
    const keyboardTop = 500, inputTop = 465, inputHeight = 90;
    const offset = revealOffset(0, 80, height, keyboardTop, inputTop, inputHeight, actionSpace);
    assert.ok(inputTop + inputHeight + actionSpace - offset <= Math.min(80 + height, keyboardTop) - 16);
  }
});
