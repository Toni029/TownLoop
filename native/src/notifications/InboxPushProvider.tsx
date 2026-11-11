import {preferenceQueue} from './preferenceQueue';
import {createContext,useCallback,useContext,useEffect,useRef,useState,type PropsWithChildren} from 'react';
import {AppState,Platform} from 'react-native';
import {beforeAuthStateChanged} from 'firebase/auth';
import {getDocFromServer,doc} from 'firebase/firestore';
import {router,useRootNavigationState} from 'expo-router';
import {useCommunity} from '../lib/community';
import {useSession} from '../lib/session';
import {auth,db} from '../lib/firebase';
import {readThread} from '../profile/model';
import type {UserProfile} from '../../../src/types';
import {authorizeTarget,notificationCollection,inboxTarget,emptyPreferences,preferenceCategory,type NotificationCategory,type NotificationPreferences,type InboxTarget} from './protocol';
import {binding,notifications,categoryPreferences,revoke,serialized,saveCategoryPreferences,syncDevice,applyNotificationPermission,requestNativeNotificationPermission,getNotificationAuthorization,type NotificationAuthorization,refreshBadge,notificationCapabilities,resolveNotice} from './device';
type State={authorization:NotificationAuthorization;repliesAvailable:boolean;enabled:boolean;preferences:NotificationPreferences;busy:boolean;status:string;target:InboxTarget|null;retry:()=>void;toggle:(category?:NotificationCategory,on?:boolean)=>void;consume:()=>void;read:(category:InboxTarget['category'],id:string)=>void};
const Context=createContext<State>({authorization:'checking',repliesAvailable:false,enabled:false,preferences:emptyPreferences,busy:false,status:'',target:null,retry:()=>{},toggle:()=>{},consume:()=>{},read:()=>{}});
export const useInboxPush=()=>useContext(Context);
export function InboxPushProvider({children}:PropsWithChildren){
 const {user,profile,loading}=useSession();const uid=user?.uid||'';
 const navigation=useRootNavigationState(),{community,ready:communityReady}=useCommunity();
 const canNavigate=!!navigation?.key&&communityReady&&!!community;
 const ready=!!uid&&!loading&&profile?.approved===true&&['resident','crew','admin','vip'].includes(profile.role);
 const [prefs,setPrefs]=useState<NotificationPreferences>(emptyPreferences),[busy,setBusy]=useState(false),[status,setStatus]=useState(''),[target,setTarget]=useState<InboxTarget|null>(null);
 const [repliesAvailable,setRepliesAvailable]=useState(false);
 const [authorization,setAuthorization]=useState<NotificationAuthorization>(Platform.OS==='web'?'unavailable':'checking');
 const enabled=Object.values(prefs).some(Boolean);
 const pending=useRef<InboxTarget|null>(null),seen=useRef(new Set<string>()),permissionOpen=useRef(false),active=useRef({uid:'',ready:false,enabled:false,loading:true});
 active.current={uid,ready,enabled,loading};
 const preferenceWriter=useRef<ReturnType<typeof preferenceQueue>|null>(null);
 useEffect(()=>{
  if(!uid||!ready||Platform.OS==='web')return;
  const account=uid;
  const writer=preferenceQueue({
   load:async()=>{const permission=await getNotificationAuthorization();await applyNotificationPermission(account,permission);return categoryPreferences(account);},
   persist:values=>saveCategoryPreferences(account,values),
   sync:()=>serialized(async()=>{
    if(active.current.uid!==account||!active.current.ready||preferenceWriter.current!==writer)return;
    const values=await categoryPreferences(account);
    if(Object.values(values).some(Boolean))await requestNativeNotificationPermission(account);
    if(active.current.uid!==account||preferenceWriter.current!==writer)return;
    const result=await syncDevice(account,Object.values(values).some(Boolean));
    if(['unavailable','setup-required','simulator'].includes(result))throw Error('notification_sync_unconfirmed');
    const permission=await getNotificationAuthorization();
    if(active.current.uid!==account||preferenceWriter.current!==writer)return;
    setAuthorization(permission);setRepliesAvailable(notificationCapabilities().discussionReplies);
    void refreshBadge(account).catch(()=>{});
   }),
   changed:snapshot=>{
    if(active.current.uid!==account||preferenceWriter.current!==writer)return;
    setPrefs(snapshot.values);setBusy(snapshot.phase==='saving');
    setStatus(({loading:'Loading preferences…',saving:'Saving preferences…',saved:'Preferences saved.',pending:'Saved on this device; sync is unconfirmed. Reopen Notifications or change a switch to retry.',
     'local-error':'Could not save your change. Your previous settings were restored. Please retry.',
     'load-error':'Could not load your settings. No changes have been saved. Please retry.'})[snapshot.phase]);
   },
  });
  preferenceWriter.current=writer;
  return()=>{writer.dispose();if(preferenceWriter.current===writer)preferenceWriter.current=null;};
 },[uid,ready]);
 const read=useCallback((category:InboxTarget['category'],id:string)=>{
  const account=active.current;if(!account.ready)return;
  void refreshBadge(account.uid,{category,conversationId:id}).catch(()=>{if(active.current.uid===account.uid)setStatus('Read notifications will sync when you reconnect.');});
 },[]);
 const consume=useCallback(()=>{pending.current=null;setTarget(null);},[]);
 const refresh=useCallback((ask=false)=>serialized(async()=>{
  const current=active.current;if(!current.ready){if(!current.loading)await revoke();return;}
  const writer=preferenceWriter.current,version=writer?.version();
  if(ask)await requestNativeNotificationPermission(current.uid);
  const osPermission=await getNotificationAuthorization();
  if(active.current.uid!==current.uid||preferenceWriter.current!==writer)return;setAuthorization(osPermission);
  await applyNotificationPermission(current.uid,osPermission);
  const values=await categoryPreferences(current.uid);
  if(active.current.uid!==current.uid||preferenceWriter.current!==writer)return;
  if(writer&&preferenceWriter.current===writer)writer.hydrate(values,version!);
  const result=await syncDevice(current.uid,Object.values(values).some(Boolean));
  const updatedPermission=await getNotificationAuthorization();
  if(active.current.uid!==current.uid||preferenceWriter.current!==writer)return;
  setAuthorization(updatedPermission);
  if(writer&&preferenceWriter.current===writer&&(writer.version()!==version||writer.snapshot().phase==='saving'))return;
  writer?.confirmed(version!);
  setRepliesAvailable(notificationCapabilities().discussionReplies);setStatus(result==='simulator'?'Preferences saved. Push delivery requires a configured physical iPhone.':updatedPermission==='denied'?'Notifications are off in device settings.':result==='unavailable'?'Notifications require the next TownLoop app build.':result==='setup-required'?'Notification service update is pending.':result==='on'?'Notifications on':'Notifications off');
  await refreshBadge(current.uid).catch(()=>{});
 }),[]);
 const openPending=useCallback(async()=>{
  const current=active.current;let t=pending.current;if(!current.ready||!canNavigate||!t)return;
  try{
   if(t.noticeId){
    if(await binding(current.uid)!==t.deviceBinding)return;
    const resolved=await resolveNotice(current.uid,t.noticeId);
    t=inboxTarget({...resolved,type:'inbox',deviceBinding:t.deviceBinding});if(!t)return;
   }
   const authorized=await authorizeTarget(t,{session:()=>active.current,binding,authorize:async(destination,account)=>{
    const targetCollection=notificationCollection(destination);
    const snap=await getDocFromServer(doc(db,targetCollection,destination.conversationId));
    if(!snap.exists())return false;
    if(targetCollection==='inbox_conversations'){
     // This server read is subject to active-membership/role Firestore rules.
     const group=snap.data();return group.schemaVersion===3&&group.id===destination.conversationId&&Array.isArray(group.memberIds)&&group.memberIds.includes(account)&&({private:'friend',office:'office',maintenance:'maintenance'} as Record<string,string>)[group.type]===destination.category&&group.status!=='cleanup_in_progress';
    }
    if(destination.category==='discussion')return snap.data().storageDraft===false;
    if(destination.category==='workorders')return snap.data().userId===account||['admin','vip','crew'].includes(profile?.role||'');
    if(destination.category==='marketplace')return snap.data().participantIds?.includes(account)&&[snap.data().sellerId,snap.data().buyerId].includes(account);
    return !!readThread(destination.category,snap.id,snap.data(),{...profile?.source,...profile,id:account} as UserProfile);
   }});
   if(!authorized){consume();return;}
   setTarget(t);router.navigate(t.category==='workorders'?'/(tabs)/workorders':t.category==='marketplace'||t.category==='discussion'?'/(tabs)/social':'/(tabs)');
  }catch{setStatus('Reconnect and open TownLoop to view this update.');}
 },[profile,canNavigate,consume]);
 useEffect(()=>{
  if(Platform.OS==='web')return;
  const n=notifications();if(!n)return;
  const behavior=(show:boolean)=>({shouldShowBanner:show,shouldShowList:show,shouldPlaySound:show,shouldSetBadge:show});
  n.setNotificationHandler({handleNotification:async notification=>{
   const current=active.current,t=inboxTarget(notification.request.content.data);
   const values=await categoryPreferences(current.uid);
   const show=!!t&&current.ready&&values[preferenceCategory(t)]&&await binding(current.uid)===t.deviceBinding;
   return behavior(show&&active.current.ready&&active.current.uid===current.uid);
  }});
  const response=(r:import('expo-notifications').NotificationResponse)=>{
   const id=r.notification.request.identifier;if(seen.current.has(id))return;
   seen.current.add(id);if(seen.current.size>50)seen.current.delete(seen.current.values().next().value!);
   const t=inboxTarget(r.notification.request.content.data);if(t)pending.current=t;
   void n.clearLastNotificationResponseAsync();void openPending();
  };
  const tap=n.addNotificationResponseReceivedListener(response),token=n.addPushTokenListener(()=>{void refresh().catch(()=>setStatus('Reconnect to finish notification setup.'));});
  const delivered=n.addNotificationReceivedListener(()=>{if(active.current.ready)void refreshBadge(active.current.uid).catch(()=>{});});
  void n.getLastNotificationResponseAsync().then(r=>{if(r)response(r);}).catch(()=>{});
  return()=>{tap.remove();token.remove();delivered.remove();n.setNotificationHandler(null);};
 },[openPending,refresh]);
 useEffect(()=>{
  if(!ready){setTarget(null);setPrefs(emptyPreferences);setRepliesAvailable(false);setBusy(false);setStatus('');}
  if(Platform.OS==='web')return;
  void refresh().catch(()=>setStatus('Reconnect to finish notification setup.'));
  const listener=AppState.addEventListener('change',state=>{if(state==='active'){void refresh().catch(()=>{});void openPending();}});
  void openPending();return()=>listener.remove();
 },[uid,ready,loading,refresh,openPending]);
 useEffect(()=>{
  if(loading||!navigation?.key||!communityReady||Platform.OS==='web')return;
  let canceled=false;
  // Request installation-wide native permission on the first usable launch,
  // including before login. Do not queue the OS dialog behind network sync;
  // device.ts coalesces concurrent prompt requests. Enrollment still requires approval.
  let frame:number|undefined;
  const schedule=()=>{if(frame!==undefined)cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{void (async()=>{
   if(canceled||permissionOpen.current||AppState.currentState!=='active'||active.current.loading)return;
   permissionOpen.current=true;
   try{
    const permission=await requestNativeNotificationPermission();
    if(!canceled)setAuthorization(permission);
   }finally{permissionOpen.current=false;}
  })().then(()=>{if(!canceled)void refresh().catch(()=>{});}).catch(()=>{});});};
  schedule();
  const resumed=AppState.addEventListener('change',state=>{if(state==='active')schedule();});
  return()=>{canceled=true;if(frame!==undefined)cancelAnimationFrame(frame);resumed.remove();};
 },[loading,navigation?.key,communityReady,refresh]);
 useEffect(()=>{
  if(Platform.OS==='web')return;
  return beforeAuthStateChanged(auth,async next=>{
   if(!auth.currentUser||next?.uid===auth.currentUser.uid)return;
   preferenceWriter.current?.dispose();preferenceWriter.current=null;
   pending.current=null;setTarget(null);active.current={uid:'',ready:false,enabled:false,loading:false};
   await Promise.race([serialized(revoke).catch(()=>{}),new Promise<void>(resolve=>setTimeout(resolve,3500))]);
  });
 },[]);
 function toggle(category:NotificationCategory='inbox',on?:boolean){
  const writer=preferenceWriter.current;if(!ready||!writer)return;
  writer.set(category,on??!writer.snapshot().values[category]);
 }
 return <Context.Provider value={{authorization,repliesAvailable,enabled,preferences:prefs,busy,status,target,retry:()=>{const writer=preferenceWriter.current;void refresh().catch(()=>{if(preferenceWriter.current===writer)setStatus('Could not sync your saved preferences. Reconnect and reopen Notifications to retry.');});},toggle,consume,read}}>{children}</Context.Provider>;
}
