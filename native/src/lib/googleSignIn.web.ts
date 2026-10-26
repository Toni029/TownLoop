import {GoogleAuthProvider,signInWithPopup} from 'firebase/auth';
import {auth} from './firebase';
import {finishGoogleSignIn} from './googleProfile';
export const googleSignInAvailable=true;
export async function googleSignIn(termsAccepted=false){
 const {user}=await signInWithPopup(auth,new GoogleAuthProvider());
 await finishGoogleSignIn(user,termsAccepted);
}
