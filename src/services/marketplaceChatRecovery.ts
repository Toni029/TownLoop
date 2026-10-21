// Local text is untrusted recovery material, never server history or identity evidence.
export const LEGACY_MARKET_CACHE = 'townloop_marketplace_chats_v1';
export type MarketDraft = { text: string; operationId: string; includePhone?: boolean };
export type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const draftKey = (uid: string, chatId: string) =>
  `townloop_marketplace_draft_v2:${encodeURIComponent(uid)}:${encodeURIComponent(chatId)}`;

export function readMarketDraft(storage: DraftStorage, uid: string, chatId: string): MarketDraft | null {
  const raw = storage.getItem(draftKey(uid, chatId));
  if (raw === null) return null;
  const value = JSON.parse(raw);
  if (!value || typeof value.text !== 'string' || typeof value.operationId !== 'string' || !value.operationId)
    throw Error('Saved draft needs recovery; it has not been changed.');
  return { text: value.text, operationId: value.operationId,
    ...(typeof value.includePhone === 'boolean' ? { includePhone: value.includePhone } : {}) };
}
export function writeMarketDraft(storage: DraftStorage, uid: string, chatId: string, draft: MarketDraft) {
  try {
    readMarketDraft(storage, uid, chatId); // Preserve malformed existing drafts rather than overwriting them.
    storage.setItem(draftKey(uid, chatId), JSON.stringify(draft));
    return true;
  } catch { return false; }
}
export function clearMarketDraft(storage: DraftStorage, uid: string, chatId: string, acknowledged: MarketDraft) {
  const current = readMarketDraft(storage, uid, chatId);
  if (current?.operationId === acknowledged.operationId && current.text === acknowledged.text)
    storage.removeItem(draftKey(uid, chatId));
}

export function recoverCachedMarketMessages(storage: DraftStorage, server: {
  id: string; sellerId: string; buyerId: string;
  messages: { id: string; senderId: string; text: string }[];
}, uid: string): MarketDraft[] {
  if (server.sellerId !== uid && server.buyerId !== uid) return [];
  const raw = storage.getItem(LEGACY_MARKET_CACHE);
  if (raw === null) return [];
  const cached = JSON.parse(raw);
  if (!Array.isArray(cached) || !Array.isArray(server.messages))
    throw Error('Local messages need review; the archive has not been changed.');
  const serverIds = new Set(server.messages.map(m => m.id));
  const sentText = new Set(server.messages.filter(m => m.senderId === uid).map(m => m.text.trim()));
  const recovered: MarketDraft[] = [];
  for (const chat of cached) {
    // Fresh server participation and exact IDs are required. No name/sanitized fallback.
    if (!chat || chat.id !== server.id || chat.sellerId !== server.sellerId ||
        chat.buyerId !== server.buyerId || !Array.isArray(chat.messages)) continue;
    for (const m of chat.messages) {
      if (!m || m.senderId !== uid || m.isSystem || typeof m.id !== 'string' ||
          !m.id || m.id.length > 180 || typeof m.text !== 'string' ||
          !m.text.trim() || m.text.length > 10000 || serverIds.has(m.id) ||
          serverIds.has(`mrec_${m.id}`) || sentText.has(m.text.trim())) continue;
      recovered.push({ text: m.text, operationId: `mrec_${m.id}` });
      serverIds.add(m.id);
      sentText.add(m.text.trim());
    }
  }
  return recovered; // Original archive is deliberately never written or deleted.
}
