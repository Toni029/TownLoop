import {useCallback,useMemo,useState} from 'react';
import {useFocusEffect} from 'expo-router';
import {AppState} from 'react-native';
import {getFunctions,httpsCallable} from 'firebase/functions';
import {app} from '../lib/firebase';
import {canViewAllWorkOrders} from '../../../src/utils/permissions';
import type {UserProfile} from '../../../src/types';
import type {WorkOrder} from './model';
/** Resident positions are server-computed against the whole queue, never their private subset. */
export function useQueuePositions(orders:WorkOrder[],user:UserProfile|null){
 const uid=user?.id?String(user.id):'',staff=canViewAllWorkOrders(user);
 const pending=orders.filter(o=>o.status!=='Done').map(o=>String(o.id)).sort().join(',');
 const key=uid&&!staff&&pending?`${uid}:${pending}`:'';
 const [result,setResult]=useState<{key:string;positions:Record<string,number>}>({key:'',positions:{}});
 useFocusEffect(useCallback(()=>{
  if(!key)return;
  let active=true,busy=false,timer:ReturnType<typeof setInterval>|undefined;
  const call=httpsCallable<Record<string,never>,{positions:Record<string,number>}>(getFunctions(app,'us-central1'),'getWorkOrderQueuePositions',{timeout:15000});
  async function refresh(){
   if(busy||!active||AppState.currentState!=='active')return;busy=true;
   try{const data=(await call({})).data;if(active)setResult({key,positions:data.positions});}
   catch{if(active)setResult({key,positions:{}});}finally{busy=false;}
  }
  function stop(){if(timer)clearInterval(timer);timer=undefined;}
  function start(){stop();void refresh();timer=setInterval(()=>void refresh(),60000);}
  start();const sub=AppState.addEventListener('change',state=>state==='active'?start():stop());
  return()=>{active=false;stop();sub.remove();};
 },[key]));
 return useMemo(()=>new Map(result.key===key?Object.entries(result.positions):[]),[result,key]);
}
