import React, { useRef, useState } from 'react';
import { Send } from 'lucide-react';
import type { UserProfile } from '../../types';
import type { MarketplaceChat } from '../../services/marketplaceChatTypes';
import { recoverMarketplaceDrafts, sendMarketplaceReply } from '../../services/marketplaceChat';
import { clearMarketDraft, readMarketDraft, writeMarketDraft, type MarketDraft } from '../../services/marketplaceChatRecovery';

const newDraft = (text = ''): MarketDraft => ({ text, operationId: `mmsg_${crypto.randomUUID()}` });
const storage = () => { try { return window.localStorage; } catch { return null; } };

/** Keyed by exact UID + chat: switching accounts/conversations never reuses another draft. */
export function MarketplaceReplyComposer({ chat, user, onSent }: {
  chat: MarketplaceChat; user: UserProfile; onSent: (chat: MarketplaceChat) => void;
}) {
  const uid = String(user.id);
  const [initial] = useState(() => {
    try {
      const store = storage();
      return { draft: store && readMarketDraft(store, uid, chat.id) || newDraft(), warning: !store };
    } catch { return { draft: newDraft(), warning: true }; }
  });
  const [draft, setDraft] = useState(initial.draft);
  const [notice, setNotice] = useState(initial.warning ? 'Local drafts are unavailable. Keep this window open until your message is sent.' : '');
  const [recovered, setRecovered] = useState<MarketDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);

  const update = (next: MarketDraft) => {
    setDraft(next);
    const store = storage();
    setNotice(store && writeMarketDraft(store, uid, chat.id, next)
      ? '' : 'Draft could not be saved locally. Keep this window open until your message is sent.');
  };
  const recover = async () => {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    try {
      const store = storage();
      if (!store) throw Error('Local storage is unavailable.');
      const found = await recoverMarketplaceDrafts(chat.id, user, store);
      setRecovered(found);
      setNotice(found.length ? 'Choose your local text to restore. Nothing is sent until you press Send.'
        : 'No additional text could be safely recovered for this conversation. The original local archive is unchanged.');
    } catch {
      setNotice('Local recovery is unavailable. Check your connection and account access. Your local archive has not been changed.');
    } finally { submitting.current = false; setBusy(false); }
  };
  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting.current || !draft.text.trim()) return;
    submitting.current = true;
    setBusy(true);
    const attempt = draft;
    try {
      const updated = await sendMarketplaceReply({ chat, sender: user, text: attempt.text, messageId: attempt.operationId });
      let cleared = false;
      try {
        const store = storage();
        if (store) { clearMarketDraft(store, uid, chat.id, attempt); cleared = true; }
      } catch { /* Preserve original data if storage fails; same operation ID makes retry safe. */ }
      setDraft(newDraft());
      setRecovered([]);
      setNotice(cleared ? '' : 'Message sent. Local draft cleanup was unavailable; retrying that saved draft will not send it twice.');
      onSent(updated);
    } catch {
      setNotice('Message was not confirmed. Your text is still here; retry Send when connected.');
    } finally { submitting.current = false; setBusy(false); }
  };
  return <div className="pt-2 border-t border-stone-200/80 dark:border-slate-800/80 shrink-0">
    {notice && <p role="status" className="text-[11px] text-stone-500 dark:text-slate-400 mb-1">{notice}</p>}
    {recovered.length > 0 && <div className="max-h-24 overflow-y-auto mb-1 space-y-1" aria-label="Recover local messages">
      {recovered.map(candidate => <button key={candidate.operationId} type="button"
        disabled={busy || !!draft.text.trim()} title="Restore this text to the empty composer"
        onClick={() => { update(candidate); setRecovered([]); }}
        className="block w-full text-left whitespace-pre-wrap rounded-xl px-2 py-1 text-xs bg-stone-100 dark:bg-slate-800 disabled:opacity-40">
        {candidate.text}
      </button>)}
      {draft.text.trim() && <p className="text-[11px]">Your current draft is kept. Send it or clear the composer before restoring another message.</p>}
    </div>}
    <form onSubmit={send} className="flex items-center gap-2">
      <input type="text" value={draft.text} disabled={busy} maxLength={10000}
        onChange={e => update(newDraft(e.target.value))} placeholder="Type a message to buyer/seller..."
        aria-label="Marketplace message"
        className="flex-1 min-w-0 px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm bg-stone-100/90 dark:bg-slate-800/90 text-stone-900 dark:text-slate-100 placeholder-stone-400 dark:placeholder-slate-500 border border-stone-200/80 dark:border-slate-700/80 focus:outline-none focus:ring-2 focus:ring-emerald-500/40" />
      <button type="submit" disabled={busy || !draft.text.trim()} aria-label="Send message"
        className="p-2.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white transition cursor-pointer shrink-0 shadow-2xs flex items-center justify-center">
        <Send className="w-4 h-4" />
      </button>
    </form>
    <button type="button" disabled={busy} onClick={recover}
      className="text-[11px] text-stone-500 dark:text-slate-400 hover:underline mt-1 disabled:opacity-40">Recover local message</button>
  </div>;
}
