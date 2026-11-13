import {signOut,type User} from 'firebase/auth';
import {doc,runTransaction,serverTimestamp} from 'firebase/firestore';
import {TERMS_VERSION,requireTermsAcceptance} from '../../../src/data/legal';
import {auth,db} from './firebase';
/** Preserve existing approvals/roles; new Google residents enter the normal approval workflow. */
export async function finishGoogleSignIn(user:User,termsAccepted:boolean){
 try {
  if(auth.currentUser?.uid!==user.uid)throw Error('Your session changed. Sign in again.');
  const reference=doc(db,'users',user.uid);
  await runTransaction(db,async transaction=>{
   const profile=await transaction.get(reference);
   if(auth.currentUser?.uid!==user.uid)throw Error('Your session changed. Sign in again.');
   if(profile.exists())return;
   requireTermsAcceptance(termsAccepted);
   if(!user.email)throw Error('Google did not provide an email address. Please use email sign-in.');
   transaction.set(reference,{
    id:user.uid,name:user.displayName||'Resident',email:user.email,
    role:'resident',approved:false,address:'',avatarUrl:user.photoURL||'',
    termsVersion:TERMS_VERSION,termsAcceptedAt:serverTimestamp(),createdAt:new Date().toISOString(),
   });
  });
 }catch(error){
  if(auth.currentUser?.uid===user.uid)await signOut(auth);
  throw error;
 }
}
