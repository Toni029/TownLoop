import {reauthenticateWithCredential} from 'firebase/auth';
import {auth} from './firebase';
import {getGoogleCredential} from './googleSignIn';
export async function reauthenticateDeletionGoogle():Promise<void>{
 const user=auth.currentUser;if(!user)throw Error('Sign in first.');
 const credential=await getGoogleCredential();if(!credential)throw Error('Google verification was canceled.');
 if(auth.currentUser?.uid!==user.uid)throw Error('Your session changed. Sign in again.');
 await reauthenticateWithCredential(user,credential);
}
