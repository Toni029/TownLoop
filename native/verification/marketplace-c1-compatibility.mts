// Synthetic in-memory fixtures only. No Firebase, browser data, or network access.
import assert from 'node:assert/strict';
import { hasLeft } from '../src/social/model';
import type { Chat } from '../src/social/model';

const chat = { id: 'fixture', sellerId: 'SellerUID', buyerId: 'BuyerUID',
  deletedBy: ['selleruid'], messages: [] } as unknown as Chat;
assert.equal(hasLeft(chat, 'seller'), false, 'Lossy UID aliases must not authorize leave/delete');
assert.equal(hasLeft({ ...chat, deletedBy: ['seller'] }, 'seller'), true);
assert.equal(hasLeft({ ...chat, buyerLeft: true }, 'buyer'), true);
assert.equal(hasLeft({ ...chat, sellerLeft: 'false' } as unknown as Chat, 'seller'), false);

const { recoverCachedMarketMessages, readMarketDraft, writeMarketDraft, clearMarketDraft } =
  await import('../../src/services/marketplaceChatRecovery');
const entries = new Map<string, string>();
const storage = { getItem: (k: string) => entries.get(k) ?? null,
  setItem: (k: string, v: string) => { entries.set(k, v); },
  removeItem: (k: string) => { entries.delete(k); } };
const cached = [{ ...chat, messages: [
  { id: 'sent', senderId: 'BuyerUID', text: 'Already sent' },
  { id: 'old-id', senderId: 'BuyerUID', text: 'Already sent' },
  { id: 'unsent', senderId: 'BuyerUID', text: 'Recover me' },
  { id: 'copy', senderId: 'BuyerUID', text: 'Recover me' },
  { id: 'other', senderId: 'SellerUID', text: 'Private other text' },
  { id: 'alias', senderId: 'buyeruid', text: 'Ambiguous' },
  { id: 'system', senderId: 'BuyerUID', text: 'System', isSystem: true },
] }, { ...chat, id: 'other-chat', messages: [{ id: 'wrong', senderId: 'BuyerUID', text: 'Wrong chat' }] }];
const raw = JSON.stringify(cached);
entries.set('townloop_marketplace_chats_v1', raw);
const server = { ...chat, messages: [{ id: 'sent', senderId: 'BuyerUID', text: 'Already sent' }] };
assert.deepEqual(recoverCachedMarketMessages(storage, server, 'BuyerUID').map(m => m.text), ['Recover me']);
assert.deepEqual(recoverCachedMarketMessages(storage, server, 'Outsider'), []);
assert.deepEqual(recoverCachedMarketMessages(storage, { ...server, buyerId: 'different' }, 'different'), []);
assert.equal(entries.get('townloop_marketplace_chats_v1'), raw, 'Never overwrite the legacy archive');
assert.deepEqual(recoverCachedMarketMessages(storage, { ...server, messages: [...server.messages,
  { id: 'mrec_unsent', senderId: 'BuyerUID', text: 'Recover me' }] }, 'BuyerUID'), [], 'Acknowledged recovery is not offered again');
const draft = { text: 'Unsent draft', operationId: 'stable-id' };
assert.equal(writeMarketDraft(storage, 'BuyerUID', 'fixture', draft), true);
assert.deepEqual(readMarketDraft(storage, 'BuyerUID', 'fixture'), draft);
assert.equal(readMarketDraft(storage, 'SellerUID', 'fixture'), null);
assert.equal(readMarketDraft(storage, 'BuyerUID', 'different'), null);
clearMarketDraft(storage, 'BuyerUID', 'fixture', { ...draft, operationId: 'older' });
assert.deepEqual(readMarketDraft(storage, 'BuyerUID', 'fixture'), draft, 'Old acknowledgments cannot clear newer drafts');
clearMarketDraft(storage, 'BuyerUID', 'fixture', draft);
assert.equal(readMarketDraft(storage, 'BuyerUID', 'fixture'), null);
assert.equal(entries.get('townloop_marketplace_chats_v1'), raw, 'Draft cleanup never changes the legacy archive');
const preferenceDraft = { ...draft, includePhone: false };
writeMarketDraft(storage, 'BuyerUID', 'inquiry:item', preferenceDraft);
assert.deepEqual(readMarketDraft(storage, 'BuyerUID', 'inquiry:item'), preferenceDraft);
entries.set('townloop_marketplace_chats_v1', '{malformed');
assert.throws(() => recoverCachedMarketMessages(storage, server, 'BuyerUID'));
assert.equal(entries.get('townloop_marketplace_chats_v1'), '{malformed');
const blocked = { ...storage, setItem: () => { throw Error('quota'); } };
assert.equal(writeMarketDraft(blocked, 'BuyerUID', 'fixture', draft), false);
const draftEntry = [...entries.keys()].find(k => k.includes('inquiry'))!;
entries.set(draftEntry, '{malformed');
assert.equal(writeMarketDraft(storage, 'BuyerUID', 'inquiry:item', draft), false);
assert.equal(entries.get(draftEntry), '{malformed', 'Malformed drafts require review, never silent overwrite');
console.log('PASS: C1 leave markers, account isolation, archive recovery/deduplication, draft retention and storage failures');
