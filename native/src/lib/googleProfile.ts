import {signOut,type User} from 'firebase/auth';
import {doc,getDoc} from 'firebase/firestore';
import {requireTermsAcceptance} from '../../../src/data/legal';
import {auth,db} from './firebase';
import {submitResidentRegistration} from './registration';
/** Existing profiles retain their approval and roles without a registration write. */
export async function finishGoogleSignIn(user:User,termsAccepted:boolean){
 try {
  if(auth.currentUser?.uid!==user.uid)throw Error('Your session changed. Sign in again.');
  const profile=await getDoc(doc(db,'users',user.uid));
  if(auth.currentUser?.uid!==user.uid)throw Error('Your session changed. Sign in again.');
  if(profile.exists())return;
  requireTermsAcceptance(termsAccepted);
  if(!user.email)throw Error('Google did not provide an email address. Please use email sign-in.');
  await submitResidentRegistration({name:user.displayName||'Resident',address:'',phone:'',emergencyContactName:'',emergencyContactPhone:'',emergencyContactAddress:'',avatarUrl:user.photoURL||'',termsAccepted:true});
 }catch(error){
  if(auth.currentUser?.uid===user.uid)await signOut(auth);
  throw error;
 }
}
