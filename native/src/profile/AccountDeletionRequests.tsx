import {useSession} from '../lib/session';
import {useEffect,useRef,useState} from 'react';
import {Pressable,View} from 'react-native';
import {Action,Copy,ErrorNotice,Field} from '../news/ui';
import {listAccountDeletionRequests,reviewAccountDeletionRequest,type DeletionReviewItem} from '../lib/accountDeletion';

const denialRestriction='Denial is unavailable under the current policy. Only a documented withdrawal by the resident can close this request.';
/** Pending decisions only; processing and audit records remain on the backend. */
export function AccountDeletionRequests(){
 const {profile,user}=useSession();
 const manager=!!user?.uid&&profile?.approved===true&&profile.source?.deletionPending!==true&&['admin','vip'].includes(profile.role||'');
 const accountKey=manager?`${user?.uid}/${profile?.role}`:'';
 const [requests,setRequests]=useState<DeletionReviewItem[]>([]),[loadedFor,setLoadedFor]=useState('');
 const [notes,setNotes]=useState<Record<string,string>>({}),[nextCursor,setNextCursor]=useState<string|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const operation=useRef(false),epoch=useRef(0);
 async function refresh(cursor?:string){
  if(!manager||operation.current)return;
  const current=epoch.current;operation.current=true;setBusy(true);setError('');
  try{
   const result=await listAccountDeletionRequests(cursor);
   if(current!==epoch.current)return;
   setRequests(result.requests.filter(item=>item.canReview));setLoadedFor(accountKey);setNextCursor(result.nextCursor);
  }catch(e){if(current===epoch.current)setError(e instanceof Error?e.message:'Unable to load requests.');}
  finally{if(current===epoch.current){operation.current=false;setBusy(false);}}
 }
 useEffect(()=>{
  epoch.current++;operation.current=false;setRequests([]);setLoadedFor('');setNotes({});setNextCursor(null);setError('');setBusy(false);
  if(manager)void refresh();
  return()=>{epoch.current++;};
 },[accountKey]);
 async function approve(item:DeletionReviewItem){
  if(operation.current||busy||!manager||!item.canReview||item.isOwnRequest)return;
  const current=epoch.current;operation.current=true;setBusy(true);setError('');
  try{
   // The existing backend requires an audit reason; a blank optional note is recorded honestly.
   const reason=notes[item.jobId]?.trim()||'Approved without an additional note.';
   const result=await reviewAccountDeletionRequest(item.jobId,'approved',reason);
   if(current!==epoch.current)return;
   if(result.jobId!==item.jobId||!result.status)throw Error('Could not confirm the decision. Refresh the requests before trying again.');
   setRequests(rows=>rows.filter(row=>row.jobId!==item.jobId));
   setNotes(previous=>{const next={...previous};delete next[item.jobId];return next;});
  }catch(e){if(current===epoch.current)setError(e instanceof Error?e.message:'Unable to approve this request.');}
  finally{if(current===epoch.current){operation.current=false;setBusy(false);}}
 }
 if(!manager)return <Copy>Admin/VIP access required.</Copy>;
 const visible=loadedFor===accountKey?requests:[];
 return <View style={{gap:12}}>
  <Copy weight="bold">Account deletion requests</Copy>
  {!!error&&<ErrorNotice message={error}/>}
  <Action compact label={busy?'Loading requests…':'Refresh'} disabled={busy} onPress={()=>void refresh()}/>
  {!busy&&loadedFor===accountKey&&!visible.length&&<Copy>{nextCursor?'No pending deletion requests on this page.':'No pending deletion requests.'}</Copy>}
  {visible.map(item=>{
   const disabled=busy||!item.canReview||item.isOwnRequest;
   return <View key={item.jobId} style={{padding:16,borderWidth:1,borderColor:'#94a3b8',borderRadius:16,gap:10}}>
    <Copy weight="bold" style={{fontSize:15,lineHeight:21}}>{item.name}</Copy>
    <Copy style={{color:'#78716c'}}>Submitted {item.createdAt?new Date(item.createdAt).toLocaleDateString():'Date unavailable'}</Copy>
    <Field label="Note (optional)" value={notes[item.jobId]||''} onChangeText={value=>setNotes(previous=>({...previous,[item.jobId]:value}))} maxLength={1000} editable={!disabled} multiline/>
    <View style={{flexDirection:'row',flexWrap:'wrap',gap:10}}>
     {(['Deny','Approve'] as const).map(label=><Pressable key={label} accessibilityRole="button" accessibilityLabel={label} accessibilityHint={label==='Deny'?denialRestriction:undefined} accessibilityState={{disabled}} disabled={disabled}
      onPress={()=>{if(label==='Approve')void approve(item);else if(!operation.current)setError(denialRestriction);}}
      style={({pressed})=>({flex:1,minWidth:96,minHeight:44,paddingHorizontal:16,paddingVertical:10,borderRadius:14,alignItems:'center',justifyContent:'center',backgroundColor:label==='Deny'?'#dc2626':'#047857',opacity:disabled?0.5:pressed?0.8:1,transform:[{scale:pressed?0.98:1}]})}>
       <Copy weight="bold" style={{color:'#fff',fontSize:14,lineHeight:20}}>{label}</Copy>
      </Pressable>)}
    </View>
    {item.isOwnRequest&&<Copy>Another Admin/VIP must review this request.</Copy>}
   </View>;
  })}
  {!!nextCursor&&<Action compact label="Next requests" disabled={busy} onPress={()=>void refresh(nextCursor)}/>}
 </View>;
}
