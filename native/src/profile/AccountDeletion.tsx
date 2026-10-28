import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { TextInput } from '../keyboard/KeyboardScrollView';
import { Trash2, ChevronRight } from 'lucide-react-native';
import { MotionPressable } from '../motion/Pressable';
import { auth } from '../lib/firebase';
import { requestAccountDeletion, getAccountDeletionStatus, deletionStatusText, type DeletionRequestStatus } from '../lib/accountDeletion';

export function AccountDeletionButton({onPress}:{onPress:()=>void}) {
  return <MotionPressable accessibilityRole="button" accessibilityLabel="Request Account Deletion" onPress={onPress} style={styles.entry}>
    <Trash2 size={21} color="#9b2929"/>
    <Text style={[styles.title,{flex:1}]}>Request Account Deletion</Text>
    <ChevronRight size={18} color="#9b2929"/>
  </MotionPressable>;
}
export function AccountDeletion() {
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
    if (!uid || busy || accepted || confirmation !== 'DELETE') return;
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
    <Text accessibilityRole="header" style={styles.title}>Request Account Deletion</Text>
    {!accepted && <View style={styles.fields}>
      <Text style={styles.body}>Type DELETE below to confirm your request.</Text>
      {needsPassword && <TextInput accessibilityLabel="Current password" placeholder="Current password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} editable={!busy} style={styles.input} />}
      <TextInput accessibilityLabel="Type DELETE to confirm the deletion request" placeholder="DELETE" value={confirmation} onChangeText={setConfirmation} autoCapitalize="characters" autoCorrect={false} editable={!busy} style={styles.input} />
      <Pressable accessibilityRole="button" accessibilityLabel="Submit Deletion Request" accessibilityState={{ disabled: busy || confirmation !== 'DELETE' }} disabled={busy || confirmation !== 'DELETE'} onPress={() => void submit()} style={[styles.button, (busy || confirmation !== 'DELETE') && styles.disabled]}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Submit Deletion Request</Text>}
      </Pressable>
      <Text style={styles.clarification}>Your account will not be deleted immediately. Your request will be reviewed.</Text>
    </View>}
    {accepted && <View style={styles.fields}>
      <Text accessibilityLiveRegion="polite" style={styles.body}>{deletionStatusText(request)}{request.reason ? ` ${request.reason}` : ''}</Text>
      {!!request.reviewDueAt && <Text style={styles.body}>Review due: {new Date(request.reviewDueAt).toLocaleString()}{request.escalated ? " — escalated to the office" : ""}.</Text>}
      <Pressable accessibilityRole="button" accessibilityLabel="Refresh deletion request status" disabled={busy || checking} onPress={() => void refresh()} style={{minHeight:44,justifyContent:'center'}}><Text style={styles.body}>{checking ? 'Checking status…' : 'Refresh request status'}</Text></Pressable>
    </View>}
    {!!message && <Text accessibilityRole="alert" style={styles.body}>{message}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  entry: { minHeight:52, paddingVertical:14, paddingHorizontal:16, flexDirection:'row', alignItems:'center', gap:12, borderWidth:1, borderColor:'#e6b7b7', borderRadius:16, backgroundColor:'#fff' },
  card: { padding: 16, gap: 16, borderWidth: 1, borderColor: '#e6b7b7', borderRadius: 16, backgroundColor: '#fff' },
  clarification: { fontSize:12, lineHeight:18, color:'#6b6161' },
  title: { fontSize: 16, fontWeight: '700', color: '#9b2929' },
  fields: { gap: 12 }, body: { fontSize: 14, lineHeight: 21, color: '#4b4343' },
  input: { minHeight:48, borderWidth: 1, borderColor: '#cbbdbd', borderRadius: 8, padding: 12, color: '#241b1b' },
  button: { minHeight:48, justifyContent:'center', padding: 14, backgroundColor: '#9b2929', borderRadius: 8 },
  buttonText: { color: '#fff', textAlign: 'center', fontWeight: '700' }, disabled: { opacity: 0.45 },
});
