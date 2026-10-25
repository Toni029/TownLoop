import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Action, Copy, ErrorNotice, Field } from '../news/ui';
import { listAccountDeletionRequests, reviewAccountDeletionRequest, deletionStatusText, type DeletionReviewItem } from '../lib/accountDeletion';

/** Review only: approvals queue work; this panel never executes deletion. */
export function AccountDeletionRequests() {
  const [requests, setRequests] = useState<DeletionReviewItem[]>([]);
  const [policyReady, setPolicyReady] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function refresh(cursor?: string) {
    setBusy(true); setError('');
    try { const result = await listAccountDeletionRequests(cursor); setRequests(result.requests); setPolicyReady(result.policyReady); setNextCursor(result.nextCursor); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to load requests.'); }
    finally { setBusy(false); }
  }
  useEffect(() => { void refresh(); }, []);
  async function review(item: DeletionReviewItem, decision: 'approved' | 'rejected') {
    setBusy(true); setError('');
    try { await reviewAccountDeletionRequest(item.jobId, decision, notes[item.jobId] || ''); setConfirmation(''); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to review request.'); }
    finally { setBusy(false); }
  }
  return <View style={{ gap: 12 }}>
    <Copy weight="bold">Account deletion requests</Copy>
    <Copy>Oldest pending requests first, 50 per page. Review regularly; requests never delete an account automatically.</Copy>
    {!policyReady && <Copy>Approval is held until the owner-approved retention policy is supported. Requests remain available for review or rejection.</Copy>}
    {!!error && <ErrorNotice message={error} />}
    <Action compact label={busy ? 'Loading requests…' : 'Refresh deletion requests'} disabled={busy} onPress={() => void refresh()} />
    {!busy && !requests.length && <Copy>No pending deletion requests.</Copy>}
    {!!nextCursor && <Action compact label="Next requests" disabled={busy} onPress={() => void refresh(nextCursor)} />}
    {requests.map(item => <View key={item.jobId} style={{ padding: 12, borderWidth: 1, borderColor: '#94a3b8', borderRadius: 16, gap: 8 }}>
      <Copy weight="bold">{item.name}</Copy>
      <Copy>{deletionStatusText(item)}{item.createdAt ? ` Submitted ${new Date(item.createdAt).toLocaleDateString()}.` : ''}</Copy>
      {item.isOwnRequest ? <Copy>Another Admin/VIP must review this request.</Copy> : item.canReview && <>
        <Field label="Decision reason" value={notes[item.jobId] || ''} onChangeText={value => setNotes(previous => ({ ...previous, [item.jobId]: value }))} maxLength={1000} editable={!busy} />
        {(['approved', 'rejected'] as const).map(decision => {
          const key = `${item.jobId}:${decision}`;
          return <Action key={decision} compact label={`${confirmation === key ? 'Confirm ' : ''}${decision === 'approved' ? 'approve request' : 'reject request'}`} disabled={busy || !notes[item.jobId]?.trim() || (decision === 'approved' && !policyReady)} onPress={() => confirmation === key ? void review(item, decision) : setConfirmation(key)} />;
        })}
      </>}
    </View>)}
  </View>;
}
