import {useEffect,useRef,useState} from 'react';
import {doc,onSnapshot} from 'firebase/firestore';
import {db} from '../lib/firebase';
import {useSession} from '../lib/session';
import {useInboxPush} from './InboxPushProvider';
import {collectionFor,type InboxTarget} from './protocol';
type Destination={uid:string;id:string;category:InboxTarget['category']};
type Record=Destination&{data:{[key:string]:any}};
/** A notified older item can sit outside the screen's bounded collection query.
 * Keep one authorized document live after its notification has been consumed. */
export function usePushDocument(categories:ReadonlyArray<InboxTarget['category']>){
 const {target}=useInboxPush(),{user,profile,loading}=useSession();
 const uid=user?.uid||'',ready=!!uid&&!loading&&profile?.approved===true&&['resident','crew','admin','vip'].includes(profile.role);
 const account=useRef({uid,ready});account.current={uid,ready};
 const allowed=categories.join(',');
 const [destination,setDestination]=useState<Destination|null>(null),[record,setRecord]=useState<Record|null>(null);
 useEffect(()=>{
  if(ready&&target&&allowed.split(',').includes(target.category))setDestination(previous=>previous?.uid===uid&&previous.id===target.conversationId&&previous.category===target.category?previous:{uid,id:target.conversationId,category:target.category});
 },[target,uid,ready,allowed]);
 useEffect(()=>{
  if(!ready||!destination||destination.uid!==uid){setRecord(null);return;}
  let active=true;
  const stop=onSnapshot(doc(db,collectionFor[destination.category],destination.id),snapshot=>{
   if(!active||account.current.uid!==uid||!account.current.ready)return;
   setRecord(snapshot.exists()?{...destination,data:snapshot.data()}:null);
  },()=>{if(active)setRecord(null);});
  return()=>{active=false;stop();};
 },[destination,uid,ready]);
 return ready&&record?.uid===uid?record:null;
}
