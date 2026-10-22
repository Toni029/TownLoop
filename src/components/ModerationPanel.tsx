import React, { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, query, where } from 'firebase/firestore';
import { app, db } from '../firebase';
import { reviewSafetyReport } from '../services/safety';
import type { UserProfile } from '../types';

type Report = { reportId: string; kind: string; reason: string; collection: string; id: string; commentId?: string };
type ReviewAction = 'dismiss' | 'resolve' | 'remove_content';

export function ModerationPanel({ currentUser }: { currentUser: UserProfile | null }) {
  const allowed = currentUser?.approved === true && ['admin', 'vip'].includes(currentUser.role);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<{ report: Report; action: ReviewAction } | null>(null);
  const [note, setNote] = useState('');
  useEffect(() => {
    setReports([]); setSelected(null); setNote(''); setStatus(''); setLoading(true);
    if (!allowed || !db) { setLoading(false); return; }
    return onSnapshot(query(collection(db, 'moderation_reports'), where('status', '==', 'open'), limit(50)), snapshot => {
      setReports(snapshot.docs.map(document => ({ ...document.data(), reportId: document.id } as Report)));
      setLoading(false);
    }, () => { setLoading(false); setStatus('Unable to load reports. Check your office access and retry.'); });
  }, [allowed, currentUser?.id]);
  if (!allowed) return null;
  const review = async () => {
    if (!selected || !app || busy) return;
    setBusy(true); setStatus('');
    try {
      await reviewSafetyReport(app, selected.report.reportId, selected.action, note.trim());
      setSelected(null); setNote(''); setStatus('Report review saved.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to review report.');
    } finally { setBusy(false); }
  };
  return <section className="space-y-4 text-stone-900 dark:text-slate-100" aria-label="Community moderation">
    <h3 className="font-bold">Open safety reports</h3>
    <p className="text-sm">Showing up to 50 open reports. Review the referenced record through authorized community tools. Private message contents are not included here.</p>
    {loading ? <p role="status">Loading reports…</p> : reports.length === 0 && <p>No open reports in this view.</p>}
    {!!status && <p role="status">{status}</p>}
    {reports.map(report => <article key={report.reportId} className="liquid-glass-subpanel rounded-xl p-4 space-y-3">
      <p className="font-bold">{report.kind} · {report.reason}</p>
      <p className="text-xs break-all">Record: {report.collection}/{report.id}{report.commentId ? ` · comment ${report.commentId}` : ''}</p>
      <div className="flex flex-wrap gap-3">
        {(['dismiss', 'resolve', ...(report.kind === 'user' ? [] : ['remove_content'])] as ReviewAction[]).map(action =>
          <button type="button" key={action} disabled={busy} className="underline min-h-11"
            onClick={() => { setSelected({ report, action }); setNote(''); setStatus(''); }}>
            {action === 'dismiss' ? 'Dismiss' : action === 'resolve' ? 'Resolve' : 'Remove content'}
          </button>)}
      </div>
      {selected?.report.reportId === report.reportId && <div className="border rounded-xl p-3 space-y-3" role="group" aria-label="Confirm report review">
        <p>{selected.action === 'remove_content' ? 'Remove this reported content? This action cannot be undone here.' : `Confirm ${selected.action} for this report?`}</p>
        <label className="block text-sm">Office review note (optional; no medical or private message details)
          <textarea value={note} onChange={event => setNote(event.target.value)} maxLength={1000} className="block w-full border rounded p-2 bg-white text-stone-900" />
        </label>
        <div className="flex gap-4">
          <button type="button" className="font-bold underline min-h-11" disabled={busy} onClick={() => void review()}>{busy ? 'Saving…' : 'Confirm review'}</button>
          <button type="button" className="underline min-h-11" disabled={busy} onClick={() => setSelected(null)}>Cancel</button>
        </div>
      </div>}
    </article>)}
  </section>;
}
