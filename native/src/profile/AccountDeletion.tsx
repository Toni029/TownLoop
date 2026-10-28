import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { TextInput } from '../keyboard/KeyboardScrollView';
import { Trash2, ChevronRight } from 'lucide-react-native';
import { MotionPressable } from '../motion/Pressable';
import { DeletionRequestSuccess } from './DeletionRequestSuccess';
import { validDeletionConfirmation } from './deletionConfirmation';
import { auth } from '../lib/firebase';
import { requestAccountDeletion, getAccountDeletionStatus, deletionStatusText, type DeletionRequestStatus } from '../lib/accountDeletion';

export function AccountDeletionButton({onPress}:{onPress:()=>void}) {
  return <MotionPressable accessibilityRole="button" accessibilityLabel="Request Account Deletion" onPress={onPress} style={styles.entry}>
    <Trash2 size={21} color="#9b2929"/>
    <Text style={[styles.title,{flex:1}]}>Request Account Deletion</Text>
    <ChevronRight size={18} color="#9b2929"/>
  </MotionPressable>;
}
export function AccountDeletion({onDone}:{onDone?:()=>void}={}) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [request, setRequest] = useState<DeletionRequestStatus>({ status: 'none' });
  const accepted = request.status !== 'none';
  const [checking, setChecking] = useState(true);
  const [verifying,setVerifying]=useState(false),[success,setSuccess]=useState(false);
  const submitLock=useRef(false);
  const valid=validDeletionConfirmation(confirmation);
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
    void getAccountDeletionStatus().then(result => { if (active && auth.currentUser?.uid === uid) setRequest(result); }).catch(() => {if(active)setMessage('Unable to check request status. You can retry safely.');}).finally(()=>{if(active)setChecking(false);});
    return () => { active = false; };
  }, []);
  const needsPassword = auth.currentUser?.providerData.some(provider => provider.providerId === 'password');
  async function submit() {
    const uid = auth.currentUser?.uid;
    if (!uid || submitLock.current || checking || accepted || !valid) return;
    if(needsPassword&&!verifying){setVerifying(true);setMessage('');return;}
    if(needsPassword&&!password)return;
    submitLock.current=true;setBusy(true); setMessage('');
    try {
      const result = await requestAccountDeletion(password, confirmation);
      if (auth.currentUser?.uid !== uid) return;
      setRequest(result); setPassword('');setVerifying(false);
      if(result.status==='requested')setSuccess(true);
      else setMessage(deletionStatusText(result));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to request deletion. Please retry.');
    } finally { submitLock.current=false;setBusy(false); }
  }
  if(success)return <DeletionRequestSuccess onDone={onDone||(()=>setSuccess(false))}/>;
  const disabled=busy||checking||!valid||(verifying&&needsPassword&&!password);
  return <View style={styles.card}>
    <Text accessibilityRole="header" style={styles.title}>{verifying?'Verify your identity':'Request Account Deletion'}</Text>
    {!accepted && <View style={styles.fields}>
      {verifying ? <>
        <Text style={styles.body}>Enter your current password to securely submit your request.</Text>
        <TextInput accessibilityLabel="Current password" placeholder="Current password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} editable={!busy} style={styles.input} />
      </> : <>
        <Text style={styles.body}>Submit a verified request to permanently delete your account and associated data. Sending the request does not immediately delete your account or sign you out.</Text>
        <Text style={styles.body}>Admin/VIP review is due within 3 business days, with escalation after 7 calendar days. Approved requests target personal-data processing within 7 days. Type "DELETE" to confirm.</Text>
        <TextInput accessibilityLabel="Type DELETE to confirm the deletion request" placeholder="Type DELETE here" value={confirmation} onChangeText={setConfirmation} autoCapitalize="none" autoCorrect={false} editable={!busy} style={styles.input} />
      </>}
      <MotionPressable accessibilityRole="button" accessibilityLabel={verifying?'Verify and submit request':'Submit Deletion Request'} accessibilityState={{ disabled }} disabled={disabled} onPress={() => void submit()} style={[styles.button, disabled && styles.disabled]}>
        {busy ? <ActivityIndicator color="#fff" /> : <><Trash2 size={18} color="#fff"/><Text style={styles.buttonText}>{verifying?'Verify and submit request':'Submit Deletion Request'}</Text></>}
      </MotionPressable>
      {verifying&&<MotionPressable accessibilityRole="button" disabled={busy} onPress={()=>{setVerifying(false);setPassword('');setMessage('');}} style={styles.cancel}><Text style={styles.body}>Back</Text></MotionPressable>}
    </View>}
    {accepted && <View style={styles.fields}>
      <Text accessibilityLiveRegion="polite" style={styles.body}>{deletionStatusText(request)}{request.reason ? ` ${request.reason}` : ''}</Text>
      {!!request.reviewDueAt && <Text style={styles.body}>Review due: {new Date(request.reviewDueAt).toLocaleString()}{request.escalated ? " — escalated to the office" : ""}.</Text>}
      <MotionPressable accessibilityRole="button" accessibilityLabel="Refresh deletion request status" disabled={busy || checking} onPress={() => void refresh()} style={{minHeight:44,justifyContent:'center'}}><Text style={styles.body}>{checking ? 'Checking status…' : 'Refresh request status'}</Text></MotionPressable>
    </View>}
    {!!message && <Text accessibilityRole="alert" style={styles.body}>{message}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  entry: { minHeight:52, paddingVertical:14, paddingHorizontal:16, flexDirection:'row', alignItems:'center', gap:12, borderWidth:1, borderColor:'#e6b7b7', borderRadius:16, backgroundColor:'#fff' },
  card: { padding: 16, gap: 16, borderWidth: 1, borderColor: '#e6b7b7', borderRadius: 16, backgroundColor: '#fff' },
  cancel:{minHeight:44,justifyContent:'center',alignItems:'center'},
  title: { fontSize: 16, fontWeight: '700', color: '#9b2929' },
  fields: { gap: 12 }, body: { fontSize: 14, lineHeight: 21, color: '#4b4343' },
  input: { minHeight:48, borderWidth: 1, borderColor: '#cbbdbd', borderRadius: 8, padding: 12, color: '#241b1b' },
  button: { minHeight:48, flexDirection:'row', gap:8, alignItems:'center', justifyContent:'center', padding: 14, backgroundColor: '#b4232d', borderRadius: 8 },
  buttonText: { flexShrink:1, lineHeight:22, color: '#fff', textAlign: 'center', fontWeight: '700' }, disabled: { backgroundColor:'#8c353c',borderWidth:1,borderColor:'#6e222a' },
});
