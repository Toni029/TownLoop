import {useSession} from '../lib/session';
import {auth} from '../lib/firebase';
import {useEffect,useRef,useState} from 'react';
import {Pressable,View} from 'react-native';
import {Action,Copy,ErrorNotice,Field} from '../news/ui';
import {deletionStatusText,listAccountDeletionRequests,reviewAccountDeletionRequest,type DeletionReviewItem} from '../lib/accountDeletion';

type ReasonCategory='identity_verification'|'invalid_request'|'requester_withdrawal';
export function AccountDeletionRequests(){
 const {profile,user}=useSession();
 const manager=!!user?.uid&&profile?.approved===true&&profile.source?.deletionPending!==true&&['admin','vip'].includes(profile.role||'');
 if(!manager||!user||auth.currentUser?.uid!==user.uid)return <Copy>Admin/VIP access required.</Copy>;
 return <AccountDeletionRequestsForAccount key={`${user.uid}/${profile.role}`} uid={user.uid} accountKey={`${user.uid}/${profile.role}`}/>;
}
function AccountDeletionRequestsForAccount({uid,accountKey}:{uid:string;accountKey:string}){
 const [requests,setRequests]=useState<DeletionReviewItem[]>([]),[loadedFor,setLoadedFor]=useState('');
 const [notes,setNotes]=useState<Record<string,string>>({}),[nextCursor,setNextCursor]=useState<string|null>(null);
 const [busy,setBusy]=useState(true),[error,setError]=useState('');
 const [rejecting,setRejecting]=useState<string|null>(null),[reason,setReason]=useState(''),[reference,setReference]=useState(''),[category,setCategory]=useState<ReasonCategory>('invalid_request');
 const [retrying,setRetrying]=useState<string|null>(null);
 const operation=useRef(false),mounted=useRef(true);
 async function refresh(cursor?:string){
  if(operation.current||!mounted.current||auth.currentUser?.uid!==uid)return;
  operation.current=true;setBusy(true);setError('');
  try{
   const result=await listAccountDeletionRequests(cursor);
   if(!mounted.current||auth.currentUser?.uid!==uid)return;
   setRequests(result.requests);setLoadedFor(accountKey);setNextCursor(result.nextCursor);
  }catch(e){if(mounted.current&&auth.currentUser?.uid===uid)setError(e instanceof Error?e.message:'Unable to load requests.');}
  finally{if(mounted.current&&auth.currentUser?.uid===uid){operation.current=false;setBusy(false);}}
 }
 useEffect(()=>{
  let alive=true;mounted.current=true;operation.current=true;
  void listAccountDeletionRequests().then(result=>{
   if(!alive||auth.currentUser?.uid!==uid)return;
   setRequests(result.requests);setLoadedFor(accountKey);setNextCursor(result.nextCursor);
  }).catch(e=>{if(alive&&auth.currentUser?.uid===uid)setError(e instanceof Error?e.message:'Unable to load requests.');})
  .finally(()=>{if(alive&&auth.currentUser?.uid===uid){operation.current=false;setBusy(false);}});
  return()=>{alive=false;mounted.current=false;};
 },[uid,accountKey]);
 async function decide(item:DeletionReviewItem,decision:'approved'|'rejected'|'retry'){
  if(operation.current||busy||!mounted.current||item.workflowVersion!==3||!item.requestId||item.isOwnRequest||auth.currentUser?.uid!==uid)return;
  if(decision==='retry'?!item.canRetry:!item.canReview)return;
  if(decision==='rejected'&&(!reason.trim()||!reference.trim()||rejecting!==item.jobId))return;
  if(decision==='retry'&&retrying!==item.jobId)return;
  operation.current=true;setBusy(true);setError('');
  try{
   const note=decision==='rejected'?reason.trim():notes[item.jobId]?.trim()||(decision==='retry'?'Retry requested after reviewing the processing status.':'Approved without an additional note.');
   const result=await reviewAccountDeletionRequest(item.jobId,decision,note,{requestId:item.requestId,...(decision==='rejected'?{reasonCategory:category,reasonReference:reference.trim()}: {})});
   if(!mounted.current||auth.currentUser?.uid!==uid)return;
   if(result.jobId!==item.jobId||result.requestId!==item.requestId||!result.status)throw Error('Could not confirm the decision. Refresh the requests before trying again.');
   setRequests(rows=>rows.map(row=>row.jobId===item.jobId?{...row,...result,canReview:false,canRetry:false}:row));
   setNotes(previous=>{const next={...previous};delete next[item.jobId];return next;});
   setRejecting(null);setRetrying(null);setReason('');setReference('');
  }catch(e){if(mounted.current&&auth.currentUser?.uid===uid)setError(e instanceof Error?e.message:'Unable to save this decision.');}
  finally{if(mounted.current&&auth.currentUser?.uid===uid){operation.current=false;setBusy(false);}}
 }
 const visible=loadedFor===accountKey?requests:[];
 return <View style={{gap:12}}>
  <Copy weight="bold">Account deletion requests</Copy>
  {!!error&&<ErrorNotice message={error}/>}
  <Action compact label={busy?'Loading requests…':'Refresh'} disabled={busy} onPress={()=>void refresh()}/>
  {!busy&&loadedFor===accountKey&&!visible.length&&<Copy>{nextCursor?'No deletion requests on this page.':'No deletion requests.'}</Copy>}
  {visible.map(item=>{
   const current=item.workflowVersion===3&&!!item.requestId;
   const disabled=busy||!current||!item.canReview||item.isOwnRequest;
   return <View key={`${item.jobId}/${item.requestId||'legacy'}`} style={{padding:16,borderWidth:1,borderColor:'#94a3b8',borderRadius:16,gap:10}}>
    <Copy weight="bold" style={{fontSize:15,lineHeight:21}}>{item.name}</Copy>
    <Copy style={{color:'#78716c'}}>Submitted {item.submittedAt||item.createdAt?new Date((item.submittedAt||item.createdAt)!).toLocaleDateString():'Date unavailable'}</Copy>
    <Copy>{deletionStatusText(item)}</Copy>
    {current&&item.status==='requested'&&!!item.autoDeleteAt&&<Copy>Automatic authorization if undecided: {new Date(item.autoDeleteAt).toLocaleString()}</Copy>}
    {!current&&<Copy>Historical request · read-only</Copy>}
    {current&&item.canReview&&<>
    <Field label="Note (optional)" value={notes[item.jobId]||''} onChangeText={value=>setNotes(previous=>({...previous,[item.jobId]:value}))} maxLength={1000} editable={!disabled} multiline/>
    <View style={{flexDirection:'row',flexWrap:'wrap',gap:10}}>
     {(['Deny','Approve'] as const).map(label=><Pressable key={label} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled}} disabled={disabled}
      onPress={()=>{if(disabled)return;if(label==='Approve')void decide(item,'approved');else{setRejecting(item.jobId);setReason('');setReference('');setCategory('invalid_request');}}}
      style={({pressed})=>({flex:1,minWidth:96,minHeight:44,paddingHorizontal:16,paddingVertical:10,borderRadius:14,alignItems:'center',justifyContent:'center',backgroundColor:label==='Deny'?'#dc2626':'#047857',opacity:disabled?0.5:pressed?0.8:1,transform:[{scale:pressed?0.98:1}]})}>
       <Copy weight="bold" style={{color:'#fff',fontSize:14,lineHeight:20}}>{label}</Copy>
      </Pressable>)}
    </View>
    {rejecting===item.jobId&&<>
     <Copy>Reject only an invalid or unverified request, or a documented withdrawal. This closes the request; the resident may submit a new verified request.</Copy>
     {([['invalid_request','Invalid request'],['identity_verification','Identity verification'],['requester_withdrawal','Requester withdrawal']] as const).map(([value,label])=><Action key={value} compact label={`${category===value?'Selected: ':''}${label}`} disabled={disabled} onPress={()=>setCategory(value)}/>)}
     <Field label="Documented reason" value={reason} onChangeText={setReason} maxLength={1000} editable={!disabled} multiline/>
     <Field label="Documentation reference" value={reference} onChangeText={setReference} maxLength={200} editable={!disabled}/>
     <Copy>The reason is shown to the resident. Keep private evidence out of this explanation and reference.</Copy>
     <Action compact label="Confirm rejection" disabled={disabled||!reason.trim()||!reference.trim()} onPress={()=>void decide(item,'rejected')}/>
     <Action compact label="Cancel rejection" disabled={busy} onPress={()=>setRejecting(null)}/>
    </>}
    </>}
    {current&&item.canRetry&&!item.isOwnRequest&&<>
     <Action compact label="Retry processing" disabled={busy} onPress={()=>setRetrying(item.jobId)}/>
     {retrying===item.jobId&&<><Copy>Retry this request&apos;s authorized deletion processing? Completion still requires verification.</Copy><Action compact label="Confirm retry" disabled={busy} onPress={()=>void decide(item,'retry')}/><Action compact label="Cancel retry" disabled={busy} onPress={()=>setRetrying(null)}/></>}
    </>}
    {item.isOwnRequest&&item.canReview&&<Copy>Another Admin/VIP must review this request.</Copy>}
   </View>;
  })}
  {!!nextCursor&&<Action compact label="Next requests" disabled={busy} onPress={()=>void refresh(nextCursor)}/>}
 </View>;
}
