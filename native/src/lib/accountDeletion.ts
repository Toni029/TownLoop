import AsyncStorage from '@react-native-async-storage/async-storage';
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app, auth } from './firebase';
import { reauthenticateDeletionGoogle } from './accountDeletionGoogle';

export async function requestAccountDeletion(password: string, confirmation: string): Promise<{ jobId: string; status: string }> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in first.');
  if (confirmation !== 'DELETE') throw new Error('Type DELETE exactly to confirm.');
  const providers = user.providerData.map(provider => provider.providerId);
  if (providers.includes('password') && user.email && password) {
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
  } else if (providers.includes('google.com')) {
    await reauthenticateDeletionGoogle();
  } else if (providers.includes('password')) {
    throw new Error('Enter your password to verify your identity.');
  } else {
    throw new Error('This sign-in provider needs a supported reauthentication flow before deletion.');
  }
  if (auth.currentUser?.uid !== user.uid) throw new Error('Your session changed. Sign in again.');
  await user.getIdToken(true);
  const request = httpsCallable<{ confirmation: string }, { jobId: string; status: string }>(getFunctions(app, 'us-central1'), 'requestAccountDeletion');
  return (await request({ confirmation })).data;
}

/** Exact account-scoped keys only; never clear another account's data or all AsyncStorage. */
export async function clearDeletedAccountCaches(uid: string): Promise<void> {
  await AsyncStorage.multiRemove([`townloop:home:v1:${uid}`, `townloop:social:liked:${uid}`]);
}
