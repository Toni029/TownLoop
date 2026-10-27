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
import {authorizeTarget,collectionFor,inboxTarget,emptyPreferences,preferenceCategory,type NotificationCategory,type NotificationPreferences,type InboxTarget} from './protocol';
import {binding,notifications,categoryPreferences,revoke,serialized,setCategoryPreference,syncDevice,requestNativeNotificationPermission,getNotificationAuthorization,type NotificationAuthorization,refreshBadge,notificationCapabilities,resolveNotice} from './device';
type State={authorization:NotificationAuthorization;repliesAvailable:boolean;enabled:boolean;preferences:NotificationPreferences;busy:boolean;status:string;target:InboxTarget|null;toggle:(category?:NotificationCategory)=>void;consume:()=>void;read:(category:InboxTarget['category'],id:string)=>void};
const Context=createContext<State>({authorization:'checking',repliesAvailable:false,enabled:false,preferences:emptyPreferences,busy:false,status:'',target:null,toggle:()=>{},consume:()=>{},read:()=>{}});
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
 const pending=useRef<InboxTarget|null>(null),seen=useRef(new Set<string>()),epoch=useRef(0),permissionOpen=useRef(false),active=useRef({uid:'',ready:false,enabled:false,loading:true});
 active.current={uid,ready,enabled,loading};
 const read=useCallback((category:InboxTarget['category'],id:string)=>{
  const account=active.current;if(!account.ready)return;
  void refreshBadge(account.uid,{category,conversationId:id}).catch(()=>{if(active.current.uid===account.uid)setStatus('Read notifications will sync when you reconnect.');});
 },[]);
 const consume=useCallback(()=>{pending.current=null;setTarget(null);},[]);
 const refresh=useCallback((ask=false)=>serialized(async()=>{
  const current=active.current;if(!current.ready){if(!current.loading)await revoke();return;}
  const osPermission=await getNotificationAuthorization();
  if(active.current.uid!==current.uid)return;setAuthorization(osPermission);
  const values=await categoryPreferences(current.uid);const result=await syncDevice(current.uid,Object.values(values).some(Boolean),ask);
  const updatedPermission=await getNotificationAuthorization();
  if(active.current.uid!==current.uid)return;
  setAuthorization(updatedPermission);setPrefs(values);setRepliesAvailable(notificationCapabilities().discussionReplies);setStatus(result==='simulator'?'Preferences saved. Push delivery requires a configured physical iPhone.':result==='denied'?'Notifications are off in device settings.':result==='unavailable'?'Notifications require the next TownLoop app build.':result==='setup-required'?'Notification service update is pending.':result==='on'?'Notifications on':'Notifications off');
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
    const snap=await getDocFromServer(doc(db,collectionFor[destination.category],destination.conversationId));
    if(!snap.exists())return false;
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
  const generation=++epoch.current;
  if(!ready){setTarget(null);setPrefs(emptyPreferences);setRepliesAvailable(false);}
  if(Platform.OS==='web')return;
  void categoryPreferences(uid).then(values=>{if(epoch.current===generation)setPrefs(values);}).catch(()=>{});
  void refresh().catch(()=>setStatus('Reconnect to finish notification setup.'));
  const listener=AppState.addEventListener('change',state=>{if(state==='active'){void refresh().catch(()=>{});void openPending();}});
  void openPending();return()=>listener.remove();
 },[uid,ready,loading,refresh,openPending]);
 useEffect(()=>{
  if(!ready||!canNavigate||Platform.OS==='web')return;
  let canceled=false;
  // Navigation exists only after essential initialization. Yield a frame, then
  // let the OS alone request permission; never change saved category choices.
  let frame:number|undefined;
  const schedule=()=>{if(frame!==undefined)cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{void serialized(async()=>{
   if(canceled||permissionOpen.current||AppState.currentState!=='active'||active.current.uid!==uid||!active.current.ready)return;
   permissionOpen.current=true;
   try{
    const permission=await requestNativeNotificationPermission(uid);
    if(!canceled&&active.current.uid===uid)setAuthorization(permission);
   }finally{permissionOpen.current=false;}
  }).then(()=>{if(!canceled&&active.current.uid===uid)void refresh().catch(()=>{});}).catch(()=>{});});};
  schedule();
  const resumed=AppState.addEventListener('change',state=>{if(state==='active')schedule();});
  return()=>{canceled=true;if(frame!==undefined)cancelAnimationFrame(frame);resumed.remove();};
 },[uid,ready,canNavigate,refresh]);
 useEffect(()=>{
  if(Platform.OS==='web')return;
  return beforeAuthStateChanged(auth,async next=>{
   if(!auth.currentUser||next?.uid===auth.currentUser.uid)return;
   pending.current=null;setTarget(null);active.current={uid:'',ready:false,enabled:false,loading:false};
   await Promise.race([serialized(revoke).catch(()=>{}),new Promise<void>(resolve=>setTimeout(resolve,3500))]);
  });
 },[]);
 function toggle(category:NotificationCategory='inbox'){
  if(busy||!ready)return;setBusy(true);const account=uid,on=!prefs[category];
  void setCategoryPreference(account,category,on).then(async()=>{
   const values=await categoryPreferences(account);if(active.current.uid!==account)return;
   setPrefs(values);await refresh(on);
  }).catch(()=>setStatus('Could not update notifications. Reconnect and retry.')).finally(()=>setBusy(false));
 }
 return <Context.Provider value={{authorization,repliesAvailable,enabled,preferences:prefs,busy,status,target,toggle,consume,read}}>{children}</Context.Provider>;
}
