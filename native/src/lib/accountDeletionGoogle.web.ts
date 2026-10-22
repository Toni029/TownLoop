import { GoogleAuthProvider, reauthenticateWithPopup } from 'firebase/auth';
import { auth } from './firebase';
export async function reauthenticateDeletionGoogle(): Promise<void> {
  if (!auth.currentUser) throw new Error('Sign in first.');
  await reauthenticateWithPopup(auth.currentUser, new GoogleAuthProvider());
}
