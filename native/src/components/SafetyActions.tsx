import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { doc, onSnapshot } from 'firebase/firestore';
import { Flag, ShieldOff } from 'lucide-react-native';
import { Action, Copy, Field, ErrorNotice } from '../news/ui';
import { ProductDialog } from './ProductDialog';
import { app, auth, db } from '../lib/firebase';
import { submitSafetyReport, setUserBlock, type SafetyTarget } from '../../../src/services/safety';
export function SafetyActions({ target, allowBlock = false }: { target: SafetyTarget; allowBlock?: boolean }) {
  const uid = auth.currentUser?.uid;
  const other = target.authorId || (target.kind === 'user' ? target.id : '');
  const [open, setOpen] = useState(false), [reason, setReason] = useState('harassment'), [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(''), [blocked, setBlocked] = useState(false);
  useEffect(() => {
    setBlocked(false);
    if (!uid || !other || uid === other || !allowBlock) return;
    return onSnapshot(doc(db, 'user_blocks', uid, 'targets', other), s => setBlocked(s.exists()), () => {});
  }, [uid, other, allowBlock]);
  if (!uid || other === uid) return null;
  async function block() {
    if (busy) return; setBusy(true); setError('');
    try { await setUserBlock(app, other, !blocked); setNotice(blocked ? 'User unblocked.' : 'Private messages blocked. Your existing history is preserved.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to update blocking.'); } finally { setBusy(false); }
  }
  return <View style={{ gap: 5 }}>
    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
      <Action compact tone="light" icon={Flag} label={target.kind === 'user' ? 'Report user' : target.kind === 'comment' ? 'Report comment' : 'Report'} onPress={() => {setError('');setOpen(true);}} />
      {allowBlock && !!other && <Action compact tone="light" icon={ShieldOff} label={blocked ? 'Unblock user' : 'Block user'} disabled={busy} onPress={() => void block()} />}
    </View>
    {!!notice && <Copy accessibilityLiveRegion="polite">{notice}</Copy>}{!!error && !open && <ErrorNotice message={error} />}
    {open && <ProductDialog title="Report a concern" onClose={() => setOpen(false)} busy={busy}>
      <Copy>Reports are reviewed by the community office. Do not include medical details or private message contents. For immediate danger, contact emergency services.</Copy>
      <View style={{ gap: 6 }}>{['harassment','spam','unsafe','privacy','other'].map(value => <Action key={value} compact tone={reason === value ? 'green' : 'light'} label={value[0].toUpperCase()+value.slice(1)} onPress={() => setReason(value)} />)}</View>
      <Field label="Additional context (optional)" value={details} onChangeText={setDetails} multiline maxLength={1000} editable={!busy}/>
      {!!error && <ErrorNotice message={error}/>}<Action label="Send report" disabled={busy} onPress={() => {
        if (busy) return; setBusy(true); setError('');
        void submitSafetyReport(app, target, reason, details).then(() => {setOpen(false);setDetails('');setNotice('Report sent to the office.');})
          .catch(e => setError(e instanceof Error ? e.message : 'Unable to report.')) .finally(() => setBusy(false));
      }}/>
    </ProductDialog>}
  </View>;
}
