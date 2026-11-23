import test from 'node:test';
import assert from 'node:assert/strict';
import { lifecycleHarness, settle } from './helpers/lifecycleHarness';

test('Cecil Pines is the only selectable community and existing placeholder selections recover', async () => {
  const saved: [string, string][] = [];
  const screen = lifecycleHarness('lib/community.tsx', () => ({
    '@react-native-async-storage/async-storage': {
      getItem: async () => 'upcoming_community',
      setItem: async (key: string, id: string) => { saved.push([key, id]); },
    },
  }));
  const render = () => screen.render(screen.exports.CommunityProvider).props.value;
  render();
  await settle();
  const state = render();
  assert.equal(state.community, 'cecil_pines');
  await assert.rejects(state.selectCommunity('upcoming_community'), /valid community/);
  assert.deepEqual(saved, []);
  await state.selectCommunity('cecil_pines');
  assert.deepEqual(saved, [['selected_community', 'cecil_pines']]);
  screen.dispose();
});
