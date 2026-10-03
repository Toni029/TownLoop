import { useRef, useState } from 'react';
import { View } from 'react-native';
import { ProductToast } from '../components/ProductToast';
import { useResident } from '../lib/resident';
import { useLiveCollection } from '../lib/liveCollection';
import { Copy, Action, NewsDialog } from '../news/ui';
import { WorkOrdersFeed, type OrderAction } from './WorkOrdersFeed';
import { RequestEditor } from './RequestEditor';
import { readWorkOrder } from './model';
import { changeWorkOrder } from './actions';
export default function WorkOrdersScreen() {
  const user=useResident();const live=useLiveCollection('work_orders',readWorkOrder);
  const [create,setCreate]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [message,setMessage]=useState('');const lock=useRef(false);
  async function act(id:string,action:OrderAction,text='',photo='') {
    if(lock.current)return false;lock.current=true;setBusy(true);
    try {await changeWorkOrder(id,action,text,photo);setMessage(action==='delete'?'Work order deleted':action==='complete'?'Work order resolved with verification photo!':action==='reopen'?'Work order reopened':'Comment added');return true;}
    catch(e){setError(e instanceof Error ? e.message : 'Unable to update work order.');return false;}
    finally{lock.current=false;setBusy(false);}
  }
  return <View style={{flex:1}}><WorkOrdersFeed orders={live.items} user={user} loading={live.loading} error={live.error} retry={live.retry} busy={busy} onCreate={()=>setCreate(true)} onAction={act}/>{create && <RequestEditor onClose={()=>setCreate(false)} onSaved={()=>setMessage('Work order request submitted!')}/>}{!!message && <ProductToast key={message} message={message} onDone={()=>setMessage('')}/>}{!!error && <NewsDialog title="Work Orders" onClose={()=>{setError('');setMessage('');}}><Copy>{error}</Copy><Action label="OK" onPress={()=>{setError('');setMessage('');}}/></NewsDialog>}</View>;
}
