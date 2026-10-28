import {Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {requireOptionalNativeModule} from 'expo';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import Constants from 'expo-constants';
import {getFunctions,httpsCallable} from 'firebase/functions';
import {app,auth} from '../lib/firebase';
import {serialOperations,emptyPreferences,notificationCategories,type NotificationCategory,type NotificationPreferences,type InboxTarget} from './protocol';
type Registration={uid:string;token:string;installationId:string;secret:string;enabled:boolean;platform:string;previousTokens?:string[];preferences?:NotificationPreferences};
let capabilities={protocolVersion:1,discussionReplies:false};
export const notificationCapabilities=()=>capabilities;
const options={keychainAccessible:SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY};
const key='townloop.inbox.registration',installKey='townloop.inbox.installation';
export const serialized=serialOperations();
const badgeOperations=serialOperations();
const cleanupEpoch=new Map<string,number>();
const ackKey=(uid:string)=>`townloop.notifications.reads.${uid}`;
export function notifications():typeof import('expo-notifications')|null {
 if(Platform.OS==='web'||!requireOptionalNativeModule('ExpoPushTokenManager'))return null;
 return require('expo-notifications');
}
const call=(data:unknown)=>httpsCallable(getFunctions(app,'us-central1'),'registerInboxDevice',{timeout:10000})(data);
const prefKey=(uid:string)=>`townloop.inbox.preference.${uid}`;
const categoriesKey=(uid:string)=>`townloop.notifications.categories.${uid}`;
const permissionAttemptKey='townloop.notifications.permission.requested';
const permissionDefaultsKey=(uid:string)=>`townloop.notifications.permission.defaults.${uid}`;
export async function categoryPreferences(uid:string):Promise<NotificationPreferences>{
 const raw=await SecureStore.getItemAsync(categoriesKey(uid),options);
 if(raw){try{const value=JSON.parse(raw);return Object.fromEntries(notificationCategories.map(k=>[k,value[k]===true])) as NotificationPreferences;}catch{}}
 const legacy=(await SecureStore.getItemAsync(prefKey(uid),options))==='on';
 return {...emptyPreferences,inbox:legacy,marketplace:legacy};
}
export const preference=async(uid:string)=>Object.values(await categoryPreferences(uid)).some(Boolean);
export async function setCategoryPreference(uid:string,category:NotificationCategory,on:boolean){
 const value=await categoryPreferences(uid);value[category]=on;await SecureStore.setItemAsync(categoriesKey(uid),JSON.stringify(value),options);
}
export type NotificationAuthorization='checking'|'unavailable'|'undetermined'|'denied'|'granted'|'provisional';
function authorization(n:NonNullable<ReturnType<typeof notifications>>,p:Awaited<ReturnType<typeof n.getPermissionsAsync>>):NotificationAuthorization {
 if(p.ios?.status!=null&&p.ios.status===n.IosAuthorizationStatus?.PROVISIONAL)return 'provisional';
 return p.granted?'granted':p.status==='undetermined'?'undetermined':'denied';
}
export async function getNotificationAuthorization():Promise<NotificationAuthorization>{
 const n=notifications();return n?authorization(n,await n.getPermissionsAsync()):'unavailable';
}
async function prepareChannels(n:NonNullable<ReturnType<typeof notifications>>){
 if(Platform.OS==='android')for(const [channel,name]of Object.entries({inbox:'Private Inbox',marketplace:'Marketplace messages',discussion:'Discussion replies',workorders:'Work Order updates'}))await n.setNotificationChannelAsync(channel,{name,importance:n.AndroidImportance.HIGH,sound:'default',showBadge:true,lockscreenVisibility:n.AndroidNotificationVisibility.PRIVATE});
}
// OS authorization is installation-wide, separate from per-account category choices.
// Record the attempt before displaying the native prompt; cancellation never loops.
export async function requestNativeNotificationPermission(uid?:string):Promise<NotificationAuthorization>{
 const n=notifications();if(!n)return 'unavailable';
 const permission=await n.getPermissionsAsync();
 if((uid!==undefined&&auth.currentUser?.uid!==uid)||permission.status!=='undetermined'||!permission.canAskAgain||
   (Platform.OS==='android'&&Number(Platform.Version)<33))return authorization(n,permission);
 if(await AsyncStorage.getItem(permissionAttemptKey)==='yes')return authorization(n,permission);
 await prepareChannels(n);
 if(uid!==undefined&&auth.currentUser?.uid!==uid)return authorization(n,permission);
 // Nonsecret installation marker: iOS Keychain can survive uninstall.
 await AsyncStorage.setItem(permissionAttemptKey,'yes');
 if(uid!==undefined&&auth.currentUser?.uid!==uid)return authorization(n,permission);
 try{return authorization(n,await n.requestPermissionsAsync({ios:{allowAlert:true,allowSound:true,allowBadge:true}}));}
 catch(error){await AsyncStorage.removeItem(permissionAttemptKey);throw error;}
}

export const setPreference=async(uid:string,on:boolean)=>{await SecureStore.setItemAsync(prefKey(uid),on?'on':'off',options);await SecureStore.setItemAsync(categoriesKey(uid),JSON.stringify(Object.fromEntries(notificationCategories.map(k=>[k,on]))),options);};
/** Apply the OS decision once per account/authorization change, not on every resume.
 * A later category opt-out survives restarts. OS denial always disables all four.
 * No token is obtained or registered until an approved authenticated session syncs.
 */
export async function applyNotificationPermission(uid:string,permission:NotificationAuthorization){
 if(auth.currentUser?.uid!==uid||!['granted','provisional','denied'].includes(permission))return;
 const allowed=permission==='granted'||permission==='provisional';
 const decision=allowed?'on':'off';
 const previous=await SecureStore.getItemAsync(permissionDefaultsKey(uid),options);
 if(auth.currentUser?.uid!==uid)return;
 if(previous!==decision||!allowed){
  await setPreference(uid,allowed);
  await SecureStore.setItemAsync(permissionDefaultsKey(uid),decision,options);
 }
}

async function saved():Promise<Registration|null>{const raw=await SecureStore.getItemAsync(key,options);try{return raw?JSON.parse(raw):null;}catch{return null;}}
export async function binding(uid:string){const state=await saved();if(!state||state.uid!==uid||!state.enabled)return '';const cap=await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,`${state.installationId}/${state.secret}`);return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,`${cap}/${uid}`);}
export async function revoke(){
 const state=await saved();if(!state)return;
 // Capability permits revocation even if Firebase already signed out. Keep this
 // encrypted record on network failure so next launch retries before registering.
 await SecureStore.setItemAsync(key,JSON.stringify({...state,enabled:false}),options);
 const n=notifications();if(n){await n.dismissAllNotificationsAsync().catch(()=>{});await n.setBadgeCountAsync(0).catch(()=>{});await n.unregisterForNotificationsAsync().catch(()=>{});}
 await call({...state,remove:true});await SecureStore.deleteItemAsync(key,options);
}
export async function syncDevice(uid:string,on:boolean,ask=false):Promise<'on'|'off'|'denied'|'unavailable'|'setup-required'|'simulator'>{
 const n=notifications();if(!n)return 'unavailable';
 const old=await saved();if(old&&old.uid!==uid)await revoke();
 if(!on){await revoke();return 'off';}
 // Simulator testing retains settings and all native modules, but must not wait
 // on APNs/token registration that requires a configured physical device.
 if(Platform.OS==='ios'&&process.env.EXPO_PUBLIC_TOWNLOOP_IOS_SIMULATOR==='1')return 'simulator';
 await prepareChannels(n);
 let permission=await n.getPermissionsAsync();
 if(ask){await requestNativeNotificationPermission(uid);permission=await n.getPermissionsAsync();}
 if(!permission.granted&&permission.ios?.status!==n.IosAuthorizationStatus.PROVISIONAL){await revoke();return 'denied';}
 let install=await SecureStore.getItemAsync(installKey,options);
 if(!install){install=JSON.stringify({installationId:Crypto.randomUUID(),secret:Crypto.randomUUID().replaceAll('-','')+Crypto.randomUUID().replaceAll('-','')});await SecureStore.setItemAsync(installKey,install,options);}
 let timeout:ReturnType<typeof setTimeout>|undefined;
 const token=await Promise.race([n.getExpoPushTokenAsync({projectId:Constants.easConfig?.projectId||Constants.expoConfig?.extra?.eas?.projectId}).then(t=>t.data),new Promise<never>((_,reject)=>{timeout=setTimeout(()=>reject(Error('notification_setup_timeout')),15000);})]).finally(()=>clearTimeout(timeout));
 if(auth.currentUser?.uid!==uid)return 'off';
 const previousTokens=[...new Set([...(old?.uid===uid?old.previousTokens||[]:[]),...(old?.uid===uid&&old.token!==token?[old.token]:[])])].filter(t=>t!==token);
 if(previousTokens.length>20)throw Error('notification_revocation_pending');
 const state:Registration={...JSON.parse(install),uid,token,enabled:true,platform:Platform.OS,preferences:await categoryPreferences(uid),previousTokens};
 // Persist first, so interruption after server registration still leaves a revoke capability.
 await SecureStore.setItemAsync(key,JSON.stringify(state),options);
 const registration=await call(state);
 const info=registration.data as {protocolVersion?:number;discussionReplies?:boolean};
 const version=info?.protocolVersion||1;capabilities={protocolVersion:version,discussionReplies:version>=2&&info.discussionReplies===true};
 await SecureStore.setItemAsync(key,JSON.stringify({...state,previousTokens:[]}),options);
 if(auth.currentUser?.uid!==uid){await revoke();return 'off';}
 return version>=2?'on':'setup-required';
}
export async function clearPushAccount(uid:string){
 if(Platform.OS==='web')return;
 cleanupEpoch.set(uid,(cleanupEpoch.get(uid)||0)+1);
 await Promise.all([prefKey(uid),categoriesKey(uid),permissionDefaultsKey(uid),`townloop.notifications.explained.${uid}`].map(k=>SecureStore.deleteItemAsync(k,options)));
 await badgeOperations(()=>SecureStore.deleteItemAsync(ackKey(uid),options));
 await serialized(async()=>{const state=await saved();if(state?.uid!==uid)return;
  await SecureStore.setItemAsync(key,JSON.stringify({...state,enabled:false}),options);
  await revoke().catch(()=>{}); // Retain only an encrypted retry capability when offline.
 });
}

