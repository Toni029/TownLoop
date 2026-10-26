import {Platform,TurboModuleRegistry} from 'react-native';
import {GoogleAuthProvider,signInWithCredential} from 'firebase/auth';
import config from '../../google-auth.json';
import {auth} from './firebase';
import {finishGoogleSignIn} from './googleProfile';
const platformReady=Platform.OS==='android'?config.androidOAuthRegistered:Platform.OS==='ios'&&config.iosOAuthRegistered&&!!config.iosClientId;
// Never load a native SDK absent from the installed APK, or offer an unconfigured provider.
export const googleSignInAvailable=!!platformReady&&!!TurboModuleRegistry.get('RNGoogleSignin');
let configured=false;
export async function getGoogleCredential(){
 if(!googleSignInAvailable)throw Error('Google sign-in needs the configured Google-enabled app build. Email sign-in remains available.');
 const {GoogleSignin,isSuccessResponse,statusCodes}=require('@react-native-google-signin/google-signin') as typeof import('@react-native-google-signin/google-signin');
 if(!configured){GoogleSignin.configure({webClientId:config.webClientId,iosClientId:config.iosClientId||undefined,offlineAccess:false});configured=true;}
 try {
  if(Platform.OS==='android')await GoogleSignin.hasPlayServices({showPlayServicesUpdateDialog:true});
  const response=await GoogleSignin.signIn();
  if(!isSuccessResponse(response))return null;
  if(!response.data.idToken)throw Error('Google did not return a sign-in token. Please try again.');
  return GoogleAuthProvider.credential(response.data.idToken);
 }catch(error){
  if((error as {code?:string})?.code===statusCodes.SIGN_IN_CANCELLED)return null;
  throw error;
 }
}
export async function googleSignIn(termsAccepted=false):Promise<void>{
 const credential=await getGoogleCredential();if(!credential)return;
 const {user}=await signInWithCredential(auth,credential);
 await finishGoogleSignIn(user,termsAccepted);
}
