import {useState} from 'react';
import {doc,runTransaction,serverTimestamp} from 'firebase/firestore';
import {auth,db} from '../firebase';
import type {UserProfile} from '../types';
const labels={phone:'Resident phone',address:'Residency address',dateOfBirth:'Date of birth',maritalStatus:'Marital status',emergencyContactName:'Emergency contact name',emergencyContactPhone:'Emergency contact phone',emergencyContactAddress:'Emergency contact address'};
type Fields=Record<keyof typeof labels,string>;
function fields(data:Record<string,any>):Fields{
 const contact=typeof data.emergencyContact==='object'&&data.emergencyContact?data.emergencyContact:{};
 const text=(...v:unknown[])=>v.find(x=>typeof x==='string'&&x.trim()) as string||'';
 return {phone:text(data.phone),address:text(data.address,data.unit),dateOfBirth:text(data.dateOfBirth,data.date_of_birth),maritalStatus:text(data.maritalStatus,data.marital_status),
  emergencyContactName:text(data.emergencyContactName,data.emergency_contact_name,contact.name,typeof data.emergencyContact==='string'?data.emergencyContact:undefined,data.emergency_contact),
  emergencyContactPhone:text(data.emergencyContactPhone,data.emergency_contact_phone,contact.phone),emergencyContactAddress:text(data.emergencyContactAddress,data.emergency_contact_address,contact.address)};
}
/** Submit a proposal only; the approved profile stays unchanged until office review. */
export function ProfileUpdateRequest({user}:{user:UserProfile}){
 const [open,setOpen]=useState(false),[form,setForm]=useState(()=>fields(user)),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 async function submit(){
  if(busy)return;setBusy(true);setNotice('');
  try{
   const uid=auth?.currentUser?.uid;
   if(!uid||uid!==String(user.id)||!db)throw Error('Please sign in again.');
   await runTransaction(db,async tx=>{
    const ref=doc(db!,'users',uid),snapshot=await tx.get(ref);
    if(!snapshot.exists()||auth?.currentUser?.uid!==uid)throw Error('Your account changed. Sign in again.');
    const previous=fields(snapshot.data());
    const changes=Object.fromEntries(Object.keys(labels).filter(key=>form[key as keyof Fields].trim()!==previous[key as keyof Fields]).map(key=>[key,form[key as keyof Fields].trim()]));
    if(!Object.keys(changes).length)throw Error('No account details have changed.');
    tx.update(ref,{profileUpdateRequest:{status:'pending',changes,previous,requestedAt:serverTimestamp(),requestedBy:uid}});
   });setOpen(false);setNotice('Request saved for Admin/VIP approval. Your approved account details have not changed.');
  }catch(e){setNotice(e instanceof Error?e.message:'Your request was not saved. Please retry.');}finally{setBusy(false);}
 }
 return <div className="space-y-3">{!open?<button type="button" onClick={()=>{setForm(fields(user));setOpen(true);setNotice('');}} className="w-full py-3 rounded-2xl bg-stone-900 text-white text-sm font-bold">Request Profile Update</button>:<div className="space-y-3 p-3 rounded-2xl border border-stone-300 dark:border-slate-700">
  <p className="text-sm">The office must approve changes before they update your account.</p>{Object.entries(labels).map(([key,label])=><label className="block text-sm font-bold" key={key}>{label}<input maxLength={300} disabled={busy} value={form[key as keyof Fields]} onChange={e=>setForm({...form,[key]:e.target.value})} className="block w-full mt-1 p-3 rounded-xl border bg-white dark:bg-slate-800"/></label>)}
  <button type="button" disabled={busy} onClick={()=>void submit()} className="px-4 py-3 rounded-xl bg-emerald-700 text-white font-bold">{busy?'Saving request…':'Request profile update'}</button> <button type="button" disabled={busy} onClick={()=>setOpen(false)}>Cancel</button>
 </div>}{!!notice&&<p role="status" className="text-sm">{notice}</p>}</div>;
}