// Receipts are account scoped and contain only target identifiers; never message bodies.
type PendingRead=Pick<InboxTarget,'category'|'conversationId'>&{readAt:number};
export function refreshBadge(uid:string,ack?:Pick<InboxTarget,'category'|'conversationId'>){
 const requestedReadAt=Date.now(),generation=cleanupEpoch.get(uid)||0;
 const current=()=>auth.currentUser?.uid===uid&&(cleanupEpoch.get(uid)||0)===generation;
 return badgeOperations(async()=>{
 if(Platform.OS==='web'||!current())return;
 let pending:PendingRead[]=[];
 try{pending=JSON.parse(await SecureStore.getItemAsync(ackKey(uid),options)||'[]');}catch{}
 if(!current())return;
 pending=pending.filter(value=>value&&typeof value.conversationId==='string'&&Date.now()-value.readAt<60*86400000);
 if(ack){
  const prior=pending.find(value=>value.category===ack.category&&value.conversationId===ack.conversationId);
  if(prior)prior.readAt=Math.max(prior.readAt,requestedReadAt);
  else{if(pending.length>=128)throw Error('notification_read_retry_pending');pending.push({...ack,readAt:requestedReadAt});}
  await SecureStore.setItemAsync(ackKey(uid),JSON.stringify(pending),options);
 }
 let counts:Partial<Record<NotificationCategory,number>>={};
 // Bound one background pass. Remaining pages stay encrypted for next resume/read.
 for(let page=0;page<8;page++){
  if(!current())return;
  const response=await httpsCallable(getFunctions(app,'us-central1'),'getNotificationState',{timeout:10000})(pending.length?{ack:pending[0]}:{});
  if(!current())return;
  const result=response.data as {counts?:Partial<Record<NotificationCategory,number>>;ackPending?:boolean};counts=result.counts||{};
  if(!pending.length)break;
  if(!result.ackPending){pending.shift();await SecureStore.setItemAsync(ackKey(uid),JSON.stringify(pending),options);}
  if(!pending.length)break;
 }
 const prefs=await categoryPreferences(uid);
 const count=notificationCategories.reduce((sum,k)=>sum+(prefs[k]&&Number.isSafeInteger(counts[k])&&counts[k]!>=0?counts[k]!:0),0);
 if(current())await notifications()?.setBadgeCountAsync(count);
});}

export async function resolveNotice(uid:string,noticeId:string){
 if(auth.currentUser?.uid!==uid)throw Error('notification_session_changed');
 const result=await httpsCallable(getFunctions(app,'us-central1'),'getNotificationState',{timeout:10000})({resolve:noticeId});
 if(auth.currentUser?.uid!==uid)throw Error('notification_session_changed');
 return (result.data as {target?:{category:string;conversationId:string;commentId?:string}})?.target;
}
