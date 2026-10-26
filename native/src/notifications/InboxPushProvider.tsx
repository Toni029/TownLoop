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
import {authorizeTarget,collectionFor,inboxTarget,type InboxTarget} from './protocol';
import {binding,notifications,preference,revoke,serialized,setPreference,syncDevice} from './device';
type State={enabled:boolean;busy:boolean;status:string;target:InboxTarget|null;toggle:()=>void;consume:()=>void};
const Context=createContext<State>({enabled:false,busy:false,status:'',target:null,toggle:()=>{},consume:()=>{}});
export const useInboxPush=()=>useContext(Context);
export function InboxPushProvider({children}:PropsWithChildren){
 const {user,profile,loading}=useSession();const uid=user?.uid||'';
 const navigation=useRootNavigationState(),{community,ready:communityReady}=useCommunity();
 const canNavigate=!!navigation?.key&&communityReady&&!!community;
 const ready=!!uid&&!loading&&profile?.approved===true&&['resident','crew','admin','vip'].includes(profile.role);
 const [enabled,setEnabled]=useState(false),[busy,setBusy]=useState(false),[status,setStatus]=useState(''),[target,setTarget]=useState<InboxTarget|null>(null);
 const pending=useRef<InboxTarget|null>(null),seen=useRef(new Set<string>()),epoch=useRef(0),active=useRef({uid:'',ready:false,enabled:false,loading:true});
 active.current={uid,ready,enabled,loading};
 const consume=useCallback(()=>{pending.current=null;setTarget(null);},[]);
 const refresh=useCallback((ask=false)=>serialized(async()=>{
  const current=active.current;if(!current.ready){if(!current.loading)await revoke();return;}
  const on=await preference(current.uid);const result=await syncDevice(current.uid,on,ask);
  if(active.current.uid!==current.uid)return;
  setEnabled(on);setStatus(result==='denied'?'Notifications are off in device settings.':result==='unavailable'?'Notifications require the next TownLoop app build.':result==='on'?'Inbox notifications on':'Inbox notifications off');
 }),[]);
 const openPending=useCallback(async()=>{
  const current=active.current,t=pending.current;if(!current.ready||!canNavigate||!t)return;
  try{
   const authorized=await authorizeTarget(t,{session:()=>active.current,binding,authorize:async(target,account)=>{
    // Server rules authorize this read before any conversation can be rendered.
    const snap=await getDocFromServer(doc(db,collectionFor[target.category],target.conversationId));
    if(!snap.exists())return false;
    if(target.category==='marketplace')return snap.data().participantIds?.includes(account)&&[snap.data().sellerId,snap.data().buyerId].includes(account);
    return !!readThread(target.category,snap.id,snap.data(),{...profile?.source,...profile,id:account} as UserProfile);
   }});
   if(!authorized)return;
   setTarget(t);router.navigate(t.category==='marketplace'?'/(tabs)/social':'/(tabs)');
  }catch{setStatus('Reconnect and open Inbox to view this message.');}
 },[profile,canNavigate]);
 useEffect(()=>{
  if(Platform.OS==='web')return;
  const n=notifications();if(!n)return;
  const behavior=(show:boolean)=>({shouldShowBanner:show,shouldShowList:show,shouldPlaySound:show,shouldSetBadge:false});
  n.setNotificationHandler({handleNotification:async notification=>{
   const current=active.current,t=inboxTarget(notification.request.content.data);
   return behavior(!!t&&current.ready&&current.enabled&&await binding(current.uid)===t.deviceBinding);
  }});
  const response=(r:import('expo-notifications').NotificationResponse)=>{
   const id=r.notification.request.identifier;if(seen.current.has(id))return;
   seen.current.add(id);if(seen.current.size>50)seen.current.delete(seen.current.values().next().value!);
   const t=inboxTarget(r.notification.request.content.data);if(t)pending.current=t;
   void n.clearLastNotificationResponseAsync();void openPending();
  };
  const tap=n.addNotificationResponseReceivedListener(response),token=n.addPushTokenListener(()=>{void refresh().catch(()=>setStatus('Reconnect to finish notification setup.'));});
  void n.getLastNotificationResponseAsync().then(r=>{if(r)response(r);}).catch(()=>{});
  return()=>{tap.remove();token.remove();n.setNotificationHandler(null);};
 },[openPending,refresh]);
 useEffect(()=>{
  const generation=++epoch.current;
  if(!uid){setTarget(null);setEnabled(false);}
  if(Platform.OS==='web')return;
  void preference(uid).then(on=>{if(epoch.current===generation)setEnabled(on);}).catch(()=>{});
  void refresh().catch(()=>setStatus('Reconnect to finish notification setup.'));
  const listener=AppState.addEventListener('change',state=>{if(state==='active'){void refresh().catch(()=>{});void openPending();}});
  void openPending();return()=>listener.remove();
 },[uid,ready,loading,refresh,openPending]);
 useEffect(()=>{
  if(Platform.OS==='web')return;
  // Do not hold authentication hostage on poor connections. Failed revocation
  // stays encrypted for retry; native deregistration suppresses local delivery.
  return beforeAuthStateChanged(auth,async next=>{
   if(!auth.currentUser||next?.uid===auth.currentUser.uid)return;
   pending.current=null;setTarget(null);active.current={uid:'',ready:false,enabled:false,loading:false};
   await Promise.race([serialized(revoke).catch(()=>{}),new Promise<void>(resolve=>setTimeout(resolve,3500))]);
  });
 },[]);
 function toggle(){
  if(busy||!ready)return;setBusy(true);const current=uid,on=!enabled;
  setEnabled(on);active.current.enabled=on;
  void setPreference(current,on).then(()=>refresh(on)).catch(()=>setStatus('Could not update notifications. Reconnect and retry.')).finally(()=>setBusy(false));
 }
 return <Context.Provider value={{enabled,busy,status,target,toggle,consume}}>{children}</Context.Provider>;
}
