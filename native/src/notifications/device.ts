import {Platform} from 'react-native';
import {requireOptionalNativeModule} from 'expo';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import Constants from 'expo-constants';
import {getFunctions,httpsCallable} from 'firebase/functions';
import {app,auth} from '../lib/firebase';
import {serialOperations} from './protocol';
type Registration={uid:string;token:string;installationId:string;secret:string;enabled:boolean;platform:string;previousTokens?:string[]};
const options={keychainAccessible:SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY};
const key='townloop.inbox.registration',installKey='townloop.inbox.installation';
export const serialized=serialOperations();
export function notifications():typeof import('expo-notifications')|null {
 if(Platform.OS==='web'||!requireOptionalNativeModule('ExpoPushTokenManager'))return null;
 return require('expo-notifications');
}
const call=(data:unknown)=>httpsCallable(getFunctions(app,'us-central1'),'registerInboxDevice',{timeout:10000})(data);
const prefKey=(uid:string)=>`townloop.inbox.preference.${uid}`;
export const preference=async(uid:string)=>(await SecureStore.getItemAsync(prefKey(uid),options))==='on';
export const setPreference=(uid:string,on:boolean)=>SecureStore.setItemAsync(prefKey(uid),on?'on':'off',options);
async function saved():Promise<Registration|null>{const raw=await SecureStore.getItemAsync(key,options);try{return raw?JSON.parse(raw):null;}catch{return null;}}
export async function binding(uid:string){const state=await saved();if(!state||state.uid!==uid||!state.enabled)return '';const cap=await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,`${state.installationId}/${state.secret}`);return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,`${cap}/${uid}`);}
export async function revoke(){
 const state=await saved();if(!state)return;
 // Capability permits revocation even if Firebase already signed out. Keep this
 // encrypted record on network failure so next launch retries before registering.
 await SecureStore.setItemAsync(key,JSON.stringify({...state,enabled:false}),options);
 const n=notifications();if(n){await n.dismissAllNotificationsAsync().catch(()=>{});await n.unregisterForNotificationsAsync().catch(()=>{});}
 await call({...state,remove:true});await SecureStore.deleteItemAsync(key,options);
}
export async function syncDevice(uid:string,on:boolean,ask=false):Promise<'on'|'off'|'denied'|'unavailable'>{
 const n=notifications();if(!n)return 'unavailable';
 const old=await saved();if(old&&old.uid!==uid)await revoke();
 if(!on){await revoke();return 'off';}
 if(Platform.OS==='android')await n.setNotificationChannelAsync('inbox',{name:'Private Inbox',importance:n.AndroidImportance.DEFAULT,sound:'default',lockscreenVisibility:n.AndroidNotificationVisibility.PRIVATE});
 let permission=await n.getPermissionsAsync();
 if(!permission.granted&&ask&&permission.canAskAgain)permission=await n.requestPermissionsAsync({ios:{allowAlert:true,allowSound:true,allowBadge:false}});
 if(!permission.granted&&permission.ios?.status!==n.IosAuthorizationStatus.PROVISIONAL){await revoke();return 'denied';}
 let install=await SecureStore.getItemAsync(installKey,options);
 if(!install){install=JSON.stringify({installationId:Crypto.randomUUID(),secret:Crypto.randomUUID().replaceAll('-','')+Crypto.randomUUID().replaceAll('-','')});await SecureStore.setItemAsync(installKey,install,options);}
 let timeout:ReturnType<typeof setTimeout>|undefined;
 const token=await Promise.race([n.getExpoPushTokenAsync({projectId:Constants.easConfig?.projectId||Constants.expoConfig?.extra?.eas?.projectId}).then(t=>t.data),new Promise<never>((_,reject)=>{timeout=setTimeout(()=>reject(Error('notification_setup_timeout')),15000);})]).finally(()=>clearTimeout(timeout));
 if(auth.currentUser?.uid!==uid)return 'off';
 const previousTokens=[...new Set([...(old?.uid===uid?old.previousTokens||[]:[]),...(old?.uid===uid&&old.token!==token?[old.token]:[])])].filter(t=>t!==token);
 if(previousTokens.length>20)throw Error('notification_revocation_pending');
 const state:Registration={...JSON.parse(install),uid,token,enabled:true,platform:Platform.OS,previousTokens};
 // Persist first, so interruption after server registration still leaves a revoke capability.
 await SecureStore.setItemAsync(key,JSON.stringify(state),options);
 await call(state);
 await SecureStore.setItemAsync(key,JSON.stringify({...state,previousTokens:[]}),options);
 if(auth.currentUser?.uid!==uid){await revoke();return 'off';}
 return 'on';
}
export async function clearPushAccount(uid:string){
 if(Platform.OS==='web')return;
 await SecureStore.deleteItemAsync(prefKey(uid),options);
 await serialized(async()=>{const state=await saved();if(state?.uid!==uid)return;
  await SecureStore.setItemAsync(key,JSON.stringify({...state,enabled:false}),options);
  await revoke().catch(()=>{}); // Retain only an encrypted retry capability when offline.
 });
}
