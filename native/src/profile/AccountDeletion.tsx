import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { clearDeletedAccountCaches, requestAccountDeletion } from '../lib/accountDeletion';

export function AccountDeletion({ onLocalCleanup, onDeleted }: {
  onLocalCleanup?: (uid: string) => Promise<void>;
  onDeleted?: () => void;
}) {
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
      const result = await requestAccountDeletion(password, confirmation);
      setPassword(''); setAccepted(true);
      setMessage(`Deletion request accepted (${result.jobId.slice(0, 12)}). Access will be disabled. Shared history is retained pending an approved policy; deletion may require owner review.`);
      try {
        await clearDeletedAccountCaches(uid);
        await onLocalCleanup?.(uid);
      } catch {
        setMessage('Deletion request accepted. Some local data could not be removed; use this device’s app storage controls to clear it. Shared history still requires approved retention decisions.');
      } finally {
        await signOut(auth);
        onDeleted?.();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to request deletion. Please retry.');
    } finally { setBusy(false); }
  }
  return <View style={styles.card}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded(value => !value)} disabled={busy || accepted}>
      <Text style={styles.title}>Delete account</Text>
    </Pressable>
    {expanded && <View style={styles.fields}>
      <Text style={styles.body}>This requests permanent account deletion and disables access. Your private profile, push registration and sign-in account are removed after retention review. Shared conversations, work orders and community history may be retained under an approved policy. Local account data is cleared after the server accepts your request.</Text>
      {!accepted && <>
        {needsPassword && <TextInput accessibilityLabel="Current password" placeholder="Current password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} editable={!busy} style={styles.input} />}
        <TextInput accessibilityLabel="Type DELETE to confirm account deletion" placeholder="Type DELETE to confirm" value={confirmation} onChangeText={setConfirmation} autoCapitalize="characters" autoCorrect={false} editable={!busy} style={styles.input} />
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy || confirmation !== 'DELETE' }} disabled={busy || confirmation !== 'DELETE'} onPress={() => void submit()} style={[styles.button, (busy || confirmation !== 'DELETE') && styles.disabled]}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify identity and request deletion</Text>}
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
