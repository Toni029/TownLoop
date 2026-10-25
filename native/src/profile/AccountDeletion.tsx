import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { TextInput } from '../keyboard/KeyboardScrollView';
import { auth } from '../lib/firebase';
import { requestAccountDeletion, getAccountDeletionStatus, deletionStatusText, type DeletionRequestStatus } from '../lib/accountDeletion';

export function AccountDeletion() {
  const [expanded, setExpanded] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [request, setRequest] = useState<DeletionRequestStatus>({ status: 'none' });
  const accepted = request.status !== 'none';
  const [checking, setChecking] = useState(false);
  async function refresh() {
    const uid = auth.currentUser?.uid;
    setChecking(true);
    try { const result = await getAccountDeletionStatus(); if (auth.currentUser?.uid === uid) setRequest(result); }
    catch { setMessage('Unable to check your request status. Retry or contact the community office.'); }
    finally { setChecking(false); }
  }
  useEffect(() => {
    let active = true;
    const uid = auth.currentUser?.uid;
    void getAccountDeletionStatus().then(result => { if (active && auth.currentUser?.uid === uid) setRequest(result); }).catch(() => {});
    return () => { active = false; };
  }, []);
  const needsPassword = auth.currentUser?.providerData.some(provider => provider.providerId === 'password');
  async function submit() {
    const uid = auth.currentUser?.uid;
    if (!uid || busy || accepted) return;
    setBusy(true); setMessage('');
    try {
      const result = await requestAccountDeletion(password, confirmation);
      if (auth.currentUser?.uid !== uid) return;
      setRequest(result); setPassword('');
      setMessage(deletionStatusText(result));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to request deletion. Please retry.');
    } finally { setBusy(false); }
  }
  return <View style={styles.card}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded(value => !value)} disabled={busy}>
      <Text style={styles.title}>Request Account Deletion</Text>
    </Pressable>
    {expanded && <View style={styles.fields}>
      <Text style={styles.body}>Submit a verified request to permanently delete your account and associated data. Sending the request does not immediately delete your account or sign you out. Admin/VIP review is due within 3 business days, with escalation after 7 calendar days. Approved requests target personal-data processing within 7 days. Ordinary retention/redaction is limited to 60 days from the request. Verified local data is cleared when this device next connects; offline copies cannot be erased remotely.</Text>
      {!accepted && <>
        {needsPassword && <TextInput accessibilityLabel="Current password" placeholder="Current password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} editable={!busy} style={styles.input} />}
        <TextInput accessibilityLabel="Type DELETE to confirm the deletion request" placeholder="Type DELETE to confirm" value={confirmation} onChangeText={setConfirmation} autoCapitalize="characters" autoCorrect={false} editable={!busy} style={styles.input} />
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy || confirmation !== 'DELETE' }} disabled={busy || confirmation !== 'DELETE'} onPress={() => void submit()} style={[styles.button, (busy || confirmation !== 'DELETE') && styles.disabled]}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Confirm Deletion Request</Text>}
        </Pressable>
      </>}
    </View>}
    {accepted && <Text accessibilityLiveRegion="polite" style={styles.body}>{deletionStatusText(request)}{request.reason ? ` ${request.reason}` : ''}</Text>}
    {accepted && !!request.reviewDueAt && <Text style={styles.body}>Review due: {new Date(request.reviewDueAt).toLocaleString()}{request.escalated ? " — escalated to the office" : ""}.</Text>}
    <Pressable accessibilityRole="button" accessibilityLabel="Refresh deletion request status" disabled={busy || checking} onPress={() => void refresh()}><Text style={styles.body}>{checking ? 'Checking status…' : 'Refresh request status'}</Text></Pressable>
    {!!message && <Text accessibilityRole="alert" style={styles.body}>{message}</Text>}
  </View>;
}
const styles = StyleSheet.create({
  card: { padding: 16, gap: 12, borderWidth: 1, borderColor: '#e6b7b7', borderRadius: 14, backgroundColor: '#fff' },
  title: { fontSize: 16, fontWeight: '700', color: '#9b2929' },
  fields: { gap: 12 }, body: { fontSize: 14, lineHeight: 21, color: '#4b4343' },
  input: { borderWidth: 1, borderColor: '#cbbdbd', borderRadius: 8, padding: 12, color: '#241b1b' },
  button: { padding: 14, backgroundColor: '#9b2929', borderRadius: 8 },
  buttonText: { color: '#fff', textAlign: 'center', fontWeight: '700' }, disabled: { opacity: 0.45 },
});
