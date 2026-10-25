import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Action, Copy, ErrorNotice, Field } from '../news/ui';
import { listAccountDeletionRequests, reviewAccountDeletionRequest, deletionStatusText, type DeletionReviewItem } from '../lib/accountDeletion';

/** Review only: approvals queue work; this panel never executes deletion. */
export function AccountDeletionRequests() {
  const [requests, setRequests] = useState<DeletionReviewItem[]>([]);
  const [policyReady, setPolicyReady] = useState(false);
  const [reasonCategories,setReasonCategories]=useState<Record<string,string>>({});
  const [references,setReferences]=useState<Record<string,string>>({});
  const [delayDates,setDelayDates]=useState<Record<string,string>>({});
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
  async function review(item: DeletionReviewItem, decision: 'approved' | 'rejected' | 'delayed') {
    setBusy(true); setError('');
    try { await reviewAccountDeletionRequest(item.jobId, decision, notes[item.jobId] || '', {reasonCategory:reasonCategories[item.jobId],reasonReference:references[item.jobId],delayUntil:delayDates[item.jobId]?Date.parse(delayDates[item.jobId]):undefined}); setConfirmation(''); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to review request.'); }
    finally { setBusy(false); }
  }
  return <View style={{ gap: 12 }}>
    <Copy weight="bold">Account deletion requests</Copy>
    <Copy>Oldest pending requests first, 50 per page. Review within 3 business days; unresolved requests escalate after 7 calendar days. Approval targets processing within 7 days. Workers remain held until activation.</Copy>
    {!policyReady && <Copy>Approval is held until the owner-approved retention policy is supported. Requests remain available for review or rejection.</Copy>}
    {!!error && <ErrorNotice message={error} />}
    <Action compact label={busy ? 'Loading requests…' : 'Refresh deletion requests'} disabled={busy} onPress={() => void refresh()} />
    {!busy && !requests.length && <Copy>No pending deletion requests.</Copy>}
    {!!nextCursor && <Action compact label="Next requests" disabled={busy} onPress={() => void refresh(nextCursor)} />}
    {requests.map(item => <View key={item.jobId} style={{ padding: 12, borderWidth: 1, borderColor: '#94a3b8', borderRadius: 16, gap: 8 }}>
      <Copy weight="bold">{item.name}</Copy>
      <Copy>{deletionStatusText(item)}{item.createdAt ? ` Submitted ${new Date(item.createdAt).toLocaleDateString()}.` : ''}</Copy>
      {!!item.reviewDueAt && <Copy>Review due {new Date(item.reviewDueAt).toLocaleString()}.</Copy>}
      {(item.escalated || item.processingOverdue || item.retentionOverdue) && <Copy weight="bold">Escalated — office action required; original deadlines have not been extended.</Copy>}
      {item.isOwnRequest ? <Copy>Another Admin/VIP must review this request.</Copy> : item.canReview && <>
        <Field label="Decision reason" value={notes[item.jobId] || ''} onChangeText={value => setNotes(previous => ({ ...previous, [item.jobId]: value }))} maxLength={1000} editable={!busy} />
        <Field label="Rejection/delay category (requester_withdrawal, legal_obligation, security_investigation)" value={reasonCategories[item.jobId] || ''} onChangeText={value=>setReasonCategories(p=>({...p,[item.jobId]:value.trim()}))} editable={!busy} />
        <Field label="Documented case or withdrawal reference" value={references[item.jobId] || ''} onChangeText={value=>setReferences(p=>({...p,[item.jobId]:value}))} maxLength={200} editable={!busy} />
        <Field label="Delay review date (ISO date and time with timezone)" value={delayDates[item.jobId] || ''} onChangeText={value=>setDelayDates(p=>({...p,[item.jobId]:value}))} editable={!busy} />
        {(['approved', 'rejected', 'delayed'] as const).map(decision => {
          const key = `${item.jobId}:${decision}`;
          return <Action key={decision} compact label={`${confirmation === key ? 'Confirm ' : ''}${decision === 'approved' ? 'approve request' : decision === 'delayed' ? 'document delay' : 'record requester withdrawal'}`} disabled={busy || !notes[item.jobId]?.trim() || (decision === 'approved' && !policyReady) || (decision !== 'approved' && (!references[item.jobId]?.trim() || !reasonCategories[item.jobId]))} onPress={() => confirmation === key ? void review(item, decision) : setConfirmation(key)} />;
        })}
      </>}
    </View>)}
  </View>;
}
