import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { collection, limit, onSnapshot, query, where } from 'firebase/firestore';
import { Action, Copy, Field, ErrorNotice } from '../news/ui';
import { app, db } from '../lib/firebase';
import { reviewSafetyReport } from '../../../src/services/safety';
export function ModerationPanel() {
  const [reports, setReports] = useState<Array<Record<string, any>>>([]), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false), [notes, setNotes] = useState<Record<string,string>>({}), [confirm, setConfirm] = useState('');
  useEffect(() => onSnapshot(query(collection(db, 'moderation_reports'), where('status', '==', 'open'), limit(50)), snapshot => {
    setReports(snapshot.docs.map(d => ({...d.data(),reportId:d.id})));setLoading(false);
  }, e => {setLoading(false);setError(e.message);}), []);
  async function review(reportId: string, action: string) {
    if (busy) return;setBusy(true);setError('');
    try {await reviewSafetyReport(app, reportId, action, notes[reportId] || '');setConfirm('');}
    catch (e) {setError(e instanceof Error ? e.message : 'Unable to review report.');} finally {setBusy(false);}
  }
  return <View style={{gap:12}}><Copy weight="bold">Safety reports</Copy><Copy>Review context before taking action. No account is automatically suspended. Up to 50 open reports are shown; reviewed reports remain in the backend audit.</Copy>
    {!!error && <ErrorNotice message={error}/>}<Copy>{loading ? 'Loading reports…' : !reports.length ? 'No open reports.' : `${reports.length} open reports`}</Copy>
    {reports.map(report => <View key={report.reportId} style={{padding:12,borderWidth:1,borderColor:'#94a3b8',borderRadius:16,gap:8}}>
      <Copy weight="bold">{report.kind}: {report.reason}</Copy><Copy selectable>{report.collection}/{report.id}{report.commentId ? ` • Comment ${report.commentId}` : ''}</Copy>
      {!!report.details && <Copy>{report.details}</Copy>}<Field label="Review note" value={notes[report.reportId] || ''} onChangeText={value => setNotes({...notes,[report.reportId]:value})} maxLength={1000}/>
      <View style={{gap:6}}><Action compact label="Dismiss report" disabled={busy} onPress={() => void review(report.reportId,'dismiss')}/><Action compact label="Mark handled" disabled={busy} onPress={() => void review(report.reportId,'resolve')}/>
      {report.kind !== 'user' && <Action compact tone="rose" label={confirm === report.reportId ? 'Confirm remove reported content' : 'Remove reported content…'} disabled={busy} onPress={() => confirm === report.reportId ? void review(report.reportId,'remove_content') : setConfirm(report.reportId)}/>}</View>
    </View>)}
  </View>;
}
