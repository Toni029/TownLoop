import { useRef, useState } from 'react';
import { Image, View } from 'react-native';
import { Camera, Upload, Trash2 } from 'lucide-react-native';
import { WORK_ORDER_CATEGORIES } from '../../../src/data/workOrderCategories';
import { Action, Copy, Field, Choices, ErrorNotice, s } from '../news/ui';
import { ProductDialog } from '../components/ProductDialog';
import { pickAndUpload } from '../components/media';
import { newOrderId, submitWorkOrder } from './actions';
export function RequestEditor({onClose,onSaved}:{onClose:()=>void;onSaved:()=>void}) {
  const [id]=useState(newOrderId);
  const [category,setCategory]=useState(WORK_ORDER_CATEGORIES[0].name);
  const [title,setTitle]=useState(''); const [description,setDescription]=useState('');
  const [photos,setPhotos]=useState<string[]>([]); const [busy,setBusy]=useState(false);
  const [error,setError]=useState(''); const [progress,setProgress]=useState<number|null>(null);
  const lock=useRef(false);
  async function upload(camera=false) {
    if (lock.current) return; lock.current=true;setBusy(true);setError('');setProgress(0);
    try { const files=await pickAndUpload('work_orders',setProgress,camera);setPhotos(p=>[...p,...files.map(f=>f.url)]); }
    catch(e){setError(e instanceof Error ? e.message : 'Unable to attach photos.');}
    finally{lock.current=false;setBusy(false);setProgress(null);}
  }
  async function submit() {
    if (lock.current) return;lock.current=true;setBusy(true);setError('');
    try {await submitWorkOrder(id,{title,description,category,photos});onSaved();onClose();}
    catch(e){setError(e instanceof Error ? e.message : 'Unable to submit request.');}
    finally{lock.current=false;setBusy(false);}
  }
  return <ProductDialog title="🛠️ New Work Order Request" subtitle="Submit an issue to the maintenance crew" busy={busy} onClose={onClose}>
    <Choices label="Category" values={WORK_ORDER_CATEGORIES.map(c=>c.name)} value={category} onChange={setCategory}/>
    <Copy style={{color:'#a8a29e',fontSize:11}}>{WORK_ORDER_CATEGORIES.find(c=>c.name===category)?.description}</Copy>
    <Field label="What Needs Fixing? *" value={title} onChangeText={setTitle} editable={!busy} placeholder="e.g. Master bathroom sink dripping constantly"/>
    <Field label="Description of Issue" value={description} onChangeText={setDescription} editable={!busy} multiline placeholder="Provide details about the issue (exact room, how long it has been happening, accessibility instructions)..."/>
    <View style={{borderTopWidth:1,borderColor:'#e7e5e4',paddingTop:14,gap:12}}><View style={s.row}><Copy weight="bold" style={{flex:1}}>Attach Pictures</Copy><Copy style={{color:'#78716c'}}>Photos Only • No Videos</Copy></View>
      <View style={[s.card,{borderStyle:'dashed',borderWidth:2,backgroundColor:'#fafaf9'}]}><Action label="Upload Photos" icon={Upload} disabled={busy} onPress={()=>void upload()}/><Action label="Take Picture" icon={Camera} tone="light" disabled={busy} onPress={()=>void upload(true)}/></View>
      {progress!==null && <Copy accessibilityLiveRegion="polite">Uploading photo… {progress}%</Copy>}
      <View style={s.row}>{photos.map((uri,index)=><View key={`${uri}-${index}`} style={{gap:4}}><Image source={{uri}} accessibilityLabel={`Attached photo ${index+1}`} style={{width:90,height:90,borderRadius:12}}/><Action compact label="Remove photo" icon={Trash2} tone="rose" disabled={busy} onPress={()=>setPhotos(p=>p.filter((_,i)=>i!==index))}/></View>)}</View>
    </View>
    {error && <ErrorNotice message={error}/>}
    <Action label={busy ? progress!==null ? `Uploading Photos (${progress}%)…` : 'Submitting Request…' : 'Submit Work Order'} disabled={busy} onPress={()=>void submit()}/>
  </ProductDialog>;
}
