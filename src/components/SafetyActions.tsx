import React, {useEffect,useState} from 'react';
import {doc,onSnapshot} from 'firebase/firestore';
import {app,auth,db} from '../firebase';
import {setUserBlock,submitSafetyReport,type SafetyTarget} from '../services/safety';
export function SafetyActions({target,allowBlock=false}:{target:SafetyTarget;allowBlock?:boolean}) {
 const uid=auth?.currentUser?.uid,other=target.authorId||(target.kind==='user'?target.id:'');
 const [open,setOpen]=useState(false),[reason,setReason]=useState('harassment'),[details,setDetails]=useState(''),[status,setStatus]=useState(''),[busy,setBusy]=useState(false),[blocked,setBlocked]=useState(false);
 useEffect(()=>{setBlocked(false);if(!db||!uid||!other||uid===other||!allowBlock)return;return onSnapshot(doc(db,'user_blocks',uid,'targets',other),s=>setBlocked(s.exists()),()=>{});},[uid,other,allowBlock]);
 if(!uid||uid===other||!app)return null;
 const send=async()=>{setBusy(true);try{await submitSafetyReport(app!,target,reason,details);setOpen(false);setDetails('');setStatus('Report sent to the office.');}catch(e){setStatus(e instanceof Error?e.message:'Unable to report.');}finally{setBusy(false);}};
 return <div className="text-xs space-y-2"><div className="flex gap-3 flex-wrap"><button type="button" className="underline" onClick={()=>setOpen(!open)}>{target.kind==='user'?'Report user':target.kind==='comment'?'Report comment':'Report'}</button>
 {allowBlock&&other&&<button type="button" className="underline" disabled={busy} onClick={async()=>{setBusy(true);try{await setUserBlock(app!,other,!blocked);setStatus(blocked?'User unblocked.':'Private messages blocked; history preserved.');}catch(e){setStatus(e instanceof Error?e.message:'Unable to block.');}finally{setBusy(false);}}}>{blocked?'Unblock user':'Block user'}</button>}</div>
 {open&&<div className="p-3 border rounded-xl space-y-2"><p>Reports go to the community office. Do not include medical details or private message contents.</p><select aria-label="Report reason" value={reason} onChange={e=>setReason(e.target.value)}>{['harassment','spam','unsafe','privacy','other'].map(v=><option key={v} value={v}>{v}</option>)}</select><textarea aria-label="Report details" className="w-full border rounded p-2" maxLength={1000} value={details} onChange={e=>setDetails(e.target.value)}/><button type="button" disabled={busy} onClick={()=>void send()}>Send report</button></div>}
 {!!status&&<p role="status">{status}</p>}</div>;
}
