import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { TextInput } from '../keyboard/KeyboardScrollView';
import { auth } from '../lib/firebase';
import { requestAccountDeletion } from '../lib/accountDeletion';

export function AccountDeletion() {
  const [expanded, setExpanded] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [accepted, setAccepted] = useState(false);
  const needsPassword = auth.currentUser?.providerData.some(provider => provider.providerId === 'password');
  async function submit() {
    const uid = auth.currentUser?.uid;
    if (!uid || busy || accepted) return;
    setBusy(true); setMessage('');
    try {
      await requestAccountDeletion(password, confirmation);
      setPassword(''); setAccepted(true);
      setMessage('Your account deletion request was submitted. You can continue using TownLoop while it is reviewed and prepared for processing. You do not need to send it again.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to request deletion. Please retry.');
    } finally { setBusy(false); }
  }
  return <View style={styles.card}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded(value => !value)} disabled={busy || accepted}>
      <Text style={styles.title}>Request Account Deletion</Text>
    </Pressable>
    {expanded && <View style={styles.fields}>
      <Text style={styles.body}>Submit a verified request to permanently delete your account and associated data. Sending the request does not immediately delete your account or sign you out. Shared records are handled under the approved retention policy when processing begins.</Text>
      {!accepted && <>
        {needsPassword && <TextInput accessibilityLabel="Current password" placeholder="Current password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} editable={!busy} style={styles.input} />}
        <TextInput accessibilityLabel="Type DELETE to confirm the deletion request" placeholder="Type DELETE to confirm" value={confirmation} onChangeText={setConfirmation} autoCapitalize="characters" autoCorrect={false} editable={!busy} style={styles.input} />
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy || confirmation !== 'DELETE' }} disabled={busy || confirmation !== 'DELETE'} onPress={() => void submit()} style={[styles.button, (busy || confirmation !== 'DELETE') && styles.disabled]}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Confirm Deletion Request</Text>}
        </Pressable>
      </>}
    </View>}
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
