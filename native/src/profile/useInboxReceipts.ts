import AsyncStorage from '@react-native-async-storage/async-storage';
import {useCallback,useEffect,useRef} from 'react';
import {AppState,type ViewToken} from 'react-native';
import {auth} from '../lib/firebase';
import {refreshBadge} from '../notifications/device';
import {groupAction} from './groupInbox';
import {createReceiptQueue} from './inboxReceipts';
import type {Message,Thread} from './model';
const viewabilityConfig={minimumViewTime:600,viewAreaCoveragePercentThreshold:60};
/** Read only viewable foreground messages, not the entire downloaded list. */
export function useInboxReceipts(thread:Thread|undefined,uid:string,messages:Message[],visible:boolean){
 const queue=useRef<ReturnType<typeof createReceiptQueue>|null>(null),viewed=useRef<string[]>([]),showing=useRef(false);
 const cid=thread?.data.schemaVersion===3&&thread.data.receiptsEnabled===true?thread.id:'',epoch=thread?.data.epoch,category=thread?.category;
 useEffect(()=>{showing.current=visible;if(!visible)viewed.current=[];},[visible]);
 useEffect(()=>{
  if(!cid||!uid||!epoch)return;
  const storageKey=`townloop.inbox.receipts.v1/${uid}/${cid}/${epoch}`;
  const q=createReceiptQueue({load:async()=>{const stored=await AsyncStorage.getItem(storageKey);return stored?JSON.parse(stored):[];},save:items=>items.length?AsyncStorage.setItem(storageKey,JSON.stringify(items)):AsyncStorage.removeItem(storageKey),active:()=>AppState.currentState==='active'&&auth.currentUser?.uid===uid,send:async(kind,messageIds)=>{const result=await groupAction('receipt',{conversationId:cid,kind,messageIds});if(kind==='read'&&category&&auth.currentUser?.uid===uid)void refreshBadge(uid,{category,conversationId:cid}).catch(()=>{});return result;}});queue.current=q;
  const subscription=AppState.addEventListener('change',state=>{if(state==='active'){q.wake();if(showing.current)q.add('read',viewed.current);}else q.pause();});
  return()=>{subscription.remove();q.dispose();if(queue.current===q)queue.current=null;viewed.current=[];};
 },[cid,uid,epoch,category]);
 useEffect(()=>{
  if(!visible||!cid||auth.currentUser?.uid!==uid||AppState.currentState!=='active')return;
  const key=`${uid}:${epoch}`;
  queue.current?.add('delivered',messages.filter(m=>m.persisted&&m.senderId!==uid&&!m.isSystem&&!m.receipts?.[key]?.deliveredAt).map(m=>m.id));
  // A receipt-state rerender may not produce a new RN viewability event.
  queue.current?.wake();
 },[messages,visible,cid,uid,epoch]);
 const onViewableItemsChanged=useCallback(({viewableItems}:{viewableItems:ViewToken<Message>[]})=>{
  if(!showing.current||AppState.currentState!=='active')return;
  const ids=viewableItems.filter(v=>v.isViewable&&v.item.persisted).map(v=>v.item.id);viewed.current=ids;
  if(showing.current&&AppState.currentState==='active')queue.current?.add('read',ids);
 },[]);
 return{viewabilityConfig,onViewableItemsChanged};
}
