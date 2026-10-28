import {usePushDocument} from '../notifications/usePushDocument';
import {useQueuePositions} from './useQueuePositions';
import { useCallback, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { ProductToast } from '../components/ProductToast';
import { useResident } from '../lib/resident';
import { useLiveCollection } from '../lib/liveCollection';
import { Copy, Action, NewsDialog } from '../news/ui';
import { WorkOrdersFeed, type OrderAction } from './WorkOrdersFeed';
import { RequestEditor } from './RequestEditor';
import { readWorkOrder, type WorkOrder } from './model';
import { changeWorkOrder } from './actions';
export default function WorkOrdersScreen() {
  const user=useResident();const live=useLiveCollection('work_orders',readWorkOrder);
  const pushed=usePushDocument(['workorders']);
  const orders=useMemo(()=>pushed?.category==='workorders'&&!live.items.some(o=>o.id===pushed.id)?[...live.items,readWorkOrder(pushed.id,pushed.data)]:live.items,[live.items,pushed]);
  const queuePositions=useQueuePositions(orders,user);
  const [editing,setEditing]=useState<WorkOrder | null>(null);const [create,setCreate]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [message,setMessage]=useState('');const lock=useRef(false);
  const act = useCallback(async (id:string,action:OrderAction,text='',photo='') => {
    if(lock.current)return false;lock.current=true;setBusy(true);
    try {await changeWorkOrder(id,action,text,photo);setMessage(action==='deleteComment'?'Resolution comment deleted':action==='delete'?'Work order deleted':action==='complete'?'Work order completed':action==='reopen'?'Work order reopened':'Comment added');return true;}
    catch(e){setError(e instanceof Error ? e.message : 'Unable to update work order.');return false;}
    finally{lock.current=false;setBusy(false);}
  }, []);
  return <View style={{flex:1}}><WorkOrdersFeed queuePositions={queuePositions} orders={orders} user={user} loading={live.loading} error={live.error} retry={live.retry} refreshing={live.refreshing} onRefresh={live.refresh} busy={busy} onEdit={setEditing} onCreate={()=>setCreate(true)} onAction={act}/>{create && <RequestEditor onClose={()=>setCreate(false)} onSaved={()=>setMessage('Work order request submitted!')}/>}{editing && <RequestEditor key={String(editing.id)} order={editing} onClose={()=>setEditing(null)} onSaved={()=>setMessage('Work order updated!')}/>}{!!message && <ProductToast key={message} message={message} onDone={()=>setMessage('')}/>}{!!error && <NewsDialog title="Work Orders" onClose={()=>{setError('');setMessage('');}}><Copy>{error}</Copy><Action label="OK" onPress={()=>{setError('');setMessage('');}}/></NewsDialog>}</View>;
}
