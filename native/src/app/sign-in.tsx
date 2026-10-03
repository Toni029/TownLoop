import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { friendlyError } from '../lib/profile';
import { Page, Card, Heading, Body, Field, Button, colors } from '../components/ui';
export default function SignIn() {
    const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
    async function submit(reset = false) { if (!email.trim() || (!reset && !password)) {
        setMessage('Please enter your email' + (reset ? '.' : ' and password.'));
        return;
    } setBusy(true); setMessage(''); try {
        if (reset) {
            await sendPasswordResetEmail(auth, email.trim());
            setMessage('If an account exists for this email, check your inbox for a reset link.');
        }
        else
            await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
    }
    catch (e) {
        setMessage(friendlyError(e));
    }
    finally {
        setBusy(false);
    } }
    return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><Page><View style={{ alignItems: 'center', paddingVertical: 24, gap: 8 }}><Text style={{ fontSize: 38, fontWeight: '800', color: colors.green }}>TownLoop</Text><Body>Resident Portal</Body></View><Card><Heading>Resident Sign In</Heading><Field label="Email Address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email"/><Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="current-password" onSubmitEditing={() => void submit()}/>{!!message && <Text accessibilityLiveRegion="polite">{message}</Text>}<Button title={busy ? 'Signing in…' : 'Sign In'} disabled={busy} onPress={() => void submit()}/><Pressable accessibilityRole="button" disabled={busy} onPress={() => void submit(true)} style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: colors.green, fontWeight: '600' }}>Forgot Password?</Text></Pressable></Card></Page></KeyboardAvoidingView>;
}
