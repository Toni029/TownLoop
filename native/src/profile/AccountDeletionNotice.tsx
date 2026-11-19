import {useEffect,useRef,useState} from 'react';
import {AppState,Text,View} from 'react-native';
import {MotionPressable} from '../motion/Pressable';
import {useSession} from '../lib/session';
import {auth} from '../lib/firebase';
import {getAccountDeletionStatus} from '../lib/accountDeletion';
import type {DeletionRejectionNotice} from '../lib/deletionStatus';

function readNotice(value:unknown):DeletionRejectionNotice|null{
 if(!value||typeof value!=='object')return null;
 const item=value as Partial<DeletionRejectionNotice>;
 return item.decision==='rejected'&&typeof item.requestId==='string'&&!!item.requestId&&typeof item.reason==='string'&&!!item.reason.trim()?{requestId:item.requestId,decision:'rejected',reason:item.reason.slice(0,1000)}:null;
}
/** Private profile-backed notice. Failed refreshes never dismiss an unread decision. */
export function AccountDeletionNotice(){
 const {user,profile,loading,registrationInProgress}=useSession();
 const uid=!loading&&!registrationInProgress?user?.uid:undefined;
 if(!uid||auth.currentUser?.uid!==uid)return null;
 return <AccountDeletionNoticeForAccount key={uid} uid={uid} profileValue={profile?.source?.accountDeletionNotice}/>;
}
function AccountDeletionNoticeForAccount({uid,profileValue}:{uid:string;profileValue:unknown}){
 const [stored,setStored]=useState<{profileValue:unknown;notice:DeletionRejectionNotice|null}|null>(null);
 const [acknowledged,setAcknowledged]=useState<string|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const mounted=useRef(true),operation=useRef(false);
 const profileNotice=readNotice(profileValue);
 const candidate=stored&&stored.profileValue===profileValue?stored.notice:profileNotice;
 const notice=candidate&&acknowledged!==candidate.requestId?candidate:null;
 useEffect(()=>{
  mounted.current=true;
  return()=>{mounted.current=false;};
 },[]);
 useEffect(()=>{
  let alive=true,inflight=false;
  const refresh=async()=>{
   if(inflight||!alive||auth.currentUser?.uid!==uid)return;
   inflight=true;
   try{
    const result=await getAccountDeletionStatus();
    if(!alive||auth.currentUser?.uid!==uid)return;
    setStored({profileValue,notice:readNotice(result.accountDeletionNotice)});
   }catch{/* Keep the persistent profile notice available while offline. */}
   finally{inflight=false;}
  };
  void refresh();
  const listener=AppState.addEventListener('change',state=>{if(state==='active')void refresh();});
  return()=>{alive=false;listener.remove();};
 },[uid,profileValue]);
 async function acknowledge(){
  if(!notice||operation.current||!mounted.current||auth.currentUser?.uid!==uid)return;
  const requestId=notice.requestId;operation.current=true;setBusy(true);setError('');
  try{
   await getAccountDeletionStatus({ackNotice:requestId});
   if(mounted.current&&auth.currentUser?.uid===uid)setAcknowledged(requestId);
  }catch{if(mounted.current&&auth.currentUser?.uid===uid)setError('Unable to dismiss this notice. Reconnect and try again.');}
  finally{if(mounted.current&&auth.currentUser?.uid===uid){operation.current=false;setBusy(false);}}
 }
 if(!uid||auth.currentUser?.uid!==uid||!notice)return null;
 return <View accessibilityLiveRegion="polite" style={{padding:16,gap:8,backgroundColor:'#fff3d6',borderBottomWidth:1,borderBottomColor:'#d4ad59'}}>
  <Text style={{fontWeight:'700',color:'#4b4343'}}>Your account deletion request was rejected</Text>
  <Text style={{color:'#4b4343'}}>{notice.reason}</Text>
  <Text style={{color:'#4b4343'}}>The request is closed. You can keep using your account and submit a new verified request in Account Deletion.</Text>
  {!!error&&<Text accessibilityRole="alert" style={{color:'#9b2929'}}>{error}</Text>}
  <MotionPressable accessibilityRole="button" accessibilityLabel="Acknowledge account deletion decision" disabled={busy} onPress={()=>void acknowledge()} style={{minHeight:44,justifyContent:'center'}}><Text style={{fontWeight:'700',color:'#4b4343'}}>{busy?'Saving…':'Dismiss notice'}</Text></MotionPressable>
 </View>;
}
